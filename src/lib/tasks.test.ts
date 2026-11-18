import { describe, expect, it } from 'vitest'
import { taskFraction } from './tasks'

describe('task progress', () => {
  it('reads the backend percent as a fraction', () => {
    expect(taskFraction({ progress: 37.5 })).toBe(0.375)
    expect(taskFraction({ progress: 100 })).toBe(1)
    expect(taskFraction({ progress: 0 })).toBe(0)
    expect(taskFraction({ progress: 140 })).toBe(1)
    expect(taskFraction({ progress: null })).toBeNull()
  })
})
