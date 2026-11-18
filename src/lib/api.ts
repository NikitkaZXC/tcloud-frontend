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

export async function toError(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => null)
  return new ApiError(
    response.status,
    body?.error ?? { code: 'http_error', message: `${response.status} ${response.statusText}` },
  )
}

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
  if (!response.ok) throw await toError(response)
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

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const key = `error.${error.code}`
    return key in DICTIONARIES.ru ? t(key as Key) : `${error.message} (${error.code})`
  }
  if (error instanceof TypeError) return t('error.network')
  if (error instanceof Error) return error.message
  return String(error)
}

export function errorText(body: ApiErrorBody | null | undefined): string {
  if (!body) return ''
  const key = `error.${body.code}`
  return key in DICTIONARIES.ru ? t(key as Key) : body.message
}
