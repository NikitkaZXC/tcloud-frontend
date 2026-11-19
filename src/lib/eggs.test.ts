import { describe, expect, it } from 'vitest'
import { konami } from './eggs'

describe('eggs', () => {
  it('spots the konami code at the end of the key log', () => {
    expect(konami(['x', 'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'B', 'a'])).toBe(true)
    expect(konami(['ArrowUp', 'a'])).toBe(false)
  })
})
