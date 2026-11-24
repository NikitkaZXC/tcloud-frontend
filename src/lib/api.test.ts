import { toast } from 'sonner'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, errorMessage, queryRetry, queryRetryDelay, RATE_LIMIT_TOAST, retryAfter, showError, withQuery } from './api'

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

  it('shows the backend message and field for 422 instead of the status line', async () => {
    const body = { error: { code: 'validation_error', message: 'invalid request', details: [{ type: 'missing', loc: ['body', 'uploads', 'priority'], msg: 'Field required' }] } }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(422, body)))
    expect(errorMessage(await api.patch('/account/settings', {}).catch((e) => e))).toBe('Поле «uploads.priority»: Field required')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(422, { detail: [{ loc: ['query', 'limit'], msg: 'Input should be 20' }] })))
    expect(errorMessage(await api.get('/folders').catch((e) => e))).toBe('Поле «limit»: Input should be 20')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(422, { error: { code: 'http_error', message: 'Bad path' } })))
    expect(errorMessage(await api.get('/folders').catch((e) => e))).toBe('Bad path')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(422, { error: { code: 'validation_error', message: 'invalid request', details: [] } })))
    expect(errorMessage(await api.get('/folders').catch((e) => e))).toBe('Проверьте введённые данные')
  })

  it('does not refresh for auth calls', async () => {
    const fetch = vi.fn().mockResolvedValue(json(401, { error: { code: 'invalid_credentials', message: 'bad' } }))
    vi.stubGlobal('fetch', fetch)
    await expect(api.post('/auth/signin', {})).rejects.toBeInstanceOf(ApiError)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('refreshes and repeats other /auth/* calls on 401', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(401, { error: { code: 'token_expired', message: 'x' } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json(200, []))
    vi.stubGlobal('fetch', fetch)
    await expect(api.get('/auth/sessions')).resolves.toEqual([])
    expect(fetch.mock.calls.map((c) => c[0])).toEqual(['/api/auth/sessions', '/api/auth/refresh', '/api/auth/sessions'])
    for (const url of ['/auth/refresh', '/auth/logout']) {
      const once = vi.fn().mockResolvedValue(json(401, { error: { code: 'token_expired', message: 'x' } }))
      vi.stubGlobal('fetch', once)
      await expect(api.post(url)).rejects.toMatchObject({ status: 401 })
      expect(once).toHaveBeenCalledTimes(1)
    }
  })

  it('drops undefined query values', () => {
    expect(withQuery('/a', { path: 'tcloud/x y', b: undefined, c: false })).toBe('/a?path=tcloud%2Fx+y&c=false')
  })
})

describe('quota errors', () => {
  afterEach(() => vi.mocked(toast.error).mockClear())

  it('formats counts, bytes and durations from the error body', () => {
    const send = new ApiError(429, { code: 'send_quota_exceeded', message: 'x', retry_after: 42, limit: 30, window: 60 })
    expect(errorMessage(send)).toBe('Лимит отправок в Telegram: 30 за 1:00 — повторите через 0:42')
    expect(errorMessage(new ApiError(429, { code: 'too_many_upload_sessions', message: 'x', limit: 10 }))).toBe('Слишком много незаконченных загрузок (не больше 10) — завершите или отмените часть')
    expect(errorMessage(new ApiError(507, { code: 'temp_quota_exceeded', message: 'x', limit: 1024 ** 3, used: 512 * 1024 ** 2 }))).toBe('Ваше место для временных файлов занято: 512,0 MB из 1,0 GB — дождитесь окончания загрузок')
    expect(errorMessage(new ApiError(413, { code: 'body_too_large', message: 'x', limit: 1048576 }))).toBe('Запрос слишком большой для сервера')
  })

  it('shows quota 429s as their own error, not the shared rate limit toast', async () => {
    const body = { error: { code: 'send_quota_exceeded', message: 'x', retry_after: 42, limit: 30, window: 60 } }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 429, headers: { 'Retry-After': '42' } })))
    const error = await api.post('/uploads/from-url', {}).catch((e) => e)
    expect(toast.error).not.toHaveBeenCalled()
    expect(retryAfter(error)).toBeNull()
    expect(queryRetry(0, error)).toBe(false)
    showError(error)
    expect(toast.error).toHaveBeenCalledWith('Лимит отправок в Telegram: 30 за 1:00 — повторите через 0:42')
  })

  it('reads a proxy 413 without a JSON body as body_too_large', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>413</html>', { status: 413, statusText: 'Request Entity Too Large' })))
    expect((await api.post('/folders/archive/selection', {}).catch((e) => e)).code).toBe('body_too_large')
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
    await api.post('/auth/password', {}).catch(() => null)
    expect(toast.error).toHaveBeenCalledWith('Слишком много запросов — повторите через 12 с', { id: RATE_LIMIT_TOAST })
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
