import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './api'
import {
  DEFAULT_SETTINGS,
  LEGACY_KEYS,
  mergeSettings,
  migrationPatch,
  pageSizeOf,
  settingsError,
  sortOf,
  sortPatch,
  startPath,
  uploadOptions,
  visibleTasks,
} from './settings'

const legacy = (data: Record<string, string>) => (key: string) => data[key] ?? null

describe('settings', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('merges a partial patch group by group', () => {
    const next = mergeSettings(DEFAULT_SETTINGS, { uploads: { priority: 'high' }, interface: { theme: 'light' } })
    expect(next.uploads).toEqual({ ...DEFAULT_SETTINGS.uploads, priority: 'high' })
    expect(next.interface.theme).toBe('light')
    expect(next.archives).toEqual(DEFAULT_SETTINGS.archives)
    expect(next.telegram).toEqual({ chat_folder: true })
    expect(DEFAULT_SETTINGS.interface.theme).toBe('dark')
    expect(DEFAULT_SETTINGS.interface.fx_easter_eggs).toBe(true)
  })

  it('replaces file column widths as a whole map', () => {
    const base = mergeSettings(DEFAULT_SETTINGS, { interface: { file_columns: { name: 300, size: 90 } } })
    expect(base.interface.file_columns).toEqual({ name: 300, size: 90 })
    expect(mergeSettings(base, { interface: { file_columns: { type: 70 } } }).interface.file_columns).toEqual({ type: 70 })
    expect(mergeSettings(base, { interface: { theme: 'light' } }).interface.file_columns).toEqual({ name: 300, size: 90 })
  })

  it('migrates old localStorage prefs only onto default server settings', () => {
    const old = legacy({
      'tcloud.view': 'grid',
      'tcloud.sort': '{"key":"created","desc":true,"foldersFirst":false}',
      'tcloud.theme': 'light',
      'tcloud.feature.pet': 'on',
      'tcloud.feature.sounds': 'off',
    })
    expect(migrationPatch(DEFAULT_SETTINGS, old)).toEqual({
      interface: { folder_view: 'grid', theme: 'light', sort_by: 'uploaded', sort_order: 'desc', folders_first: false },
    })
    expect(migrationPatch(mergeSettings(DEFAULT_SETTINGS, { interface: { start_page: 'tasks' } }), old)).toBeNull()
    expect(migrationPatch(DEFAULT_SETTINGS, legacy({ 'tcloud.theme': 'dark', 'tcloud.view': 'list' }))).toBeNull()
    expect(migrationPatch(DEFAULT_SETTINGS, legacy({ 'tcloud.sort': 'garbage' }))).toBeNull()
    expect(migrationPatch(DEFAULT_SETTINGS, legacy({ 'tcloud.feature.cursor': 'on', 'tcloud.feature.confetti': 'on' }))).toBeNull()
    expect(LEGACY_KEYS).toContain('tcloud.achievements')
  })

  it('picks the start page', () => {
    expect(startPath(DEFAULT_SETTINGS)).toBe('/dashboard')
    expect(startPath(mergeSettings(DEFAULT_SETTINGS, { interface: { start_page: 'storages' } }))).toBe('/files')
    expect(startPath(mergeSettings(DEFAULT_SETTINGS, { interface: { start_page: 'tasks' } }))).toBe('/tasks')
  })

  it('filters tasks to active and failed', () => {
    const tasks = ['queued', 'running', 'done', 'failed', 'cancelled'].map((status) => ({ status }))
    expect(visibleTasks(tasks, 'all')).toHaveLength(5)
    expect(visibleTasks(tasks, 'active_and_failed').map((t) => t.status)).toEqual(['queued', 'running', 'failed'])
  })

  it('maps sort and upload defaults', () => {
    const sort = sortOf(DEFAULT_SETTINGS.interface)
    expect(sort).toEqual({ key: 'name', desc: false, foldersFirst: true })
    expect(sortPatch({ key: 'size', desc: true, foldersFirst: false })).toEqual({ interface: { sort_by: 'size', sort_order: 'desc', folders_first: false } })
    expect(uploadOptions(DEFAULT_SETTINGS.uploads)).toEqual({ send_as: 'file', on_conflict: 'error', priority: 'normal', allow_unscannable: false, encrypt: true })
    expect(uploadOptions({ ...DEFAULT_SETTINGS.uploads, send_as: 'media' }).encrypt).toBe(false)
  })

  it('reads the page size from settings, then the local copy, else 20', () => {
    const ui = DEFAULT_SETTINGS.interface
    expect(pageSizeOf(ui, legacy({}))).toBe(20)
    expect(pageSizeOf(ui, legacy({ page_size: '100' }))).toBe(100)
    expect(pageSizeOf({ ...ui, page_size: 50 }, legacy({ page_size: '100' }))).toBe(50)
    expect(pageSizeOf(ui, legacy({ page_size: '7' }))).toBe(20)
  })

  it('explains webhook errors from the API', () => {
    expect(settingsError(new ApiError(422, { code: 'unsafe_url', message: 'x' }))).toMatch(/публичный адрес/)
    const tooLong = new ApiError(422, { code: 'validation_error', message: 'x', details: [{ loc: ['body', 'uploads', 'webhook_url'], type: 'string_too_long' }] })
    expect(settingsError(tooLong)).toBe('Ссылка длиннее 2048 символов')
  })

  it('applies a change optimistically and reverts it when the server refuses', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined })
    let reply: Response = new Response(JSON.stringify({ code: 'x' }), { status: 500 })
    vi.stubGlobal('fetch', vi.fn(async () => reply))
    const store = await import('./settings')
    store.hydrateSettings(DEFAULT_SETTINGS)
    const failing = store.updateSettings({ interface: { theme: 'light' } })
    expect(store.getSettings().interface.theme).toBe('light')
    await expect(failing).rejects.toMatchObject({ status: 500 })
    expect(store.getSettings().interface.theme).toBe('dark')
    const saved = mergeSettings(DEFAULT_SETTINGS, { interface: { theme: 'light' } })
    reply = new Response(JSON.stringify(saved), { status: 200 })
    await store.updateSettings({ interface: { theme: 'light' } })
    expect(store.getSettings()).toEqual(saved)
  })

  it('sends settings changes one at a time so the server never merges two at once', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined })
    const order: string[] = []
    const replies: (() => void)[] = []
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => {
      order.push(`start ${init.body}`)
      return new Promise<Response>((resolve) => replies.push(() => {
        order.push(`end ${init.body}`)
        resolve(new Response(JSON.stringify(DEFAULT_SETTINGS), { status: 200 }))
      }))
    }))
    const store = await import('./settings')
    const a = store.updateSettings({ interface: { dashboard_layout: ['users'] } })
    const b = store.updateSettings({ interface: { dashboard_hidden: ['users'] } })
    await vi.waitFor(() => expect(replies).toHaveLength(1))
    replies[0]()
    await vi.waitFor(() => expect(replies).toHaveLength(2))
    replies[1]()
    await Promise.all([a, b])
    expect(order.map((line) => line.split(' ')[0])).toEqual(['start', 'end', 'start', 'end'])
  })
})
