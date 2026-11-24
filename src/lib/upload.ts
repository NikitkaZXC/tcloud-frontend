import type { QueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { ApiError, errorBody, notifyRateLimit, refreshSession, retryAfter, showError, withQuery } from './api'
import { hintTask } from './steps'
import { trackTask } from './tasks'
import type { SendAs, Task, UploadOptions, UploadSession } from './types'

export interface Sending {
  id: number
  path: string
  loaded: number
  total: number
  rate: number | null
  at: number
  encrypt?: boolean
  cancelled?: boolean
  conflict?: boolean
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

function send(method: string, url: string, body: Blob | null, onProgress: (loaded: number) => void, signal?: AbortSignal): Promise<XMLHttpRequest> {
  return new Promise((resolve, reject) => {
    const aborted = () => reject(new DOMException('Upload cancelled', 'AbortError'))
    if (signal?.aborted) return aborted()
    const xhr = new XMLHttpRequest()
    signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.onabort = aborted
    xhr.open(method, url)
    xhr.upload.onprogress = (event) => onProgress(event.loaded)
    xhr.onload = () => resolve(xhr)
    xhr.onerror = () => reject(new Error('network error'))
    xhr.send(body)
  })
}

async function call<T>(method: string, url: string, body: Blob | null, onProgress: (loaded: number) => void, signal?: AbortSignal): Promise<T> {
  let xhr = await send(method, url, body, onProgress, signal)
  if (xhr.status === 401 && (await refreshSession())) xhr = await send(method, url, body, onProgress, signal)
  let parsed: unknown = null
  try {
    parsed = JSON.parse(xhr.responseText)
  } catch {
    parsed = null
  }
  if (xhr.status >= 200 && xhr.status < 300) return parsed as T
  const error = new ApiError(xhr.status, errorBody(xhr.status, xhr.statusText, parsed))
  if (xhr.status === 429) {
    error.body.retry_after ??= Number(xhr.getResponseHeader('Retry-After')) || 1
    notifyRateLimit(retryAfter(error)!)
  }
  throw error
}

export const CHUNK_SIZE = 64 * 1024 * 1024

export function uploadFile(file: File, options: UploadOptions, onProgress: (loaded: number) => void, signal?: AbortSignal): Promise<Task> {
  if (file.size <= CHUNK_SIZE) return call<Task>('POST', withQuery('/api/uploads', { ...options }), file, onProgress, signal)
  return uploadChunked(file, options, onProgress, signal)
}

export interface StoredSession {
  session_id: string
  path: string
  size: number
  name: string
  lastModified: number
  expires_at: string
  encrypt: boolean
}

export const SESSIONS_KEY = 'tcloud.uploads.sessions'

function readSessions(fallback: StoredSession[] = []): StoredSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    const list = raw == null ? fallback : JSON.parse(raw)
    return Array.isArray(list) ? list.filter((entry: StoredSession) => Date.parse(entry.expires_at) > Date.now()) : []
  } catch {
    return fallback
  }
}

let stored = readSessions()
const active = new Set<string>()
let paused = stored

function writeSessions(next: StoredSession[]) {
  stored = next
  paused = next.filter((entry) => !active.has(entry.session_id))
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(next))
  } catch {
    return
  } finally {
    listeners.forEach((listener) => listener())
  }
}

function rememberSession(entry: StoredSession) {
  active.add(entry.session_id)
  writeSessions([...readSessions(stored).filter((item) => item.session_id !== entry.session_id), entry])
}

function releaseSession(id: string) {
  active.delete(id)
  writeSessions(readSessions(stored))
}

function forgetSession(id: string) {
  active.delete(id)
  writeSessions(readSessions(stored).filter((item) => item.session_id !== id))
}

export const getPausedSessions = () => paused

export function usePausedSessions(): StoredSession[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getPausedSessions,
  )
}

export const sameFile = (entry: StoredSession, file: File) => entry.name === file.name && entry.size === file.size && entry.lastModified === file.lastModified

const sessionUrl = (id: string) => `/api/uploads/sessions/${id}`


export const CHUNK_RETRIES = 5

const transient = (error: unknown) =>
  !isAbort(error) && (!(error instanceof ApiError) || error.code === 'upload_session_busy' || error.status === 429 || (error.status >= 500 && error.status !== 507))

export function chunkRetryDelay(error: unknown, failures: number): number | null {
  if (failures > CHUNK_RETRIES || !transient(error)) return null
  const after = error instanceof ApiError ? Number(error.body.retry_after) : NaN
  return (Number.isFinite(after) && after > 0 ? after : Math.min(2 ** (failures - 1), 30)) * 1000
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const aborted = () => {
      clearTimeout(timer)
      reject(new DOMException('Upload cancelled', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', aborted)
      resolve()
    }, ms)
    if (signal?.aborted) aborted()
    else signal?.addEventListener('abort', aborted, { once: true })
  })
}

export async function discardSession(id: string) {
  forgetSession(id)
  for (let failures = 1; ; failures++) {
    try {
      return await call<void>('DELETE', sessionUrl(id), null, () => {})
    } catch (e) {
      const delay = chunkRetryDelay(e, failures)
      if (delay == null) return
      await wait(delay)
    }
  }
}

