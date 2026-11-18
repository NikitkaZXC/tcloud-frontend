import { useSyncExternalStore } from 'react'
import { type Key, t } from './i18n'
import type { Task } from './types'

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
