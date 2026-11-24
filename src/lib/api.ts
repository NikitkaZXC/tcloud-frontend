import { toast } from 'sonner'
import { formatBytes, formatDuration } from './format'
import { DICTIONARIES, type Key, t } from './i18n'
import type { ApiErrorBody } from './types'

export class ApiError extends Error {
  status: number
  code: string
  body: ApiErrorBody

  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.status = status
    this.code = body.code
    this.body = body
  }
}

type Query = Record<string, string | number | boolean | undefined>

export function withQuery(url: string, query?: Query): string {
  if (!query) return url
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

export function errorBody(status: number, statusText: string, body: unknown): ApiErrorBody {
  const json = body as { error?: ApiErrorBody; detail?: unknown } | null
  if (json?.error?.code) return json.error
  if (typeof json?.detail === 'string') return { code: 'http_error', message: json.detail }
  if (Array.isArray(json?.detail)) return { code: 'validation_error', message: 'invalid request', details: json.detail }
  if (status === 413) return { code: 'body_too_large', message: `${status} ${statusText}`.trim() }
  return { code: 'http_error', message: `${status} ${statusText}`.trim() }
}

export async function toError(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => null)
  const error = errorBody(response.status, response.statusText, body)
  if (response.status === 429) error.retry_after ??= Number(response.headers.get('Retry-After')) || 1
  return new ApiError(response.status, error)
}

const QUOTA_CODES = new Set(['send_quota_exceeded', 'too_many_upload_sessions'])

export function retryAfter(error: unknown): number | null {
  if (!(error instanceof ApiError) || error.status !== 429 || QUOTA_CODES.has(error.code)) return null
  const value = Number(error.body.retry_after)
  return Number.isFinite(value) && value > 0 ? value : 1
}

export const RATE_LIMIT_TOAST = 'rate-limited'

export function notifyRateLimit(seconds: number) {
  toast.error(t('error.rateLimitedWait', { n: Math.ceil(seconds) }), { id: RATE_LIMIT_TOAST })
}

export const RATE_LIMIT_RETRIES = 3

export function queryRetry(count: number, error: unknown): boolean {
  if (retryAfter(error) != null) return count < RATE_LIMIT_RETRIES
  return !(error instanceof ApiError && error.status < 500) && count < 2
}

export const queryRetryDelay = (count: number, error: unknown) => (retryAfter(error) ?? Math.min(2 ** count, 30)) * 1000

let refreshing: Promise<boolean> | null = null

export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

export async function request<T = void>(
  method: string,
  url: string,
  options: { query?: Query; json?: unknown; body?: BodyInit; retry?: boolean } = {},
): Promise<T> {
  const init: RequestInit = { method, credentials: 'same-origin' }
  if (options.json !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(options.json)
  } else if (options.body !== undefined) {
    init.body = options.body
  }
  const full = withQuery(`/api${url}`, options.query)
  let response = await fetch(full, init)
  if (response.status === 401 && options.retry !== false && !url.startsWith('/auth/')) {
    if (await refreshSession()) response = await fetch(full, init)
  }
  if (!response.ok) {
    const error = await toError(response)
    const wait = retryAfter(error)
    if (wait != null && !url.startsWith('/auth/')) notifyRateLimit(wait)
    throw error
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  get: <T>(url: string, query?: Query) => request<T>('GET', url, { query }),
  post: <T = void>(url: string, json?: unknown, query?: Query) => request<T>('POST', url, { json, query }),
  put: <T = void>(url: string, json?: unknown) => request<T>('PUT', url, { json }),
  patch: <T = void>(url: string, json?: unknown) => request<T>('PATCH', url, { json }),
  del: <T = void>(url: string, query?: Query) => request<T>('DELETE', url, { query }),
}

function invalidField(body: ApiErrorBody): string | null {
  const detail = (Array.isArray(body.details) ? body.details : [])[0] as { loc?: unknown[]; msg?: unknown } | undefined
  const field = detail?.loc?.filter((part) => part !== 'body' && part !== 'query' && part !== 'path').join('.')
  return field ? t('error.invalidField', { field, message: String(detail?.msg ?? body.message) }) : null
}

const COUNT_LIMITS = new Set(['send_quota_exceeded', 'too_many_upload_sessions', 'too_many_items'])

function errorParams(body: ApiErrorBody): Record<string, string> {
  const params: Record<string, string> = {}
  if (typeof body.limit === 'number') params.limit = COUNT_LIMITS.has(body.code) ? String(body.limit) : formatBytes(body.limit)
  if (typeof body.used === 'number') params.used = formatBytes(body.used)
  if (typeof body.window === 'number') params.window = formatDuration(body.window)
  if (typeof body.retry_after === 'number') params.retry = formatDuration(body.retry_after)
  return params
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'validation_error') return invalidField(error.body) ?? t('error.validation_error')
    if (error.code === 'http_error') return error.message
    const key = `error.${error.code}`
    return key in DICTIONARIES.ru ? t(key as Key, errorParams(error.body)) : `${error.message} (${error.code})`
  }
  if (error instanceof TypeError) return t('error.network')
  if (error instanceof Error) return error.message
  return String(error)
}

export function showError(error: unknown, prefix = '') {
  if (retryAfter(error) == null) toast.error(prefix + errorMessage(error))
}

export function errorText(body: ApiErrorBody | null | undefined): string {
  if (!body) return ''
  const key = `error.${body.code}`
  return key in DICTIONARIES.ru ? t(key as Key, errorParams(body)) : body.message
}
