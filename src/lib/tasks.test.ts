import { describe, expect, it } from 'vitest'
import { capTasks, forgetTask, isPending, reportTask, taskFraction, trackTask } from './tasks'

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

describe('task cap', () => {
  it('drops the oldest finished tasks first, then the oldest', () => {
    expect(capTasks(['e', 'd', 'c', 'b', 'a'], ['d', 'a'], 3)).toEqual(['e', 'd', 'a'])
    expect(capTasks(['c', 'b', 'a'], ['c', 'b', 'a'], 2)).toEqual(['c', 'b'])
    expect(capTasks(['b', 'a'], [], 3)).toEqual(['b', 'a'])
  })
})
