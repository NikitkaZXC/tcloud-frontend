import { useSyncExternalStore } from 'react'
import { api, ApiError, errorMessage } from './api'
import { parseSort, type Sort } from './files'
import type { ArchiveFormat, OnConflict, Priority, SendAs, UploadOptions } from './types'
import { t } from './i18n'

export type Language = 'ru' | 'en'
export type Theme = 'dark' | 'light'
export type SortBy = 'name' | 'modified' | 'uploaded' | 'type' | 'size'
export type StartPage = 'dashboard' | 'storages' | 'tasks'
export type TasksFilter = 'all' | 'active_and_failed'

export interface Settings {
  uploads: {
    encrypt: boolean
    send_as: SendAs
    priority: Priority
    on_conflict: OnConflict
    allow_unscannable: boolean
    webhook_url: string | null
  }
  archives: { format: ArchiveFormat; priority: Priority }
  interface: {
    language: Language | null
    theme: Theme
    folder_view: 'list' | 'grid'
    sort_by: SortBy
    sort_order: 'asc' | 'desc'
    folders_first: boolean
    animations: boolean
    confirm_delete: boolean
    start_page: StartPage
    tasks_filter: TasksFilter
    fx_pet: boolean
    fx_sounds: boolean
    fx_confetti: boolean
    fx_cursor: boolean
    fx_easter_eggs: boolean
  }
}

export type SettingsPatch = { [G in keyof Settings]?: Partial<Settings[G]> }

export const DEFAULT_SETTINGS: Settings = {
  uploads: { encrypt: true, send_as: 'file', priority: 'normal', on_conflict: 'error', allow_unscannable: false, webhook_url: null },
  archives: { format: 'zip', priority: 'normal' },
  interface: {
    language: null,
    theme: 'dark',
    folder_view: 'list',
    sort_by: 'name',
    sort_order: 'asc',
    folders_first: true,
    animations: true,
    confirm_delete: true,
    start_page: 'dashboard',
    tasks_filter: 'all',
    fx_pet: false,
    fx_sounds: false,
    fx_confetti: false,
    fx_cursor: false,
    fx_easter_eggs: false,
  },
}

export function mergeSettings(base: Settings, patch: SettingsPatch): Settings {
  return {
    uploads: { ...base.uploads, ...patch.uploads },
    archives: { ...base.archives, ...patch.archives },
    interface: { ...base.interface, ...patch.interface },
  }
}

export const MIRROR_KEY = 'tcloud.mirror'
export const LEGACY_KEYS = ['view', 'sort', 'theme', 'feature.pet', 'feature.sounds', 'feature.confetti', 'feature.cursor', 'feature.eggs'].map((key) => `tcloud.${key}`)

const FEATURE_KEYS = { pet: 'fx_pet', sounds: 'fx_sounds', confetti: 'fx_confetti', cursor: 'fx_cursor', eggs: 'fx_easter_eggs' } as const

export function legacyPatch(read: (key: string) => string | null): SettingsPatch['interface'] {
  const patch: SettingsPatch['interface'] = {}
  const view = read('tcloud.view')
  if (view === 'grid' || view === 'list') patch.folder_view = view
  const theme = read('tcloud.theme')
  if (theme === 'light' || theme === 'dark') patch.theme = theme
  const rawSort = read('tcloud.sort')
  if (rawSort) {
    const sort = parseSort(rawSort)
    Object.assign(patch, { sort_by: sort.key, sort_order: sort.desc ? 'desc' : 'asc', folders_first: sort.foldersFirst })
  }
  for (const [feature, key] of Object.entries(FEATURE_KEYS)) {
    const value = read(`tcloud.feature.${feature}`)
    if (value === 'on' || value === 'off') patch[key] = value === 'on'
  }
  return patch
}

export function migrationPatch(settings: Settings, read: (key: string) => string | null): SettingsPatch | null {
  const isDefault = (Object.keys(DEFAULT_SETTINGS.interface) as (keyof Settings['interface'])[]).every((key) => settings.interface[key] === DEFAULT_SETTINGS.interface[key])
  if (!isDefault) return null
  const patch = legacyPatch(read)!
  const changed = Object.fromEntries(Object.entries(patch).filter(([key, value]) => DEFAULT_SETTINGS.interface[key as keyof Settings['interface']] !== value))
  return Object.keys(changed).length ? { interface: changed } : null
}

