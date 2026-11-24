import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { api, ApiError } from '@/lib/api'
import { hydrateSettings } from '@/lib/settings'
import { forgetLocalUser } from '@/lib/upload'
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

export function useSignedOut() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return () => {
    forgetLocalUser()
    queryClient.clear()
    navigate('/login')
  }
}

export const logout = () =>
  api.post('/auth/logout').catch((error) => {
    if (!(error instanceof ApiError && error.status === 401)) throw error
  })
