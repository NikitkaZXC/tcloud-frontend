import type { Account, Health, HealthDetail, Storage, StorageActivity, Task, TaskCounts, TaskStatus } from './types'
import { type Key, t } from './i18n'
import type { Sending } from './upload'

export type HealthGroup = 'telegram' | 'workers' | 'infra'

type Check = [key: string, name?: Key, hint?: Key]

export const HEALTH_GROUPS: { id: HealthGroup; inline?: boolean; checks: Check[] }[] = [
  {
    id: 'telegram',
    checks: [
      ['telegram', 'health.name.telegram', 'health.hint.telegram'],
      ['telegram_upload', 'health.name.telegram_upload', 'health.hint.telegram_upload'],
      ['telegram_download', 'health.name.telegram_download', 'health.hint.telegram_download'],
    ],
  },
  {
    id: 'workers',
    checks: [
      ['uploads.download', 'health.name.uploads.download', 'health.hint.uploads.download'],
      ['uploads.prepare', 'health.name.uploads.prepare', 'health.hint.uploads.prepare'],
      ['uploads.telegram', 'health.name.uploads.telegram', 'health.hint.uploads.telegram'],
      ['archives.build', 'health.name.archives.build', 'health.hint.archives.build'],
    ],
  },
  {
    id: 'infra',
    inline: true,
    checks: [
      ['db', 'health.name.db', 'health.hint.db'],
      ['redis', 'health.name.redis', 'health.hint.redis'],
      ['queue', 'health.name.queue', 'health.hint.queue'],
      ['antivirus', 'health.name.antivirus', 'health.hint.antivirus'],
    ],
  },
]

export interface HealthRow {
  key: string
  ok: boolean
  name: string
  hint: string
  metric: string
}

const ms = (value: number) => t('health.ms', { n: value < 1 ? '<1' : Math.round(value) })

function metric(key: string, ok: boolean, worker: boolean, detail: HealthDetail | undefined): string {
  const seen = detail?.last_seen_s
  if (!ok) return worker ? (seen != null ? t('health.noSignalFor', { n: Math.round(seen) }) : t('health.noSignal')) : t('health.down')
  if (key.startsWith('telegram')) return 'ok'
  if (detail?.latency_ms != null) return ms(detail.latency_ms)
  if (seen != null) return t('health.ago', { n: Math.round(seen) })
  return 'ok'
}

export function healthRows(health: Health): { id: HealthGroup; inline: boolean; rows: HealthRow[] }[] {
  return HEALTH_GROUPS.map(({ id, inline, checks }) => {
    const listed = id === 'workers' ? checks.filter(([key]) => key in health.workers) : checks
    const extra: Check[] = id === 'workers' ? Object.keys(health.workers).filter((key) => !checks.some(([listedKey]) => listedKey === key)).map((key) => [key]) : []
    const rows = [...listed, ...extra].map(([key, name, hint]) => {
      const worker = key in health.workers
      const ok = worker ? health.workers[key] : Boolean(health[key as keyof Health])
      return { key, ok, name: name ? t(name) : key, hint: hint ? t(hint) : '', metric: metric(key, ok, worker, health.details?.[key]) }
    })
    return { id, inline: !!inline, rows }
  }).filter((group) => group.rows.length > 0)
}

export function storageTotals(storages: Storage[]) {
  const files = storages.reduce((sum, s) => sum + (s.files ?? 0), 0)
  const size = storages.reduce((sum, s) => sum + (s.total_size ?? 0), 0)
  return { storages: storages.length, files, size, unavailable: storages.filter((s) => s.available === false).length }
}

export function previewTotals(storages: Storage[]) {
  const reported = storages.filter((s) => s.preview_count !== undefined)
  if (!reported.length) return null
  return { count: reported.reduce((sum, s) => sum + (s.preview_count ?? 0), 0), bytes: reported.reduce((sum, s) => sum + (s.preview_bytes ?? 0), 0) }
}

