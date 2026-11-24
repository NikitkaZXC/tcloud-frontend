import { afterEach, describe, expect, it, vi } from 'vitest'
import { healthRows } from '@/lib/dashboard'
import { fetchHealth } from './use-health'

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const full = { ok: true, db: true, telegram: true, telegram_upload: true, telegram_download: true, antivirus: true, redis: true, queue: true, workers: {} }

afterEach(() => vi.unstubAllGlobals())

describe('fetchHealth', () => {
  it('refreshes the session and retries when the public body comes back', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json(200, { status: 'ok' })).mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(json(200, full))
    vi.stubGlobal('fetch', fetch)
    const health = await fetchHealth()
    expect(fetch.mock.calls.map((c) => c[0])).toEqual(['/api/health', '/api/auth/refresh', '/api/health'])
    expect(() => healthRows(health)).not.toThrow()
  })

  it('throws a 401 when the refresh fails instead of returning the public body', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json(200, { status: 'ok' })).mockResolvedValueOnce(json(401, {}))
    vi.stubGlobal('fetch', fetch)
    await expect(fetchHealth()).rejects.toMatchObject({ status: 401, code: 'token_expired' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('returns the full report without extra calls', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, full))
    vi.stubGlobal('fetch', fetch)
    await expect(fetchHealth()).resolves.toEqual(full)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
