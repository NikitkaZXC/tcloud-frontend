import { useQueries, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { pollInterval, taskLoader } from '@/lib/tasks'
import type { Task, TaskCounts, TaskList } from '@/lib/types'

const loadTask = taskLoader(async (ids) => (await api.get<TaskList>(`/tasks?${ids.map((id) => `ids=${encodeURIComponent(id)}`).join('&')}`)).items)

export const FINISHED = ['done', 'failed', 'cancelled']

export function isFinished(task: Task | undefined): boolean {
  return !!task && FINISHED.includes(task.status)
}

export function useTasks(ids: string[]) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: ['task', id],
      queryFn: () => loadTask(id),
      refetchInterval: (query: { state: { data?: Task } }) => (isFinished(query.state.data) ? false : pollInterval(query.state.data?.status)),
      staleTime: (query: { state: { data?: Task } }) => (isFinished(query.state.data) ? Infinity : 0),
    })),
  })
}

export function useTaskCounts() {
  return useQuery({ queryKey: ['task-counts'], queryFn: () => api.get<TaskCounts>('/tasks/counts'), refetchInterval: 5000 })
}
