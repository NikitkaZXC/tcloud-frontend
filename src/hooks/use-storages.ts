import { useQuery } from '@tanstack/react-query'
import { useEffect, useSyncExternalStore } from 'react'
import { useTasks } from '@/hooks/use-tasks'
import { api } from '@/lib/api'
import { type Io, type IoSeen, lingerIo, mergeIo, serverIo, storageActivity, storageIo } from '@/lib/dashboard'
import { useReads } from '@/lib/reads'
import { useTrackedTasks } from '@/lib/tasks'
import type { Storage, StorageActivity, Task } from '@/lib/types'
import { useSending } from '@/lib/upload'

export function useStorages() {
  return useQuery({ queryKey: ['storages'], queryFn: () => api.get<Storage[]>('/storages') })
}

function useTrackedData(): Task[] {
  return useTasks(useTrackedTasks())
    .map((result) => result.data)
    .filter((task): task is Task => !!task)
}

export function useStorageActivity(storages: Storage[]) {
  return storageActivity(storages, useSending().filter((item) => !item.cancelled), useTrackedData())
}

let seen: IoSeen = {}
let active: Record<string, Io> = {}
let lingering: Record<string, Io> = {}
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

function publish(current: Record<string, Io>) {
  const now = Date.now()
  const state = lingerIo(current, lingerIo(active, seen, now).seen, now)
  seen = state.seen
  active = current
  clearTimeout(timer)
  if (state.wake != null) timer = setTimeout(() => publish(active), state.wake - now + 50)
  if (JSON.stringify(state.io) === JSON.stringify(lingering)) return
  lingering = state.io
  listeners.forEach((listener) => listener())
}

export function useStorageIo(storages: Storage[]): Record<string, Io> {
  const tasks = useTrackedData()
  const local = storageIo(storages, storageActivity(storages, useSending(), tasks), tasks, useReads())
  const server = useQuery({ queryKey: ['storage-activity'], queryFn: () => api.get<StorageActivity[]>('/storages/activity'), refetchInterval: 2500 })
  const current = mergeIo(local, serverIo(server.data))
  const key = JSON.stringify(current)
  useEffect(() => publish(JSON.parse(key)), [key])
  const io = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => lingering,
  )
  return mergeIo(io, current)
}
