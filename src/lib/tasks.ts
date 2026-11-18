import { useSyncExternalStore } from 'react'
import type { Task } from './types'

export const TASK_STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  queued: { label: 'в очереди', variant: 'outline' },
  running: { label: 'выполняется', variant: 'secondary' },
  done: { label: 'готово', variant: 'default' },
  failed: { label: 'ошибка', variant: 'destructive' },
  cancelled: { label: 'отменено', variant: 'outline' },
}

export const TASK_STAGE: Record<string, string> = {
  downloading: 'скачивание',
  scanning: 'проверка',
  uploading_tg: 'отправка в Telegram',
  archiving: 'сборка архива',
  done: 'готово',
}

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