export function startPath(settings: Settings): string {
  return { dashboard: '/dashboard', storages: '/files', tasks: '/tasks' }[settings.interface.start_page] ?? '/dashboard'
}

function storage(): Storage | null {
  try {
    return localStorage
  } catch {
    return null
  }
}

function readMirror(): SettingsPatch['interface'] {
  try {
    const value = JSON.parse(storage()?.getItem(MIRROR_KEY) ?? '{}')
    return {
      ...(value.theme === 'light' || value.theme === 'dark' ? { theme: value.theme } : {}),
      ...(value.language === 'ru' || value.language === 'en' ? { language: value.language } : {}),
    }
  } catch {
    return {}
  }
}

function writeMirror(settings: Settings) {
  try {
    storage()?.setItem(MIRROR_KEY, JSON.stringify({ theme: settings.interface.theme, language: settings.interface.language }))
  } catch {
    return
  }
}

const listeners = new Set<() => void>()
let confirmed: Settings = mergeSettings(DEFAULT_SETTINGS, { interface: readMirror() })
let current = confirmed
let pending = 0

function publish(next: Settings) {
  current = next
  writeMirror(next)
  listeners.forEach((listener) => listener())
}

export function getSettings(): Settings {
  return current
}

export function subscribeSettings(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, getSettings)
}

export function hydrateSettings(settings: Settings | undefined) {
  if (!settings || pending) return
  confirmed = mergeSettings(DEFAULT_SETTINGS, settings)
  publish(confirmed)
}

async function commit(optimistic: Settings, send: () => Promise<Settings>): Promise<Settings> {
  const id = ++pending
  publish(optimistic)
  try {
    confirmed = mergeSettings(DEFAULT_SETTINGS, await send())
    if (id === pending) publish(confirmed)
    return confirmed
  } catch (error) {
    if (id === pending) publish(confirmed)
    throw error
  } finally {
    if (id === pending) pending = 0
  }
}

export function updateSettings(patch: SettingsPatch): Promise<Settings> {
  return commit(mergeSettings(current, patch), () => api.patch<Settings>('/account/settings', patch))
}

export function resetSettings(): Promise<Settings> {
  return commit(DEFAULT_SETTINGS, () => api.del<Settings>('/account/settings'))
}

export function migrateLegacy(): Promise<unknown> | null {
  const store = storage()
  if (!store) return null
  const read = (key: string) => {
    try {
      return store.getItem(key)
    } catch {
      return null
    }
  }
  if (!LEGACY_KEYS.some((key) => read(key) !== null)) return null
  const patch = migrationPatch(current, read)
  const clear = () => LEGACY_KEYS.forEach((key) => store.removeItem(key))
  if (!patch) {
    clear()
    return null
  }
  return updateSettings(patch).then(clear, () => undefined)
}

export function sortOf(ui: Settings['interface']): Sort {
  return { key: ui.sort_by, desc: ui.sort_order === 'desc', foldersFirst: ui.folders_first }
}

export function sortPatch(sort: Sort): SettingsPatch {
  return { interface: { sort_by: sort.key, sort_order: sort.desc ? 'desc' : 'asc', folders_first: sort.foldersFirst } }
}

export function visibleTasks<T extends { status: string }>(tasks: T[], filter: TasksFilter): T[] {
  return filter === 'all' ? tasks : tasks.filter((task) => task.status !== 'done' && task.status !== 'cancelled')
}

export function uploadOptions(uploads: Settings['uploads']): Omit<UploadOptions, 'path'> {
  return {
    send_as: uploads.send_as,
    on_conflict: uploads.on_conflict,
    priority: uploads.priority,
    allow_unscannable: uploads.allow_unscannable,
    encrypt: uploads.send_as === 'file' && uploads.encrypt,
  }
}

export function settingsError(error: unknown): string {
  if (!(error instanceof ApiError)) return errorMessage(error)
  if (error.code === 'unsafe_url') return t('settings.webhookUnsafe')
  if (error.code !== 'validation_error') return errorMessage(error)
  const detail = (Array.isArray(error.body.details) ? error.body.details : [])[0] as { loc?: unknown[]; type?: string } | undefined
  const field = String(detail?.loc?.at(-1) ?? '')
  if (field === 'webhook_url') return t(detail?.type === 'string_too_long' ? 'settings.webhookTooLong' : 'settings.webhookInvalid')
  return field ? t('settings.invalidField', { field }) : t('settings.invalidValue')
}
