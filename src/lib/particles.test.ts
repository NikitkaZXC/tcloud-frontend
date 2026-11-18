import { describe, expect, it } from 'vitest'
import { scatter } from './particles'

describe('particles', () => {
  it('scatters upwards, deterministically', () => {
    const out = scatter({ x: 0, y: 0 }, 10)
    expect(out).toHaveLength(10)
    expect(out.every((p) => p.to.y < 0)).toBe(true)
    expect(scatter({ x: 0, y: 0 }, 10)).toEqual(out)
  })
})
