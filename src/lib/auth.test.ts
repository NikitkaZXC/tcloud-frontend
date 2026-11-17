import { describe, expect, it } from 'vitest'
import { ApiError } from './api'
import { activeSession, describeError, nextSession, qrExpired, retryAfterOf } from './auth'
import type { TelegramSessionState } from './types'

const state = (session: TelegramSessionState['session'], authorized: boolean): TelegramSessionState => ({ session, authorized, login: null })

describe('auth errors', () => {
  it('maps backend codes and keeps retry_after', () => {
    const locked = new ApiError(429, { code: 'account_locked', message: 'x', retry_after: 300 })
    expect(describeError(locked)).toMatch(/заблокирован/)
    expect(retryAfterOf(locked)).toBe(300)
    expect(describeError(new ApiError(401, { code: 'invalid_credentials', message: 'x' }))).toBe('Неверный логин или пароль')
    expect(describeError(new ApiError(418, { code: 'odd', message: 'raw' }))).toBe('raw')
    expect(describeError(new ApiError(502, { code: 'http_error', message: '502' }))).toMatch(/Сервер/)
    expect(describeError(new TypeError('Failed to fetch'))).toBe('Нет связи с сервером')
    expect(retryAfterOf(new ApiError(401, { code: 'invalid_credentials', message: 'x' }))).toBeNull()
  })
})

describe('telegram wizard', () => {
  it('walks sessions in order and skips authorized ones', () => {
    const sessions = [state('api', true), state('upload', false), state('download', false)]
    expect(nextSession(sessions)).toBe('upload')
    expect(activeSession(sessions, 'download')).toBe('download')
    expect(activeSession(sessions, 'api')).toBe('upload')
    expect(nextSession(sessions.map((s) => ({ ...s, authorized: true })))).toBeNull()
  })

  it('asks for a new QR when the old one is gone', () => {
    const now = Date.parse('2026-01-01T00:00:00Z')
    expect(qrExpired(null, null, now)).toBe(true)
    expect(qrExpired({ step: 'qr', expires_at: '2026-01-01T00:00:10Z', error: null }, null, now)).toBe(false)
    expect(qrExpired({ step: 'qr', expires_at: '2025-12-31T23:59:59Z', error: null }, null, now)).toBe(true)
    expect(qrExpired({ step: 'failed', expires_at: null, error: { code: 'login_expired', message: '' } }, null, now)).toBe(true)
    expect(qrExpired({ step: 'failed', expires_at: null, error: { code: 'internal', message: '' } }, null, now)).toBe(false)
    expect(qrExpired({ step: 'password', expires_at: null, error: null }, null, now)).toBe(false)
  })
})
