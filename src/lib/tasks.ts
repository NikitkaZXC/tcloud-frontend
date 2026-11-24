import { useSyncExternalStore } from 'react'
import { ApiError } from './api'
import { formatBytes, parentPath } from './format'
import { DICTIONARIES, type Key, t } from './i18n'
import type { Task, TaskWaiting, TaskWarning } from './types'

export const TASK_STATUS: Record<string, { label: Key; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  queued: { label: 'status.queued', variant: 'outline' },
  running: { label: 'status.running', variant: 'secondary' },
  done: { label: 'status.done', variant: 'default' },
  failed: { label: 'status.failed', variant: 'destructive' },
  cancelled: { label: 'status.cancelled', variant: 'outline' },
}

export const TASK_STAGE: Record<string, Key> = {
  downloading: 'stage.downloading',
  scanning: 'stage.scanning',
  uploading_tg: 'stage.uploadingTg',
  archiving: 'stage.archiving',
  done: 'stage.done',
}

export const statusLabel = (status: string) => (TASK_STATUS[status] ? t(TASK_STATUS[status].label) : status)

export const stageLabel = (stage: string) => (TASK_STAGE[stage] ? t(TASK_STAGE[stage]) : stage)

const KEY = 'tcloud.tasks'
const PENDING_KEY = 'tcloud.tasks.pending'
const listeners = new Set<() => void>()

function read(key: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]')
  } catch {
    return []
  }
}

let ids = read(KEY)
let pending = read(PENDING_KEY)

globalThis.addEventListener?.('storage', (event) => {
  if (event.key !== KEY && event.key !== PENDING_KEY) return
  ids = read(KEY)
  pending = read(PENDING_KEY)
  listeners.forEach((listener) => listener())
})

function write(next: string[], nextPending = pending) {
  ids = next
  pending = nextPending.filter((id) => next.includes(id))
  try {
    localStorage.setItem(KEY, JSON.stringify(ids))
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending))
  } catch {
    return
  } finally {
    listeners.forEach((listener) => listener())
  }
}

function codeText(key: string, params: TaskWarning['params'], fallback: string): string {
  if (!(key in DICTIONARIES.ru)) return fallback
  return t(key as Key, { ...params, ...('count' in params && { n: params.count }), ...(typeof params.limit === 'number' && { limit: formatBytes(params.limit) }) })
}

export const warningText = (warning: TaskWarning) => codeText(`taskWarning.${warning.code}`, warning.params, warning.message)

export const waitingText = (waiting: TaskWaiting) =>
  codeText(waiting.code === 'queue' ? `taskWaiting.queue.${waiting.params.queue}` : `taskWaiting.${waiting.code}`, waiting.params, waiting.reason)

export const TASKS_PER_REQUEST = 100

type Waiter = { resolve: (task: Task) => void; reject: (error: unknown) => void }

export function taskLoader(fetchMany: (ids: string[]) => Promise<Task[]>, wait = 10) {
  let queue = new Map<string, Waiter[]>()
  let timer: ReturnType<typeof setTimeout> | undefined
  const flush = () => {
    const batch = queue
    queue = new Map()
    timer = undefined
    const ids = [...batch.keys()]
    for (let i = 0; i < ids.length; i += TASKS_PER_REQUEST) {
      const chunk = ids.slice(i, i + TASKS_PER_REQUEST)
      fetchMany(chunk).then(
        (tasks) => {
          const found = new Map(tasks.map((task) => [task.id, task]))
          for (const id of chunk) {
            const task = found.get(id)
            const gone = new ApiError(404, { code: 'task_not_found', message: 'Task not found' })
            batch.get(id)!.forEach((waiter) => (task ? waiter.resolve(task) : waiter.reject(gone)))
          }
        },
        (error) => chunk.forEach((id) => batch.get(id)!.forEach((waiter) => waiter.reject(error))),
      )
    }
  }
  return (id: string) =>
    new Promise<Task>((resolve, reject) => {
      queue.set(id, [...(queue.get(id) ?? []), { resolve, reject }])
      timer ??= setTimeout(flush, wait)
    })
}

export const pollInterval = (status: string | undefined) => (status === 'queued' ? 5000 : 1000)

export const MAX_TASKS = 50

export function capTasks(list: string[], keep: string[], max = MAX_TASKS): string[] {
  const next = [...list]
  for (let i = next.length - 1; next.length > max && i >= 0; i--) if (!keep.includes(next[i])) next.splice(i, 1)
  return next.slice(0, max)
}

export function trackTask(id: string) {
  const nextPending = pending.includes(id) ? pending : [...pending, id]
  write(capTasks(ids.includes(id) ? ids : [id, ...ids], nextPending), nextPending)
}

export function isPending(id: string): boolean {
  return pending.includes(id)
}

export function reportTask(id: string, forget = false) {
  write(forget ? ids.filter((x) => x !== id) : ids, pending.filter((x) => x !== id))
}

export function forgetTask(id: string) {
  write(ids.filter((x) => x !== id))
}

export function clearTasks() {
  write([], [])
}

export function forgetTasks(remove: string[]) {
  write(ids.filter((x) => !remove.includes(x)))
}

export function useTrackedTasks(): string[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => ids,
  )
}

export function taskFraction(task: Pick<Task, 'progress'>): number | null {
  return task.progress == null ? null : Math.min(Math.max(task.progress / 100, 0), 1)
}

export function taskFolders(tasks: Pick<Task, 'path' | 'archive'>[]): string[] {
  const folders = new Set<string>()
  for (const task of tasks) {
    if (task.archive) continue
    for (let path = parentPath(task.path); path; path = parentPath(path)) folders.add(path)
  }
  return [...folders]
}
