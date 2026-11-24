import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api'
import '@/test-utils'
import { useAction } from './use-action'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

afterEach(() => vi.clearAllMocks())

function setup<T>(fn: () => Promise<T>, options: Parameters<typeof useAction<void, T>>[1]) {
  const client = new QueryClient()
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const { result } = renderHook(() => useAction(fn, options), { wrapper })
  return { result, invalidate }
}

describe('useAction', () => {
  it('invalidates every key, toasts success and passes the result on', async () => {
    const done = vi.fn()
    const { result, invalidate } = setup(async () => 7, { invalidate: [['storages'], ['account']], success: 'ok', onSuccess: done })
    act(() => result.current.mutate())
    await waitFor(() => expect(done).toHaveBeenCalledWith(7))
    expect(invalidate.mock.calls.map(([filter]) => filter?.queryKey)).toEqual([['storages'], ['account']])
    expect(toast.success).toHaveBeenCalledWith('ok')
  })

  it('toasts a translated error but leaves 429 to the shared toast', async () => {
    const { result } = setup(() => Promise.reject(new ApiError(404, { code: 'file_not_found', message: 'x' })), {})
    act(() => result.current.mutate())
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Файл не найден'))
    const limited = setup(() => Promise.reject(new ApiError(429, { code: 'rate_limited', message: 'x', retry_after: 3 })), {})
    act(() => limited.result.current.mutate())
    await waitFor(() => expect(limited.result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledTimes(1)
  })
})
