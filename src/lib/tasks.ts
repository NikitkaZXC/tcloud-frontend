import { useSyncExternalStore } from 'react'

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
