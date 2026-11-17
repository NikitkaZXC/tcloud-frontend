import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Me } from '@/lib/types'

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: () => api.get<Me>('/users/me') })
}

export function isAdmin(me: Me | undefined): boolean {
  return me?.role === 'root' || me?.role === 'admin'
}
