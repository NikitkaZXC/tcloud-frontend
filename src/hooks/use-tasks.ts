import { useQueries } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Task } from '@/lib/types'

export const FINISHED = ['done', 'failed', 'cancelled']

export function isFinished(task: Task | undefined): boolean {
  return !!task && FINISHED.includes(task.status)
}

export function useTasks(ids: string[]) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: ['task', id],
      queryFn: () => api.get<Task>(`/tasks/${id}`),
      refetchInterval: (query: { state: { data?: Task } }) => (isFinished(query.state.data) ? false : 1500),
    })),
  })
}
