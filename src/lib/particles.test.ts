import { describe, expect, it } from 'vitest'
import { pour, scatter } from './particles'

describe('particles', () => {
  it('pours into the target and scatters upwards, deterministically', () => {
    const into = pour({ x: 100, y: 100 }, { x: 10, y: 10 }, 20)
    expect(into).toHaveLength(20)
    expect(into.every((p) => Math.abs(p.to.x - 10) <= 5 && Math.abs(p.to.y - 10) <= 3)).toBe(true)
    expect(pour({ x: 100, y: 100 }, { x: 10, y: 10 }, 20)).toEqual(into)
    expect(scatter({ x: 0, y: 0 }, 10).every((p) => p.to.y < 0)).toBe(true)
  })
})
