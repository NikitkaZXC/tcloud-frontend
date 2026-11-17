import { describe, expect, it } from 'vitest'
import { finishSending, getSending, startSending, updateSending } from './upload'

describe('sending', () => {
  it('tracks body progress until the upload is accepted', () => {
    const a = startSending('tcloud/s/a.txt', 10)
    const b = startSending('tcloud/s/b.txt', 20)
    updateSending(a, 5)
    expect(getSending()).toEqual([
      { id: a, path: 'tcloud/s/a.txt', loaded: 5, total: 10 },
      { id: b, path: 'tcloud/s/b.txt', loaded: 0, total: 20 },
    ])
    finishSending(a)
    finishSending(b)
    expect(getSending()).toEqual([])
  })
})
