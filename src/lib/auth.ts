import { ApiError, errorMessage } from './api'
import { DICTIONARIES, type Key, t } from './i18n'
import type { ApiErrorBody, TelegramLogin, TelegramSessionName, TelegramSessionState } from './types'

const MESSAGES: Record<string, Key> = {
  invalid_credentials: 'auth.invalidCredentials',
  account_locked: 'auth.accountLocked',
  rate_limited: 'auth.rateLimited',
  user_blocked: 'auth.userBlocked',
  validation_error: 'auth.validation',
  invalid_phone: 'auth.invalidPhone',
  invalid_code: 'auth.invalidCode',
  invalid_password: 'auth.invalidPassword',
  login_not_found: 'auth.loginNotFound',
  login_expired: 'auth.loginExpired',
  wrong_login_step: 'auth.wrongStep',
  already_authorized: 'auth.alreadyAuthorized',
  flood_wait: 'auth.floodWait',
  telegram_unauthorized: 'auth.telegramUnauthorized',
}

const message = (code: string) => (MESSAGES[code] ? t(MESSAGES[code]) : undefined)

export function retryAfterOf(error: unknown): number | null {
  if (!(error instanceof ApiError)) return null
  const value = Number(error.body.retry_after)
  return Number.isFinite(value) && value > 0 ? value : null
}

export function describeError(error: unknown | ApiErrorBody | null): string {
  if (!error) return ''
  if (error instanceof ApiError) {
    if (error.status >= 500 && !MESSAGES[error.code]) return t('error.server')
    return message(error.code) ?? (`error.${error.code}` in DICTIONARIES.ru ? errorMessage(error) : error.message)
  }
  if (error instanceof TypeError) return t('error.network')
  if (error instanceof Error) return error.message
  const body = error as ApiErrorBody
  return message(body.code) ?? String(body.message ?? '')
}

export const SESSION_ORDER: TelegramSessionName[] = ['api', 'upload', 'download']

export function nextSession(sessions: TelegramSessionState[]): TelegramSessionName | null {
  return SESSION_ORDER.find((name) => sessions.some((s) => s.session === name && !s.authorized)) ?? null
}

export function activeSession(sessions: TelegramSessionState[], picked: TelegramSessionName | null): TelegramSessionName | null {
  const chosen = sessions.find((s) => s.session === picked)
  return chosen && !chosen.authorized ? chosen.session : nextSession(sessions)
}

export function qrExpired(login: TelegramLogin | null, expiresAt: string | null, now: number): boolean {
  if (!login || login.step === 'expired') return true
  if (login.step === 'failed') return login.error?.code === 'login_expired'
  if (login.step !== 'qr') return false
  const deadline = expiresAt ?? login.expires_at
  return !deadline || Date.parse(deadline) <= now
}
