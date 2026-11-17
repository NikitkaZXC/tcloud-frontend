import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, withQuery } from './api'

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
