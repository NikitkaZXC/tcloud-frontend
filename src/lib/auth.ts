import { ApiError } from './api'
import type { ApiErrorBody, TelegramLogin, TelegramSessionName, TelegramSessionState } from './types'

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Неверный логин или пароль',
  account_locked: 'Слишком много неверных паролей — вход для этого логина временно заблокирован',
  rate_limited: 'Слишком много попыток входа с этого адреса',
  user_blocked: 'Пользователь заблокирован — обратитесь к администратору',
  validation_error: 'Заполните логин и пароль',
  invalid_phone: 'Telegram не принял номер телефона',
  invalid_code: 'Неверный код',
  invalid_password: 'Неверный пароль двухэтапной проверки',
  login_not_found: 'Вход не начат или истёк — начните заново',
  login_expired: 'Время входа истекло — начните заново',
  wrong_login_step: 'Шаг не по порядку — начните заново',
  already_authorized: 'Сессия уже авторизована',
  flood_wait: 'Telegram просит подождать перед новой попыткой',
  telegram_unauthorized: 'Нужная сессия Telegram не авторизована',
}

export function retryAfterOf(error: unknown): number | null {
  if (!(error instanceof ApiError)) return null
  const value = Number(error.body.retry_after)
  return Number.isFinite(value) && value > 0 ? value : null
}

export function describeError(error: unknown | ApiErrorBody | null): string {
  if (!error) return ''
  if (error instanceof ApiError) {
    if (error.status >= 500 && !MESSAGES[error.code]) return 'Сервер не отвечает, попробуйте позже'
    return MESSAGES[error.code] ?? error.message
  }
  if (error instanceof TypeError) return 'Нет связи с сервером'
  if (error instanceof Error) return error.message
  const body = error as ApiErrorBody
  return MESSAGES[body.code] ?? String(body.message ?? '')
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
