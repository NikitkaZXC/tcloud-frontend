import { describe, expect, it } from 'vitest'
import { thumbUrl } from './thumbs'

const file = { uuid: 'u1', kind: 'photo' as const, encrypted: false, updated_at: '2026-11-17T22:33:41Z' }

describe('thumbUrl', () => {
  it('asks only for open photos, videos and animations', () => {
    expect(thumbUrl(file)).toBe('/api/files/u1/thumb?v=2026-11-17T22%3A33%3A41Z')
    expect(thumbUrl({ ...file, kind: 'video' })).not.toBeNull()
    expect(thumbUrl({ ...file, kind: 'animation' })).not.toBeNull()
    expect(thumbUrl({ ...file, encrypted: true })).toBeNull()
    expect(thumbUrl({ ...file, kind: 'audio' })).toBeNull()
    expect(thumbUrl({ ...file, kind: 'document' })).toBeNull()
  })
})
