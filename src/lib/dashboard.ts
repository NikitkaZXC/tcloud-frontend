import type { Health, Storage, Task, TaskStatus } from './types'

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
  const max = storages.reduce((top, s) => Math.max(top, s.total_size ?? 0), 0)
  return { storages: storages.length, files, size, max, unavailable: storages.filter((s) => !s.available).length }
}

export function taskCounts(tasks: Task[]): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = { queued: 0, running: 0, done: 0, failed: 0, cancelled: 0 }
  for (const task of tasks) counts[task.status]++
  return counts
}
