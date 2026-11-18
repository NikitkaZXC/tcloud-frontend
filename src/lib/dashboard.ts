import type { Account, Health, Storage, Task, TaskStatus } from './types'
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

const trim = (path: string) => path.replace(/^\/+|\/+$/g, '')

function inside(storage: Storage, path: string): boolean {
  const base = trim(storage.path)
  const target = trim(path)
  return target === base || target.startsWith(`${base}/`) || target.split('/')[1] === storage.id
}

export function storageActivity(storages: Storage[], sending: Sending[], tasks: Task[]): Record<string, Activity> {
  const items = [
    ...sending.map((s) => ({ path: s.path, done: s.loaded, total: s.total })),
    ...tasks
      .filter((t) => !t.archive && (t.status === 'queued' || t.status === 'running'))
      .map((t) => ({ path: t.path, done: t.bytes_done, total: t.status === 'running' ? t.bytes_total : null })),
  ]
  const result: Record<string, Activity> = {}
  for (const storage of storages) {
    const own = items.filter((item) => inside(storage, item.path))
    if (!own.length) continue
    const known = own.filter((item) => item.total)
    const total = known.reduce((sum, item) => sum + (item.total ?? 0), 0)
    const done = known.reduce((sum, item) => sum + item.done, 0)
    result[storage.id] = { count: own.length, percent: total ? Math.min(Math.round((done / total) * 100), 100) : null }
  }
  return result
}

export type Io = 'write' | 'read' | 'both'

export function storageIo(storages: Storage[], activity: Record<string, Activity>, tasks: Task[], reads: { path: string }[]): Record<string, Io> {
  const readPaths = [
    ...reads.map((read) => read.path),
    ...tasks.filter((t) => t.archive && t.status === 'running' && t.stage === 'archiving').map((t) => t.path),
  ]
  const result: Record<string, Io> = {}
  for (const storage of storages) {
    const write = !!activity[storage.id]
    const read = readPaths.some((path) => inside(storage, path))
    if (write || read) result[storage.id] = write && read ? 'both' : write ? 'write' : 'read'
  }
  return result
}

export interface ChannelUsage {
  used: number
  limit: number
  accountWide: boolean
}

export function channelUsage(account: Account | undefined, storages: number): ChannelUsage {
  const limit = account?.channels_limit ?? (account?.premium ? 1000 : 500)
  if (account?.channels_used != null) return { used: account.channels_used, limit, accountWide: true }
  return { used: storages, limit, accountWide: false }
}

export const IO_HOLD_MS = 3000

export type IoSeen = Record<string, { write?: number; read?: number }>

export function lingerIo(current: Record<string, Io>, seen: IoSeen, now: number, hold = IO_HOLD_MS) {
  const next: IoSeen = {}
  for (const [id, last] of Object.entries(seen)) {
    const write = last.write != null && now - last.write < hold ? last.write : undefined
    const read = last.read != null && now - last.read < hold ? last.read : undefined
    if (write != null || read != null) next[id] = { write, read }
  }
  for (const [id, io] of Object.entries(current)) {
    next[id] = {
      write: io === 'write' || io === 'both' ? now : next[id]?.write,
      read: io === 'read' || io === 'both' ? now : next[id]?.read,
    }
  }
  const io: Record<string, Io> = {}
  let wake: number | null = null
  for (const [id, { write, read }] of Object.entries(next)) {
    io[id] = write != null && read != null ? 'both' : write != null ? 'write' : 'read'
    for (const at of [write, read]) if (at != null && at < now) wake = Math.min(wake ?? Infinity, at + hold)
  }
  return { io, seen: next, wake }
}
