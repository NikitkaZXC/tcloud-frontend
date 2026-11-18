import { afterEach, describe, expect, it, vi } from 'vitest'
import { getReads, markRead, READ_MS } from './reads'

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
})
