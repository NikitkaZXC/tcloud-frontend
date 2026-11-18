import { describe, expect, it } from 'vitest'
import { konami, reached, unlocked } from './achievements'

describe('achievements', () => {
  it('unlocks each milestone once', () => {
    const now = reached({ files: 120, size: 2 * 1024 ** 3, checklist: true })
    expect(now).toEqual(['first-file', 'files-100', 'first-gb', 'checklist'])
    expect(unlocked(now, ['first-file', 'checklist'])).toEqual(['files-100', 'first-gb'])
    expect(reached({ files: 0, size: 0, checklist: false })).toEqual([])
  })

  it('spots the konami code at the end of the key log', () => {
    expect(konami(['x', 'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'B', 'a'])).toBe(true)
    expect(konami(['ArrowUp', 'a'])).toBe(false)
  })
})
