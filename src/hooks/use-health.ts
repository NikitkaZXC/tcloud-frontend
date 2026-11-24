import { useQuery } from '@tanstack/react-query'
import { api, ApiError, refreshSession } from '@/lib/api'
import type { Health, PublicHealth } from '@/lib/types'

const full = (body: Health | PublicHealth): body is Health => 'workers' in body

export async function fetchHealth(): Promise<Health> {
  const body = await api.get<Health | PublicHealth>('/health')
  if (full(body)) return body
  const again = (await refreshSession()) ? await api.get<Health | PublicHealth>('/health') : body
  if (full(again)) return again
  throw new ApiError(401, { code: 'token_expired', message: 'session expired' })
}

export function useHealth() {
  return useQuery({ queryKey: ['health'], queryFn: fetchHealth, refetchInterval: 15000 })
}
