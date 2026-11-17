import { describe, expect, it } from 'vitest'
import { healthChecks, storageActivity, storageTotals, taskCounts } from './dashboard'
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
    const sending = [{ id: 1, path: 'tcloud/a/x.txt', loaded: 50, total: 100 }]
    const tasks = [
      { path: 'tcloud/a/b/y.txt', status: 'running', bytes_done: 50, bytes_total: 300 },
      { path: 'tcloud/a/z.txt', status: 'queued', bytes_done: 0, bytes_total: null },
      { path: 'tcloud/a/old.txt', status: 'done', bytes_done: 10, bytes_total: 10 },
      { path: 'tcloud/ab/q.txt', status: 'running', bytes_done: 0, bytes_total: null },
    ] as Task[]
    expect(storageActivity(storages, sending, tasks)).toEqual({ a: { count: 3, percent: 25 }, ab: { count: 1, percent: null } })
  })

  it('lists health checks with workers', () => {
    const health = { ok: false, db: true, redis: true, queue: false, antivirus: true, telegram: true, telegram_upload: true, telegram_download: true, workers: { 'archives.build': false } } as Health
    const checks = healthChecks(health)
    expect(checks).toContainEqual(['queue', false])
    expect(checks.at(-1)).toEqual(['worker archives.build', false])
    expect(checks.find(([key]) => key === 'ok')).toBeUndefined()
  })

  it('counts tasks by status', () => {
    expect(taskCounts([{ status: 'done' }, { status: 'done' }, { status: 'failed' }] as Task[])).toEqual({ queued: 0, running: 0, done: 2, failed: 1, cancelled: 0 })
  })
})
