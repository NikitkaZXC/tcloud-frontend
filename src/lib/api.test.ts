import { toast } from 'sonner'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, queryRetry, queryRetryDelay, RATE_LIMIT_TOAST, retryAfter, showError, withQuery } from './api'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => vi.unstubAllGlobals())

describe('api', () => {
  it('refreshes once on 401 and repeats the request', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(401, { error: { code: 'unauthorized', message: 'no' } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json(200, { ok: true }))
    vi.stubGlobal('fetch', fetch)
    await expect(api.get('/users/me')).resolves.toEqual({ ok: true })
    expect(fetch.mock.calls.map((c) => c[0])).toEqual(['/api/users/me', '/api/auth/refresh', '/api/users/me'])
  })

  it('raises the backend error code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(409, { error: { code: 'file_changed', message: 'changed' } })))
    const error = await api.del('/files/x').catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect([error.status, error.code]).toEqual([409, 'file_changed'])
  })

  it('does not refresh for auth calls', async () => {
    const fetch = vi.fn().mockResolvedValue(json(401, { error: { code: 'invalid_credentials', message: 'bad' } }))
    vi.stubGlobal('fetch', fetch)
    await expect(api.post('/auth/signin', {})).rejects.toBeInstanceOf(ApiError)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('drops undefined query values', () => {
    expect(withQuery('/a', { path: 'tcloud/x y', b: undefined, c: false })).toBe('/a?path=tcloud%2Fx+y&c=false')
  })
})

describe('rate limit', () => {
  afterEach(() => vi.mocked(toast.error).mockClear())

  const limited = (body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status: 429, headers: { 'Content-Type': 'application/json', ...headers } })

  it('shows one deduplicated toast with retry_after and skips the generic error toast', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(limited({ error: { code: 'rate_limited', message: 'slow', retry_after: 7 } }, { 'Retry-After': '7' })))
    const error = await api.get('/files').catch((e) => e)
    await api.get('/files').catch(() => null)
    expect(retryAfter(error)).toBe(7)
    expect(vi.mocked(toast.error).mock.calls).toEqual([
      ['Слишком много запросов — повторите через 7 с', { id: RATE_LIMIT_TOAST }],
      ['Слишком много запросов — повторите через 7 с', { id: RATE_LIMIT_TOAST }],
    ])
    showError(error)
    expect(toast.error).toHaveBeenCalledTimes(2)
  })

  it('falls back to the Retry-After header and leaves sign-in errors to the form', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(limited({ detail: 'x' }, { 'Retry-After': '12' })))
    expect(retryAfter(await api.get('/tasks/counts').catch((e) => e))).toBe(12)
    vi.mocked(toast.error).mockClear()
    await api.post('/auth/signin', {}).catch(() => null)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('retries a 429 query only after retry_after seconds', () => {
    const error = new ApiError(429, { code: 'rate_limited', message: 'x', retry_after: 30 })
    expect(queryRetry(0, error)).toBe(true)
    expect(queryRetry(3, error)).toBe(false)
    expect(queryRetryDelay(0, error)).toBe(30000)
    expect(queryRetry(0, new ApiError(404, { code: 'not_found', message: 'x' }))).toBe(false)
    expect(queryRetry(1, new ApiError(500, { code: 'x', message: 'x' }))).toBe(true)
    expect(queryRetryDelay(1, new TypeError('net'))).toBe(2000)
    expect(retryAfter(new ApiError(409, { code: 'x', message: 'x' }))).toBeNull()
  })
})
