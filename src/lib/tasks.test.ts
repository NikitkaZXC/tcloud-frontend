import { describe, expect, it } from 'vitest'
import { capTasks, forgetTask, isPending, reportTask, taskFolders, taskFraction, trackTask } from './tasks'

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

describe('task folders', () => {
  it('lists the parent folder and its ancestors once, skipping archives', () => {
    const archive = { name: 'a.zip', format: 'zip' as const, files: 1, size: 1, expires_at: null }
    expect(
      taskFolders([
        { path: '/s1/a/b/x.txt', archive: null },
        { path: '/s1/a/y.txt', archive: null },
        { path: '/s2/z.txt', archive: null },
        { path: '/s3/docs', archive },
      ]),
    ).toEqual(['/s1/a/b', '/s1/a', '/s1', '/s2'])
  })
})
