import { useSyncExternalStore } from 'react'
import { ApiError, refreshSession, withQuery } from './api'
import type { SendAs, Task, UploadOptions } from './types'

export interface Sending {
  id: number
  path: string
  loaded: number
  total: number
  rate: number | null
  at: number
}

export function nextRate(item: Pick<Sending, 'loaded' | 'rate' | 'at'>, loaded: number, now: number): number | null {
  const seconds = (now - item.at) / 1000
  if (seconds <= 0) return item.rate
  const current = Math.max(loaded - item.loaded, 0) / seconds
  return item.rate == null ? current : item.rate * 0.7 + current * 0.3
}

let sending: Sending[] = []
let nextId = 0
const listeners = new Set<() => void>()

function setSending(next: Sending[]) {
  sending = next
  listeners.forEach((listener) => listener())
}

export function startSending(path: string, total: number): number {
  const id = ++nextId
  setSending([...sending, { id, path, loaded: 0, total, rate: null, at: Date.now() }])
  return id
}

export function updateSending(id: number, loaded: number) {
  const now = Date.now()
  setSending(sending.map((item) => (item.id === id ? { ...item, loaded, rate: nextRate(item, loaded, now), at: now } : item)))
}

export function finishSending(id: number) {
  setSending(sending.filter((item) => item.id !== id))
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

function send(file: File, options: UploadOptions, onProgress: (loaded: number) => void): Promise<XMLHttpRequest> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', withQuery('/api/uploads', { ...options }))
    xhr.upload.onprogress = (event) => onProgress(event.loaded)
    xhr.onload = () => resolve(xhr)
    xhr.onerror = () => reject(new Error('network error'))
    xhr.send(file)
  })
}

export async function uploadFile(file: File, options: UploadOptions, onProgress: (loaded: number) => void): Promise<Task> {
  let xhr = await send(file, options, onProgress)
  if (xhr.status === 401 && (await refreshSession())) xhr = await send(file, options, onProgress)
  let body: { error?: ApiError['body'] } | null = null
  try {
    body = JSON.parse(xhr.responseText)
  } catch {
    body = null
  }
  if (xhr.status >= 200 && xhr.status < 300) return body as Task
  throw new ApiError(xhr.status, body?.error ?? { code: 'http_error', message: `${xhr.status}` })
}

export function withSendAs<T extends { send_as: SendAs; encrypt: boolean }>(options: T, sendAs: SendAs): T {
  return { ...options, send_as: sendAs, encrypt: sendAs === 'file' }
}
