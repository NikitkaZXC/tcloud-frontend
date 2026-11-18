import { describe, expect, it } from 'vitest'
import { activityGrid, channelUsage, healthChecks, healthGroups, transferStats, IO_HOLD_MS, lingerIo, storageActivity, storageIo, storageTotals, taskCounts } from './dashboard'
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
      { path: 'tcloud/d/old', status: 'done', stage: 'done', archive: { name: 'old.zip' } },
    ] as Task[]
    expect(storageIo(storages, activity, tasks, [{ path: 'tcloud/c/x.jpg' }])).toEqual({ a: 'write', ab: 'read', c: 'both' })
  })

  it('keeps activity visible for a minimum time after it ends', () => {
    let state = lingerIo({ a: 'write' }, {}, 1000)
    expect(state.io).toEqual({ a: 'write' })
    expect(state.wake).toBe(1000 + IO_HOLD_MS)
    state = lingerIo({ b: 'read' }, state.seen, 1500)
    expect(state.io).toEqual({ a: 'write', b: 'read' })
    expect(state.wake).toBe(1000 + IO_HOLD_MS)
    state = lingerIo({ a: 'read' }, state.seen, 2000)
    expect(state.io).toEqual({ a: 'both', b: 'read' })
    state = lingerIo({}, state.seen, 1000 + IO_HOLD_MS)
    expect(state.io).toEqual({ a: 'read', b: 'read' })
    expect(lingerIo({}, state.seen, 2000 + IO_HOLD_MS).io).toEqual({})
  })

  it('wakes to clear an io that ended right after the previous one was stamped', () => {
    const active = lingerIo({ s: 'read' }, {}, 1000)
    const state = lingerIo({}, lingerIo({ s: 'read' }, active.seen, 3000).seen, 3000)
    expect(state.io).toEqual({ s: 'read' })
    expect(state.wake).toBe(3000 + IO_HOLD_MS)
    expect(lingerIo({}, state.seen, state.wake!).io).toEqual({})
  })

  it('matches storage paths at the root, nested and by id', () => {
    const storages = [{ id: 'u1', path: 'tcloud/u1' }] as Storage[]
    const tasks = [{ path: 'tcloud/u1/a.txt', status: 'running', bytes_done: 1, bytes_total: 2 }] as Task[]
    expect(storageActivity(storages, [{ id: 1, path: 'tcloud/u1/x/y.txt', loaded: 0, total: 0, rate: null, at: 0 }], tasks).u1.count).toBe(2)
    expect(storageActivity([{ id: 'u1', path: 'tcloud/u1/' }] as Storage[], [], tasks).u1.count).toBe(1)
  })

  it('sums upload speed and takes the longest eta', () => {
    const sending = [{ id: 1, path: 'a', loaded: 100, total: 1100, rate: 100, at: 0 }]
    const tasks = [
      { status: 'running', speed: 400, eta: 3 },
      { status: 'queued', speed: 999, eta: 999 },
    ] as Task[]
    expect(transferStats(sending, tasks)).toEqual({ speed: 500, eta: 10 })
    expect(transferStats([], [])).toEqual({ speed: 0, eta: null })
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
    expect(channelUsage({ telegram_connected: true, premium: false, file_limit: 1, channels_used: 42, channels_limit: 500 }, 3)).toEqual({ used: 42, limit: 500, accountWide: true })
    expect(channelUsage({ telegram_connected: true, premium: true, file_limit: 1, channels_used: null, channels_limit: 1000 }, 3)).toEqual({ used: 3, limit: 1000, accountWide: false })
    expect(channelUsage({ telegram_connected: false, premium: null, file_limit: null, channels_used: null, channels_limit: null }, 4)).toEqual({ used: 4, limit: 500, accountWide: false })
    expect(channelUsage(undefined, 2)).toEqual({ used: 2, limit: 500, accountWide: false })
  })

  it('lists health checks with workers', () => {
    const health = { ok: false, db: true, redis: true, queue: false, antivirus: true, telegram: true, telegram_upload: true, telegram_download: true, workers: { 'archives.build': false } } as Health
    const checks = healthChecks(health)
    expect(checks).toContainEqual(['queue', false])
    expect(checks).toContainEqual(['archives.build', false])
    expect(checks.find(([key]) => key === 'ok')).toBeUndefined()
  })

  it('groups health checks by component and drops empty groups', () => {
    const health = { ok: true, db: true, redis: true, queue: true, antivirus: true, telegram: true, telegram_upload: false, telegram_download: true, workers: {} } as Health
    const groups = healthGroups(health)
    expect(groups.map((group) => group.id)).toEqual(['telegram', 'infra', 'antivirus'])
    expect(groups[0].checks).toEqual([['telegram', true], ['telegram_upload', false], ['telegram_download', true]])
  })

  it('counts tasks by status', () => {
    expect(taskCounts({ total: 3, by_status: { done: 2, failed: 1 } })).toEqual({ queued: 0, running: 0, done: 2, failed: 1, cancelled: 0 })
    expect(taskCounts(undefined)).toEqual({ queued: 0, running: 0, done: 0, failed: 0, cancelled: 0 })
  })
})
