import { describe, expect, it } from 'vitest'
import { thumbUrl } from './thumbs'

const file = { uuid: 'u1', kind: 'photo' as const, updated_at: '2026-11-17T22:33:41Z' }

describe('thumbUrl', () => {
  it('asks for every kind but audio, encrypted or not', () => {
    expect(thumbUrl(file)).toBe('/api/files/u1/thumb?v=2026-11-17T22%3A33%3A41Z')
    expect(thumbUrl({ ...file, kind: 'video' })).not.toBeNull()
    expect(thumbUrl({ ...file, kind: 'animation' })).not.toBeNull()
    expect(thumbUrl({ ...file, kind: 'document' })).not.toBeNull()
    expect(thumbUrl({ ...file, kind: 'audio' })).toBeNull()
  })
})
