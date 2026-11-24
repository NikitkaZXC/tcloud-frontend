import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './api'
import type { UploadOptions } from './types'
import { CANCELLED_HOLD_MS, cancelSending, CHUNK_RETRIES, CHUNK_SIZE, chunkRetryDelay, getPausedSessions, resumeUpload, sameFile, finishSending, getSending, isAbort, nextRate, SENDING_TICK_MS, sendingSignal, startSending, updateSending, uploadFile, withSendAs } from './upload'

describe('sending', () => {
  afterEach(() => vi.useRealTimers())

  it('tracks body progress until the upload is accepted', () => {
    vi.useFakeTimers()
    const a = startSending('tcloud/s/a.txt', 10)
    const b = startSending('tcloud/s/b.txt', 20)
    vi.advanceTimersByTime(SENDING_TICK_MS)
    updateSending(a, 5)
    expect(getSending()).toMatchObject([
      { id: a, path: 'tcloud/s/a.txt', loaded: 5, total: 10 },
      { id: b, path: 'tcloud/s/b.txt', loaded: 0, total: 20 },
    ])
    finishSending(a)
    finishSending(b)
    expect(getSending()).toEqual([])
  })

  it('throttles progress events but never drops the last one', () => {
    vi.useFakeTimers()
    const a = startSending('tcloud/s/a.txt', 10)
    updateSending(a, 3)
    expect(getSending()[0].loaded).toBe(0)
    vi.advanceTimersByTime(SENDING_TICK_MS)
    updateSending(a, 4)
    expect(getSending()[0].loaded).toBe(4)
    updateSending(a, 10)
    expect(getSending()[0].loaded).toBe(10)
    finishSending(a)
  })

  it('smooths the sending rate', () => {
    expect(nextRate({ loaded: 0, rate: null, at: 0 }, 1000, 1000)).toBe(1000)
    expect(nextRate({ loaded: 1000, rate: 1000, at: 1000 }, 3000, 2000)).toBe(1300)
    expect(nextRate({ loaded: 1000, rate: 500, at: 1000 }, 2000, 1000)).toBe(500)
  })

  it('turns encryption off for media and back on for file', () => {
    const media = withSendAs({ send_as: 'file', encrypt: true }, 'media')
    expect(media).toEqual({ send_as: 'media', encrypt: false })
    expect(withSendAs(media, 'file')).toEqual({ send_as: 'file', encrypt: true })
  })
})

describe('cancel sending', () => {
  afterEach(() => vi.useRealTimers())

  it('aborts the body upload, shows it as cancelled, then drops it', async () => {
    vi.useFakeTimers()
    const id = startSending('tcloud/s/c.txt', 10, true)
    const signal = sendingSignal(id)!
    cancelSending(id)
    expect(signal.aborted).toBe(true)
    expect(getSending()).toMatchObject([{ id, cancelled: true, encrypt: true }])
    await expect(uploadFile(new File(['x'], 'c.txt'), { path: 'tcloud/s/c.txt' } as UploadOptions, () => {}, signal)).rejects.toSatisfy(isAbort)
    finishSending(id)
    expect(getSending()).toHaveLength(1)
    vi.advanceTimersByTime(CANCELLED_HOLD_MS)
    expect(getSending()).toEqual([])
  })

  it('drops a finished upload at once', () => {
    const id = startSending('tcloud/s/d.txt', 10)
    finishSending(id)
    expect(getSending()).toEqual([])
  })
})

