import { useQuery } from '@tanstack/react-query'
import { useEffect, useSyncExternalStore } from 'react'
import { useTasks } from '@/hooks/use-tasks'
import { api } from '@/lib/api'
import { endIo, freshServerIo, IO_FAST_POLL_MS, IO_IDLE_POLL_MS, type Io, type IoSeen, lingerIo, mergeIo, serverIo, storageActivity, storageIo } from '@/lib/dashboard'
import { onRead } from '@/lib/reads'
import { useTrackedTasks } from '@/lib/tasks'
import type { Account, Storage, StorageActivity, Task } from '@/lib/types'
import { useSending } from '@/lib/upload'

export const STORAGES_STALE_MS = 5_000
export const ACCOUNT_STALE_MS = 60_000

export function useStorages() {
  return useQuery({ queryKey: ['storages'], queryFn: () => api.get<Storage[]>('/storages'), staleTime: STORAGES_STALE_MS })
}

export function useAccount() {
  return useQuery({ queryKey: ['account'], queryFn: () => api.get<Account>('/account'), staleTime: ACCOUNT_STALE_MS })
}

function useTrackedData(): Task[] {
  return useTasks(useTrackedTasks())
    .map((result) => result.data)
    .filter((task): task is Task => !!task)
}

export function useStorageActivity(storages: Storage[]) {
  return storageActivity(storages, useSending().filter((item) => !item.cancelled), useTrackedData())
}

let local: Record<string, Io> = {}
let ended: IoSeen = {}
let server: { io: Record<string, Io>; at: number } = { io: {}, at: 0 }
let seen: IoSeen = {}
let lit: Record<string, Io> = {}
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

function publish() {
  const now = Date.now()
  const state = lingerIo(mergeIo(local, freshServerIo(server.io, ended, server.at)), seen, now)
  seen = state.seen
  clearTimeout(timer)
  if (state.wake != null) timer = setTimeout(publish, state.wake - now + 20)
  if (JSON.stringify(state.io) === JSON.stringify(lit)) return
  lit = state.io
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useStorageIo(): Record<string, Io> {
  const storages = useStorages().data ?? []
  const tasks = useTrackedData()
  const sending = useSending().filter((item) => !item.cancelled)
  const key = JSON.stringify(storageIo(storages, storageActivity(storages, sending, tasks), tasks))
  const io = useSyncExternalStore(subscribe, () => lit)
  const response = useQuery({
    queryKey: ['storage-activity'],
    queryFn: () => api.get<StorageActivity[]>('/storages/activity'),
    refetchInterval: Object.keys(io).length ? IO_FAST_POLL_MS : IO_IDLE_POLL_MS,
  })
  const { refetch, data, dataUpdatedAt } = response
  useEffect(() => {
    const next = JSON.parse(key)
    ended = endIo(local, next, ended, Date.now())
    local = next
    publish()
  }, [key])
  useEffect(() => {
    server = { io: serverIo(data), at: dataUpdatedAt }
    publish()
  }, [data, dataUpdatedAt])
  useEffect(() => onRead(() => void refetch({ cancelRefetch: false })), [refetch])
  return io
}
