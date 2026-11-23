import { useSyncExternalStore } from 'react'

export const READ_MS = 5000

export const READ_POKE_MS = 300

export interface Read {
  id: number
  path: string
}

let reads: Read[] = []
let nextId = 0
const listeners = new Set<() => void>()
const pokes = new Set<() => void>()

function setReads(next: Read[]) {
  reads = next
  listeners.forEach((listener) => listener())
}

export function markRead(path: string) {
  const id = ++nextId
  setReads([...reads, { id, path }])
  setTimeout(() => setReads(reads.filter((read) => read.id !== id)), READ_MS)
  setTimeout(() => pokes.forEach((poke) => poke()), READ_POKE_MS)
}

export function onRead(poke: () => void) {
  pokes.add(poke)
  return () => {
    pokes.delete(poke)
  }
}

export function getReads(): Read[] {
  return reads
}

export function useReads(): Read[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getReads,
  )
}
