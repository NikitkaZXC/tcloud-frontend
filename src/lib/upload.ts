import { useSyncExternalStore } from 'react'
import { ApiError, notifyRateLimit, refreshSession, retryAfter, withQuery } from './api'
import type { SendAs, Task, UploadOptions } from './types'

export interface Sending {
  id: number
  path: string
  loaded: number
  total: number
  rate: number | null
  at: number
  encrypt?: boolean
  cancelled?: boolean
}

export function nextRate(item: Pick<Sending, 'loaded' | 'rate' | 'at'>, loaded: number, now: number): number | null {
  const seconds = (now - item.at) / 1000
  if (seconds <= 0) return item.rate
  const current = Math.max(loaded - item.loaded, 0) / seconds
  return item.rate == null ? current : item.rate * 0.7 + current * 0.3
}

let sending: Sending[] = []
let nextId = 0
const controllers = new Map<number, AbortController>()
const listeners = new Set<() => void>()

function setSending(next: Sending[]) {
  sending = next
  listeners.forEach((listener) => listener())
}

export function startSending(path: string, total: number, encrypt = false): number {
  const id = ++nextId
  controllers.set(id, new AbortController())
  setSending([...sending, { id, path, loaded: 0, total, rate: null, at: Date.now(), encrypt }])
  return id
}

export const sendingSignal = (id: number) => controllers.get(id)?.signal

export const CANCELLED_HOLD_MS = 3000

export function cancelSending(id: number) {
  controllers.get(id)?.abort()
  setSending(sending.map((item) => (item.id === id ? { ...item, cancelled: true } : item)))
}

export const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError'

export const SENDING_TICK_MS = 250

export function updateSending(id: number, loaded: number) {
  const now = Date.now()
  const item = sending.find((entry) => entry.id === id)
  if (!item || (now - item.at < SENDING_TICK_MS && loaded < item.total)) return
  setSending(sending.map((item) => (item.id === id ? { ...item, loaded, rate: nextRate(item, loaded, now), at: now } : item)))
}

export function finishSending(id: number) {
  controllers.delete(id)
  const drop = () => setSending(sending.filter((item) => item.id !== id))
  if (sending.find((item) => item.id === id)?.cancelled) setTimeout(drop, CANCELLED_HOLD_MS)
  else drop()
}

export function getSending(): Sending[] {
  return sending
}

export function useSending(): Sending[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSending,
  )
}

function send(file: File, options: UploadOptions, onProgress: (loaded: number) => void, signal?: AbortSignal): Promise<XMLHttpRequest> {
  return new Promise((resolve, reject) => {
    const aborted = () => reject(new DOMException('Upload cancelled', 'AbortError'))
    if (signal?.aborted) return aborted()
    const xhr = new XMLHttpRequest()
    signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.onabort = aborted
    xhr.open('POST', withQuery('/api/uploads', { ...options }))
    xhr.upload.onprogress = (event) => onProgress(event.loaded)
    xhr.onload = () => resolve(xhr)
    xhr.onerror = () => reject(new Error('network error'))
    xhr.send(file)
  })
}

export async function uploadFile(file: File, options: UploadOptions, onProgress: (loaded: number) => void, signal?: AbortSignal): Promise<Task> {
  let xhr = await send(file, options, onProgress, signal)
  if (xhr.status === 401 && (await refreshSession())) xhr = await send(file, options, onProgress, signal)
  let body: { error?: ApiError['body'] } | null = null
  try {
    body = JSON.parse(xhr.responseText)
  } catch {
    body = null
  }
  if (xhr.status >= 200 && xhr.status < 300) return body as Task
  const error = new ApiError(xhr.status, body?.error ?? { code: 'http_error', message: `${xhr.status}` })
  if (xhr.status === 429) {
    error.body.retry_after ??= Number(xhr.getResponseHeader('Retry-After')) || 1
    notifyRateLimit(retryAfter(error)!)
  }
  throw error
}

export function withSendAs<T extends { send_as: SendAs; encrypt: boolean }>(options: T, sendAs: SendAs): T {
  return { ...options, send_as: sendAs, encrypt: sendAs === 'file' }
}
