import { afterEach, describe, expect, it, vi } from 'vitest'
import { finishSending, getSending, nextRate, SENDING_TICK_MS, startSending, updateSending, withSendAs } from './upload'

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
