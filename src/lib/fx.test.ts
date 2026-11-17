import { describe, expect, it } from 'vitest'
import { easeOut, scramble } from './fx'

describe('scramble', () => {
  it('keeps length and spaces, resolves left to right', () => {
    const frame = scramble('ab cd', 0, () => 0)
    expect(frame).toHaveLength(5)
    expect(frame[2]).toBe(' ')
    expect(frame[0]).not.toBe('a')
    expect(scramble('ab cd', 0.4, () => 0).slice(0, 2)).toBe('ab')
    expect(scramble('ab cd', 1)).toBe('ab cd')
    expect(scramble('ab cd', 5)).toBe('ab cd')
  })

  it('eases counters to the target', () => {
    expect(easeOut(0)).toBe(0)
    expect(easeOut(1)).toBe(1)
    expect(easeOut(0.5)).toBeGreaterThan(0.5)
  })
})
