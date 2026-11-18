import { describe, expect, it } from 'vitest'
import { forgetTask, isPending, reportTask, taskFraction, trackTask } from './tasks'

describe('task progress', () => {
  it('reads the backend percent as a fraction', () => {
    expect(taskFraction({ progress: 37.5 })).toBe(0.375)
    expect(taskFraction({ progress: 100 })).toBe(1)
    expect(taskFraction({ progress: 0 })).toBe(0)
    expect(taskFraction({ progress: 140 })).toBe(1)
    expect(taskFraction({ progress: null })).toBeNull()
  })
})

describe('task reports', () => {
  it('reports a tracked task once, again after a retry', () => {
    trackTask('a')
    expect(isPending('a')).toBe(true)
    reportTask('a')
    expect(isPending('a')).toBe(false)
    trackTask('a')
    expect(isPending('a')).toBe(true)
    forgetTask('a')
    expect(isPending('a')).toBe(false)
  })
})
