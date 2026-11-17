import { useQuery } from '@tanstack/react-query'
import { useTasks } from '@/hooks/use-tasks'
import { api } from '@/lib/api'
import { storageActivity } from '@/lib/dashboard'
import { useTrackedTasks } from '@/lib/tasks'
import type { Storage, Task } from '@/lib/types'
import { useSending } from '@/lib/upload'

export function useStorages() {
  return useQuery({ queryKey: ['storages'], queryFn: () => api.get<Storage[]>('/storages') })
}

export function useStorageActivity(storages: Storage[]) {
  const sending = useSending()
  const tasks = useTasks(useTrackedTasks())
    .map((result) => result.data)
    .filter((task): task is Task => !!task)
  return storageActivity(storages, sending, tasks)
}
