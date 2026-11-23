import { describe, expect, it } from 'vitest'
import { activityGrid, blockOrder, channelUsage, DASHBOARD_BLOCKS, moveBlock, parseLayout, healthRows, hiddenBlocks, visibleBlocks, ACTIVITY_TAIL_MS, endIo, freshServerIo, IO_MIN_MS, lingerIo, mergeIo, previewTotals, serverIo, storageActivity, storageIo, storageTotals, taskCounts, taskRings } from './dashboard'
import type { Health, Storage, Task } from './types'

describe('dashboard', () => {
  it('sums storages and skips hidden counters', () => {
    const storages = [
      { files: 3, total_size: 100, available: true },
      { files: null, total_size: null, available: false },
      { files: 2, total_size: 400, available: true },
    ] as Storage[]
    expect(storageTotals(storages)).toEqual({ storages: 3, files: 5, size: 500, unavailable: 1 })
  })

  it('ignores nulls when every counter is hidden', () => {
    expect(storageTotals([{ files: null, total_size: null, available: false }] as Storage[])).toEqual({ storages: 1, files: 0, size: 0, unavailable: 1 })
  })

  it('sums previews and hides them when the backend does not report them', () => {
    const storages = [{ preview_count: 2, preview_bytes: 300 }, { preview_count: 0, preview_bytes: 0 }, { preview_count: 5, preview_bytes: 700 }] as Storage[]
    expect(previewTotals(storages)).toEqual({ count: 7, bytes: 1000 })
    expect(previewTotals([{ files: 1 }] as Storage[])).toBeNull()
    expect(previewTotals([])).toBeNull()
  })

  it('aggregates uploads and tasks per storage', () => {
    const storages = [{ id: 'a', path: 'tcloud/a' }, { id: 'ab', path: 'tcloud/ab' }, { id: 'c', path: 'tcloud/c' }] as Storage[]
    const sending = [{ id: 1, path: 'tcloud/a/x.txt', loaded: 50, total: 100, rate: null, at: 0 }]
    const tasks = [
      { path: 'tcloud/a/b/y.txt', status: 'running', bytes_done: 50, bytes_total: 300 },
      { path: 'tcloud/a/z.txt', status: 'queued', bytes_done: 0, bytes_total: null },
      { path: 'tcloud/a/old.txt', status: 'done', bytes_done: 10, bytes_total: 10 },
      { path: 'tcloud/ab/q.txt', status: 'running', bytes_done: 0, bytes_total: null },
      { path: 'tcloud/c/docs', status: 'running', stage: 'archiving', bytes_done: 0, bytes_total: null, archive: { name: 'docs.zip' } },
    ] as Task[]
    expect(storageActivity(storages, sending, tasks)).toEqual({ a: { count: 3, percent: 25 }, ab: { count: 1, percent: null } })
  })

  it('marks storages as written, read or both', () => {
    const storages = [{ id: 'a', path: 'tcloud/a' }, { id: 'ab', path: 'tcloud/ab' }, { id: 'c', path: 'tcloud/c' }, { id: 'd', path: 'tcloud/d' }] as Storage[]
    const activity = { a: { count: 1, percent: null }, c: { count: 1, percent: 10 } }
    const tasks = [
      { path: 'tcloud/ab/docs', status: 'running', stage: 'archiving', archive: { name: 'docs.zip' } },
      { path: 'tcloud/c/pack', status: 'running', stage: 'archiving', archive: { name: 'pack.zip' } },
      { path: 'tcloud/d/old', status: 'done', stage: 'done', archive: { name: 'old.zip' } },
    ] as Task[]
    expect(storageIo(storages, activity, tasks)).toEqual({ a: 'write', ab: 'read', c: 'both' })
  })

  it('keeps a short io lit for a minimum time and drops a long one the moment it ends', () => {
    let state = lingerIo({ a: 'write' }, {}, 1000)
    expect(state.io).toEqual({ a: 'write' })
    expect(state.wake).toBeNull()
    state = lingerIo({ b: 'read' }, state.seen, 1100)
    expect(state.io).toEqual({ a: 'write', b: 'read' })
    expect(state.wake).toBe(1000 + IO_MIN_MS)
    state = lingerIo({ a: 'read' }, state.seen, 1200)
    expect(state.io).toEqual({ a: 'both', b: 'read' })
    state = lingerIo({}, state.seen, 1200 + IO_MIN_MS - 1)
    expect(state.io).toEqual({ a: 'read' })
    expect(lingerIo({}, state.seen, 1200 + IO_MIN_MS).io).toEqual({})
    const long = lingerIo({ s: 'write' }, lingerIo({ s: 'write' }, {}, 0).seen, 5000)
    expect(lingerIo({}, long.seen, 5001)).toEqual({ io: {}, seen: {}, wake: null })
  })

  it('remembers when a local io ended until it runs again', () => {
    let ended = endIo({ a: 'both', b: 'write' }, { a: 'read' }, {}, 1000)
    expect(ended).toEqual({ a: { write: 1000 }, b: { write: 1000 } })
    ended = endIo({ a: 'read' }, { a: 'read', b: 'write' }, ended, 2000)
    expect(ended).toEqual({ a: { write: 1000 } })
    expect(endIo({ a: 'read' }, {}, ended, 3000)).toEqual({ a: { write: 1000, read: 3000 } })
  })

  it('ignores a server io sampled before the local one ended plus the server tail', () => {
    const server = { a: 'both', b: 'write' } as const
    const ended = { a: { write: 1000 } }
    expect(freshServerIo(server, ended, 1500)).toEqual({ a: 'read', b: 'write' })
    expect(freshServerIo(server, ended, 1000 + ACTIVITY_TAIL_MS - 1)).toEqual({ a: 'read', b: 'write' })
    expect(freshServerIo(server, ended, 1000 + ACTIVITY_TAIL_MS)).toEqual(server)
  })

  it('matches storage paths at the root, nested and by id', () => {
    const storages = [{ id: 'u1', path: 'tcloud/u1' }] as Storage[]
    const tasks = [{ path: 'tcloud/u1/a.txt', status: 'running', bytes_done: 1, bytes_total: 2 }] as Task[]
    expect(storageActivity(storages, [{ id: 1, path: 'tcloud/u1/x/y.txt', loaded: 0, total: 0, rate: null, at: 0 }], tasks).u1.count).toBe(2)
    expect(storageActivity([{ id: 'u1', path: 'tcloud/u1/' }] as Storage[], [], tasks).u1.count).toBe(1)
  })

  it('drops the done ring and cancelled tasks when only active and failed tasks are shown', () => {
    const counts = { queued: 1, running: 2, done: 5, failed: 1, cancelled: 3 }
    expect(taskRings(counts, 1, 'all')).toEqual({
      rings: [
        { label: 'dashboard.running', count: 3, tone: 'busy' },
        { label: 'status.queued', count: 1, tone: 'idle' },
        { label: 'status.done', count: 5, tone: 'ok' },
        { label: 'dashboard.errors', count: 4, tone: 'fail' },
      ],
      total: 13,
    })
    const active = taskRings(counts, 0, 'active_and_failed')
    expect(active.rings.map((ring) => [ring.label, ring.count])).toEqual([['dashboard.running', 2], ['status.queued', 1], ['dashboard.errors', 1]])
    expect(active.total).toBe(4)
    expect(taskRings(taskCounts(undefined), 0, 'all').total).toBe(1)
  })

  it('lays out the activity map by weeks starting on monday', () => {
    const weeks = activityGrid([{ date: '2026-11-18', files: 4, size: 10 }, { date: '2026-11-16', files: 1, size: 1 }], '2026-11-18', 14)
    expect(weeks.every((week) => week.length === 7 || week === weeks.at(-1))).toBe(true)
    const cells = weeks.flat()
    expect(cells[0].date).toBe('2026-11-02')
    expect(cells.at(-1)).toEqual({ date: '2026-11-18', files: 4, size: 10, level: 4 })
    expect(cells.find((cell) => cell.date === '2026-11-16')?.level).toBe(1)
  })

  it('uses account channel counters when the API has them', () => {
    expect(channelUsage({ telegram_connected: true, premium: false, file_limit: 1, channels_used: 42, channels_limit: 500, previews_enabled: true }, 3)).toEqual({ used: 42, limit: 500, accountWide: true })
    expect(channelUsage({ telegram_connected: true, premium: true, file_limit: 1, channels_used: null, channels_limit: 1000, previews_enabled: true }, 3)).toEqual({ used: 3, limit: 1000, accountWide: false })
    expect(channelUsage({ telegram_connected: false, premium: null, file_limit: null, channels_used: null, channels_limit: null, previews_enabled: true }, 4)).toEqual({ used: 4, limit: 500, accountWide: false })
    expect(channelUsage(undefined, 2)).toEqual({ used: 2, limit: 500, accountWide: false })
  })

  it('builds health rack rows with metrics', () => {
    const health = {
      ok: false, db: true, redis: true, queue: false, antivirus: true, telegram: true, telegram_upload: true, telegram_download: true,
      workers: { 'uploads.prepare': true, 'archives.build': false, 'custom.q': true },
      details: {
        db: { latency_ms: 3.4, last_seen_s: null },
        redis: { latency_ms: 0.3, last_seen_s: null },
        telegram: { latency_ms: 0.01, last_seen_s: null },
        'uploads.prepare': { latency_ms: null, last_seen_s: 1.6 },
        'archives.build': { latency_ms: null, last_seen_s: null },
      },
    } as Health
    const groups = healthRows(health)
    expect(groups.map((group) => [group.id, group.inline])).toEqual([['telegram', false], ['workers', false], ['infra', true]])
    const rows = Object.fromEntries(groups.flatMap((group) => group.rows).map((row) => [row.key, row]))
    expect(rows.telegram.metric).toBe('ok')
    expect(rows.telegram.name).toBe('Основной клиент')
    expect(rows.db.metric).toBe('3 мс')
    expect(rows.redis.metric).toBe('<1 мс')
    expect(rows.antivirus.metric).toBe('ok')
    expect(rows.queue).toMatchObject({ ok: false, metric: 'сбой' })
    expect(rows['uploads.prepare'].metric).toBe('2 с назад')
    expect(rows['archives.build']).toMatchObject({ ok: false, metric: 'нет сигнала' })
    expect(rows['custom.q']).toMatchObject({ name: 'custom.q', hint: '', metric: 'ok' })
    expect(groups[1].rows.map((row) => row.key)).toEqual(['uploads.prepare', 'archives.build', 'custom.q'])
    expect(healthRows({ ...health, workers: {}, details: undefined }).map((group) => group.id)).toEqual(['telegram', 'infra'])
  })

  it('says how long a failing worker has been silent', () => {
    const health = { ok: false, db: true, redis: true, queue: true, antivirus: true, telegram: true, telegram_upload: true, telegram_download: true, workers: { 'uploads.download': false }, details: { 'uploads.download': { latency_ms: null, last_seen_s: 40.2 } } } as Health
    expect(healthRows(health)[1].rows[0].metric).toBe('нет сигнала 40 с')
  })

  it('counts tasks by status', () => {
    expect(taskCounts({ total: 3, by_status: { done: 2, failed: 1 } })).toEqual({ queued: 0, running: 0, done: 2, failed: 1, cancelled: 0 })
    expect(taskCounts(undefined)).toEqual({ queued: 0, running: 0, done: 0, failed: 0, cancelled: 0 })
  })

  it('merges server storage activity with local io', () => {
    const server = serverIo([{ storage_id: 'a', read: true, write: false }, { storage_id: 'b', read: false, write: false }, { storage_id: 'c', read: true, write: true }])
    expect(server).toEqual({ a: 'read', c: 'both' })
    expect(serverIo(undefined)).toEqual({})
    expect(mergeIo({ a: 'write', d: 'write' }, server)).toEqual({ a: 'both', c: 'both', d: 'write' })
  })

  it('orders dashboard blocks: stored first, then missing ones by default, unknown and duplicates dropped', () => {
    expect(blockOrder(undefined)).toEqual([...DASHBOARD_BLOCKS])
    expect(blockOrder([])).toEqual([...DASHBOARD_BLOCKS])
    expect(blockOrder(['system', 'nope', 'summary', 'system', 3])).toEqual(['system', 'summary', 'previews', 'channels', 'storages', 'tasks', 'activity_map', 'users'])
  })

  it('keeps known unique hidden blocks and hides them from the order', () => {
    expect(hiddenBlocks(undefined)).toEqual([])
    expect(hiddenBlocks(['users', 'nope', 'users', 2])).toEqual(['users'])
    expect(visibleBlocks(blockOrder(['system']), ['users', 'summary'])).toEqual(['system', 'previews', 'channels', 'storages', 'tasks', 'activity_map'])
  })

  it('migrates activity_map = false into hidden blocks only while dashboard_hidden is absent', () => {
    expect(hiddenBlocks(undefined, false)).toEqual(['activity_map'])
    expect(hiddenBlocks(undefined, true)).toEqual([])
    expect(hiddenBlocks([], false)).toEqual([])
    expect(hiddenBlocks(['users'], false)).toEqual(['users'])
  })

  it('moves a block onto another block position', () => {
    const order = blockOrder(undefined)
    expect(moveBlock(order, 'previews', 'summary').slice(0, 3)).toEqual(['previews', 'summary', 'channels'])
    expect(moveBlock(order, 'summary', 'previews').slice(0, 3)).toEqual(['previews', 'summary', 'channels'])
    expect(moveBlock(order, 'summary', 'users').at(-1)).toBe('summary')
    expect(moveBlock(order, 'users', 'summary')[0]).toBe('users')
    expect(moveBlock(order, 'tasks', 'tasks')).toEqual(order)
  })

  it('parses the local layout copy', () => {
    expect(parseLayout('["system"]')).toEqual(['system'])
    expect(parseLayout('{"a":1}')).toBeUndefined()
    expect(parseLayout('{')).toBeUndefined()
    expect(parseLayout(null)).toBeUndefined()
  })
})
