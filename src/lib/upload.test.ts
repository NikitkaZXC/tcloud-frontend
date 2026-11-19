import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UploadOptions } from './types'
import { CANCELLED_HOLD_MS, cancelSending, finishSending, getSending, isAbort, nextRate, SENDING_TICK_MS, sendingSignal, startSending, updateSending, uploadFile, withSendAs } from './upload'

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