async function uploadChunked(file: File, options: UploadOptions, onProgress: (loaded: number) => void, signal?: AbortSignal): Promise<Task> {
  const created = await call<UploadSession | Task>('POST', withQuery('/api/uploads/sessions', { ...options, size: file.size }), null, () => {}, signal)
  if (!('session_id' in created)) return created
  const entry = { session_id: created.session_id, path: created.path, size: file.size, name: file.name, lastModified: file.lastModified, expires_at: created.expires_at, encrypt: options.encrypt }
  return sendChunks(entry, file, created, onProgress, signal)
}

export function resumeUpload(entry: StoredSession, file: File, onProgress: (loaded: number) => void, signal?: AbortSignal): Promise<Task> {
  return sendChunks(entry, file, null, onProgress, signal)
}

async function sendChunks(entry: StoredSession, file: File, session: UploadSession | null, onProgress: (loaded: number) => void, signal?: AbortSignal): Promise<Task> {
  const id = entry.session_id
  rememberSession(entry)
  try {
    session ??= await call<UploadSession>('GET', sessionUrl(id), null, () => {}, signal)
    const size = session.chunk_size
    let offset = session.offset
    let failures = 0
    for (;;) {
      try {
        const start = offset
        const reply = await call<UploadSession | Task>('PUT', withQuery(sessionUrl(id), { offset }), file.slice(offset, offset + size), (loaded) => onProgress(start + loaded), signal)
        failures = 0
        if (!('session_id' in reply)) {
          forgetSession(id)
          return reply
        }
        offset = reply.offset
        rememberSession({ ...entry, expires_at: reply.expires_at })
      } catch (e) {
        if (e instanceof ApiError && e.code === 'offset_mismatch' && typeof e.body.offset === 'number') {
          offset = e.body.offset
          continue
        }
        const delay = chunkRetryDelay(e, ++failures)
        if (delay == null) throw e
        await wait(delay, signal)
      }
    }
  } catch (e) {
    if (e instanceof ApiError && e.code === 'upload_session_not_found') {
      forgetSession(id)
      const task = await call<Task>('GET', `/api/tasks/${id}`, null, () => {}).catch(() => null)
      if (task) return task
    } else if (transient(e)) releaseSession(id)
    else discardSession(id)
    throw e
  }
}

export type Resolution = 'replace' | 'keep_both'

export interface Batch {
  size: number
  choice?: Resolution | null
}

export interface Conflict {
  id: number
  batch: Batch
  path: string
  suggested: string | null
  resolve: (choice: Resolution | null) => void
}

let conflicts: Conflict[] = []

function setConflicts(next: Conflict[]) {
  conflicts = next
  listeners.forEach((listener) => listener())
}

export const getConflicts = () => conflicts

export function useConflicts(): Conflict[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getConflicts,
  )
}

function markConflict(id: number, conflict: boolean) {
  setSending(sending.map((item) => (item.id === id ? { ...item, conflict, loaded: 0 } : item)))
}

export function askConflict(id: number, batch: Batch, path: string, suggested: string | null): Promise<Resolution | null> {
  if (batch.choice !== undefined) return Promise.resolve(batch.choice)
  markConflict(id, true)
  return new Promise((resolve) => {
    const conflict = { id, batch, path, suggested, resolve }
    sendingSignal(id)?.addEventListener('abort', () => answerConflict(conflict, null), { once: true })
    setConflicts([...conflicts, conflict])
  })
}

export function answerConflict(conflict: Conflict, choice: Resolution | null, all = false) {
  if (all) conflict.batch.choice = choice
  const done = conflicts.filter((item) => item === conflict || (all && item.batch === conflict.batch))
  setConflicts(conflicts.filter((item) => !done.includes(item)))
  done.forEach((item) => item.resolve(choice))
}

export async function sendTracked(
  queryClient: QueryClient,
  id: number,
  name: string,
  encrypt: boolean,
  run: (onProgress: (loaded: number) => void, signal?: AbortSignal, onConflict?: Resolution) => Promise<Task>,
  batch?: Batch,
) {
  let resolution: Resolution | undefined
  try {
    for (;;) {
      try {
        const task = await run((loaded) => updateSending(id, loaded), sendingSignal(id), resolution)
        hintTask(task.id, { source: 'device', encrypt })
        queryClient.setQueryData<Task>(['task', task.id], task)
        trackTask(task.id)
        return
      } catch (e) {
        if (!batch || resolution || !(e instanceof ApiError && e.code === 'conflict')) throw e
        const suggested = typeof e.body.suggested_name === 'string' ? e.body.suggested_name : null
        const choice = await askConflict(id, batch, getSending().find((item) => item.id === id)?.path ?? name, suggested)
        if (!choice) return
        resolution = choice
        markConflict(id, false)
      }
    }
  } catch (e) {
    if (!isAbort(e)) showError(e, `${name}: `)
  } finally {
    finishSending(id)
  }
}

export function withSendAs<T extends { send_as: SendAs; encrypt: boolean }>(options: T, sendAs: SendAs): T {
  return { ...options, send_as: sendAs, encrypt: sendAs === 'file' }
}