export function taskCounts(counts: TaskCounts | undefined): Record<TaskStatus, number> {
  return { queued: 0, running: 0, done: 0, failed: 0, cancelled: 0, ...counts?.by_status }
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

export function serverIo(activity: StorageActivity[] = []): Record<string, Io> {
  const result: Record<string, Io> = {}
  for (const { storage_id, read, write } of activity) if (read || write) result[storage_id] = read && write ? 'both' : write ? 'write' : 'read'
  return result
}

export function mergeIo(...maps: Record<string, Io>[]): Record<string, Io> {
  const result: Record<string, Io> = {}
  for (const map of maps) for (const [id, io] of Object.entries(map)) result[id] = result[id] && result[id] !== io ? 'both' : io
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
    for (const at of [write, read]) if (at != null && at <= now) wake = Math.min(wake ?? Infinity, at + hold)
  }
  return { io, seen: next, wake }
}

export interface Transfer {
  speed: number
  eta: number | null
}

export function transferStats(sending: Sending[], tasks: Task[]): Transfer {
  const running = tasks.filter((task) => task.status === 'running')
  const speed = sending.reduce((sum, item) => sum + (item.rate ?? 0), 0) + running.reduce((sum, task) => sum + (task.speed ?? 0), 0)
  const etas = [
    ...sending.filter((item) => item.rate).map((item) => (item.total - item.loaded) / item.rate!),
    ...running.filter((task) => task.eta != null).map((task) => task.eta!),
  ]
  return { speed, eta: etas.length ? Math.max(...etas) : null }
}

export interface ActivityDay {
  date: string
  files: number
  size: number
}

export interface FileActivity {
  since: string
  until: string
  days: number
  files: number
  size: number
  items: ActivityDay[]
}

export interface ActivityCell extends ActivityDay {
  level: 0 | 1 | 2 | 3 | 4
}

const DAY = 86400000

export function activityGrid(items: ActivityDay[], until: string, days = 365): ActivityCell[][] {
  const end = Date.parse(`${until}T00:00:00Z`)
  const byDate = new Map(items.map((item) => [item.date, item]))
  const max = Math.max(0, ...items.map((item) => item.files))
  const first = end - (days - 1) * DAY
  const start = first - ((new Date(first).getUTCDay() + 6) % 7) * DAY
  const weeks: ActivityCell[][] = []
  for (let t = start; t <= end; t += DAY) {
    const date = new Date(t).toISOString().slice(0, 10)
    const day = byDate.get(date)
    const files = t < first ? 0 : (day?.files ?? 0)
    const level = files === 0 || !max ? 0 : (Math.min(Math.ceil((files / max) * 4), 4) as 1 | 2 | 3 | 4)
    if ((t - start) % (7 * DAY) === 0) weeks.push([])
    weeks.at(-1)!.push({ date, files, size: t < first ? 0 : (day?.size ?? 0), level })
  }
  return weeks
}

export const DASHBOARD_BLOCKS = ['summary', 'previews', 'channels', 'storages', 'tasks', 'activity_map', 'system', 'users'] as const
export type DashboardBlock = (typeof DASHBOARD_BLOCKS)[number]

export function blockOrder(stored: readonly unknown[] | undefined): DashboardBlock[] {
  const known = [...new Set((stored ?? []).filter((id): id is DashboardBlock => DASHBOARD_BLOCKS.includes(id as DashboardBlock)))]
  return [...known, ...DASHBOARD_BLOCKS.filter((id) => !known.includes(id))]
}

export function hiddenBlocks(stored: readonly unknown[] | undefined, activityMap?: unknown): DashboardBlock[] {
  const known = [...new Set((stored ?? []).filter((id): id is DashboardBlock => DASHBOARD_BLOCKS.includes(id as DashboardBlock)))]
  return stored === undefined && activityMap === false ? ['activity_map'] : known
}

export function visibleBlocks(order: DashboardBlock[], hidden: readonly DashboardBlock[]): DashboardBlock[] {
  return order.filter((id) => !hidden.includes(id))
}

export function moveBlock(order: DashboardBlock[], id: DashboardBlock, to: DashboardBlock): DashboardBlock[] {
  const index = order.indexOf(to)
  const rest = order.filter((block) => block !== id)
  rest.splice(index, 0, id)
  return rest
}

export function parseLayout(raw: string | null): unknown[] | undefined {
  try {
    const value = JSON.parse(raw ?? 'null')
    return Array.isArray(value) ? value : undefined
  } catch {
    return undefined
  }
}
