import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { hydrateSettings } from '@/lib/settings'
import type { Me } from '@/lib/types'

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const me = await api.get<Me>('/users/me')
      hydrateSettings(me.settings)
      return me
    },
  })
}

export function isAdmin(me: Me | undefined): boolean {
  return me?.role === 'root' || me?.role === 'admin'
}
