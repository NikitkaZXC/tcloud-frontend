import { describe, expect, it } from 'vitest'
import { healthChecks, storageTotals, taskCounts } from './dashboard'
import type { Health, Storage, Task } from './types'

describe('dashboard', () => {
  it('sums storages and skips hidden counters', () => {
    const storages = [
      { files: 3, total_size: 100, available: true },
      { files: null, total_size: null, available: false },
      { files: 2, total_size: 400, available: true },
    ] as Storage[]
    expect(storageTotals(storages)).toEqual({ storages: 3, files: 5, size: 500, max: 400, unavailable: 1 })
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
