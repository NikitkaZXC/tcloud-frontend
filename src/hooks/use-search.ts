import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { hasCriteria, type SearchState, searchQuery } from '@/lib/search'
import type { MimeCount, SearchResult } from '@/lib/types'

export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return debounced
}

export function useSearch(state: SearchState, limit = 50) {
  const key = searchQuery(state, 0, limit)
  return useInfiniteQuery({
    queryKey: ['search', key],
    queryFn: ({ pageParam }) => api.get<SearchResult>(`/files/search?${searchQuery(state, pageParam, limit)}`),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.has_more ? last.offset + last.limit : undefined),
    enabled: hasCriteria(state),
    retry: false,
  })
}

export function useMimes(path: string | undefined) {
  return useQuery({
    queryKey: ['mimes', path ?? ''],
    queryFn: () => api.get<MimeCount[]>('/files/search/mimes', path ? { path } : undefined),
    retry: false,
    staleTime: 60000,
  })
}
