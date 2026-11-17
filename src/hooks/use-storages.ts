import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Storage } from '@/lib/types'

export function useStorages() {
  return useQuery({ queryKey: ['storages'], queryFn: () => api.get<Storage[]>('/storages') })
}
