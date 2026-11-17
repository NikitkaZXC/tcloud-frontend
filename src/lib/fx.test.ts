import { describe, expect, it } from 'vitest'
import { easeOut } from './fx'

describe('easeOut', () => {
  it('eases counters to the target', () => {
    expect(easeOut(0)).toBe(0)
    expect(easeOut(1)).toBe(1)
    expect(easeOut(0.5)).toBeGreaterThan(0.5)
    expect(easeOut(5)).toBe(1)
  })
})
