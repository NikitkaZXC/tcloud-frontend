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
const listeners = new Set<() => void>()

function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

let ids = read()

function write(next: string[]) {
  ids = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    return
  } finally {
    listeners.forEach((listener) => listener())
  }
}

export function trackTask(id: string) {
  if (!ids.includes(id)) write([id, ...ids])
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
