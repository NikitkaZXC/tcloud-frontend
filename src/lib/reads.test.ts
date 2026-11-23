import { afterEach, describe, expect, it, vi } from 'vitest'
import { getReads, markRead, onRead, READ_MS, READ_POKE_MS } from './reads'

describe('reads', () => {
  afterEach(() => vi.useRealTimers())

  it('keeps a read for a few seconds, then forgets it', () => {
    vi.useFakeTimers()
    markRead('tcloud/a/x.jpg')
    markRead('tcloud/b/y.jpg')
    expect(getReads().map((read) => read.path)).toEqual(['tcloud/a/x.jpg', 'tcloud/b/y.jpg'])
    vi.advanceTimersByTime(READ_MS)
    expect(getReads()).toEqual([])
  })

  it('pokes listeners shortly after a read so the server lamp is fetched at once', () => {
    vi.useFakeTimers()
    const poke = vi.fn()
    const off = onRead(poke)
    markRead('tcloud/a/x.jpg')
    vi.advanceTimersByTime(READ_POKE_MS - 1)
    expect(poke).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(poke).toHaveBeenCalledOnce()
    off()
    markRead('tcloud/a/y.jpg')
    vi.advanceTimersByTime(READ_MS)
    expect(poke).toHaveBeenCalledOnce()
  })
})