describe('chunked upload', () => {
  afterEach(() => vi.unstubAllGlobals())

  type Reply = { status: number; body?: unknown }
  function fakeXhr(handle: (method: string, url: string) => Reply) {
    const calls: string[] = []
    class Fake {
      status = 0
      statusText = ''
      responseText = ''
      upload = { onprogress: null as null | ((event: { loaded: number }) => void) }
      onload: null | (() => void) = null
      onabort: null | (() => void) = null
      onerror: null | (() => void) = null
      private target = ''
      open(method: string, url: string) {
        this.target = `${method} ${url}`
      }
      abort() {}
      getResponseHeader() {
        return null
      }
      send() {
        calls.push(this.target)
        const [method, url] = this.target.split(' ')
        const reply = handle(method, url)
        this.status = reply.status
        this.responseText = reply.body === undefined ? '' : JSON.stringify(reply.body)
        queueMicrotask(() => this.onload?.())
      }
    }
    vi.stubGlobal('XMLHttpRequest', Fake)
    return calls
  }

  const big = { name: 'big.bin', size: CHUNK_SIZE + 10, lastModified: 1, slice: () => new Blob(['x']) } as unknown as File
  const session = (offset: number) => ({ session_id: 's1', path: 'tcloud/s/big.bin', size: big.size, offset, chunk_size: CHUNK_SIZE, expires_at: '2999-01-01T00:00:00Z' })
  const options = { path: 'tcloud/s/big.bin', send_as: 'file', on_conflict: 'error', priority: 'normal', allow_unscannable: false, encrypt: true } as UploadOptions

  it('sends parts from the server offset and returns the queued task', async () => {
    let mismatched = false
    const calls = fakeXhr((method, url) => {
      if (method === 'POST') return { status: 201, body: session(0) }
      if (url.endsWith('offset=0') && !mismatched) {
        mismatched = true
        return { status: 409, body: { error: { code: 'offset_mismatch', message: 'x', offset: CHUNK_SIZE } } }
      }
      if (url.endsWith(`offset=${CHUNK_SIZE}`)) return { status: 202, body: { id: 's1', status: 'queued' } }
      return { status: 500 }
    })
    const progress: number[] = []
    const task = await uploadFile(big, options, (loaded) => progress.push(loaded))
    expect(task).toMatchObject({ id: 's1', status: 'queued' })
    expect(calls).toEqual([
      `POST /api/uploads/sessions?path=tcloud%2Fs%2Fbig.bin&send_as=file&on_conflict=error&priority=normal&allow_unscannable=false&encrypt=true&size=${big.size}`,
      'PUT /api/uploads/sessions/s1?offset=0',
      `PUT /api/uploads/sessions/s1?offset=${CHUNK_SIZE}`,
    ])
    expect(getPausedSessions()).toEqual([])
  })

  it('returns the skipped task when the session is not created', async () => {
    fakeXhr(() => ({ status: 200, body: { id: 't1', status: 'done' } }))
    expect(await uploadFile(big, { ...options, on_conflict: 'skip' }, () => {})).toMatchObject({ id: 't1' })
  })

  it('deletes the session on a non-retryable error', async () => {
    const calls = fakeXhr((method) => (method === 'POST' ? { status: 201, body: session(0) } : method === 'PUT' ? { status: 507, body: { error: { code: 'insufficient_storage', message: 'x' } } } : { status: 204 }))
    await expect(uploadFile(big, options, () => {})).rejects.toMatchObject({ code: 'insufficient_storage' })
    await Promise.resolve()
    expect(calls.at(-1)).toBe('DELETE /api/uploads/sessions/s1')
    expect(getPausedSessions()).toEqual([])
  })

  it('falls back to the task when the session is gone after the last part', async () => {
    fakeXhr((method, url) => {
      if (method === 'GET' && url.startsWith('/api/tasks/')) return { status: 200, body: { id: 's1', status: 'queued' } }
      return { status: 404, body: { error: { code: 'upload_session_not_found', message: 'x' } } }
    })
    const entry = { session_id: 's1', path: 'tcloud/s/big.bin', size: big.size, name: big.name, lastModified: 1, expires_at: '2999-01-01T00:00:00Z', encrypt: true }
    expect(await resumeUpload(entry, big, () => {})).toMatchObject({ id: 's1' })
  })

  it('retries transient errors with backoff or retry_after', () => {
    expect(chunkRetryDelay(new Error('network error'), 1)).toBe(1000)
    expect(chunkRetryDelay(new Error('network error'), 3)).toBe(4000)
    expect(chunkRetryDelay(new ApiError(503, { code: 'http_error', message: 'x' }), 2)).toBe(2000)
    expect(chunkRetryDelay(new ApiError(409, { code: 'upload_session_busy', message: 'x', retry_after: 5 }), 1)).toBe(5000)
    expect(chunkRetryDelay(new ApiError(507, { code: 'insufficient_storage', message: 'x' }), 1)).toBeNull()
    expect(chunkRetryDelay(new ApiError(409, { code: 'conflict', message: 'x' }), 1)).toBeNull()
    expect(chunkRetryDelay(new DOMException('x', 'AbortError'), 1)).toBeNull()
    expect(chunkRetryDelay(new Error('network error'), CHUNK_RETRIES + 1)).toBeNull()
  })

  it('matches a re-picked file by name, size and modification time', () => {
    const entry = { session_id: 's', path: 'p', size: 3, name: 'a.txt', lastModified: 5, expires_at: '', encrypt: false }
    expect(sameFile(entry, new File(['abc'], 'a.txt', { lastModified: 5 }))).toBe(true)
    expect(sameFile(entry, new File(['abc'], 'a.txt', { lastModified: 6 }))).toBe(false)
    expect(sameFile(entry, new File(['ab'], 'a.txt', { lastModified: 5 }))).toBe(false)
  })
})
