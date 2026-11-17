import type { Health, Storage, Task, TaskStatus } from './types'
import type { Sending } from './upload'

export const HEALTH_LABELS: Record<string, string> = {
  db: 'база данных',
  redis: 'redis',
  queue: 'очередь',
  antivirus: 'антивирус',
  telegram: 'telegram api',
  telegram_upload: 'telegram upload',
  telegram_download: 'telegram download',
}

export function healthChecks(health: Health): [string, boolean][] {
  return [
    ...Object.keys(HEALTH_LABELS).map((key) => [key, Boolean(health[key as keyof Health])] as [string, boolean]),
    ...Object.entries(health.workers).map(([key, ok]) => [`worker ${key}`, ok] as [string, boolean]),
  ]
}

export function storageTotals(storages: Storage[]) {
  const files = storages.reduce((sum, s) => sum + (s.files ?? 0), 0)
  const size = storages.reduce((sum, s) => sum + (s.total_size ?? 0), 0)
  return { storages: storages.length, files, size, unavailable: storages.filter((s) => !s.available).length }
}

export function taskCounts(tasks: Task[]): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = { queued: 0, running: 0, done: 0, failed: 0, cancelled: 0 }
  for (const task of tasks) counts[task.status]++
  return counts
}

export interface Activity {
  count: number
  percent: number | null
}

export function storageActivity(storages: Storage[], sending: Sending[], tasks: Task[]): Record<string, Activity> {
  const items = [
    ...sending.map((s) => ({ path: s.path, done: s.loaded, total: s.total })),
    ...tasks
      .filter((t) => t.status === 'queued' || t.status === 'running')
      .map((t) => ({ path: t.path, done: t.bytes_done, total: t.status === 'running' ? t.bytes_total : null })),
  ]
  const result: Record<string, Activity> = {}
  for (const storage of storages) {
    const own = items.filter((item) => item.path === storage.path || item.path.startsWith(`${storage.path}/`))
    if (!own.length) continue
    const known = own.filter((item) => item.total)
    const total = known.reduce((sum, item) => sum + (item.total ?? 0), 0)
    const done = known.reduce((sum, item) => sum + item.done, 0)
    result[storage.id] = { count: own.length, percent: total ? Math.min(Math.round((done / total) * 100), 100) : null }
  }
  return result
}
