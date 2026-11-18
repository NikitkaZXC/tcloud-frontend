import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { FileActivity } from '@/lib/dashboard'

export function useFileActivity(path?: string) {
  return useQuery({
    queryKey: ['activity', path ?? ''],
    queryFn: () => api.get<FileActivity>('/files/activity', path ? { path } : undefined),
    retry: false,
  })
}
