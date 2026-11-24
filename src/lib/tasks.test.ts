import { describe, expect, it, vi } from 'vitest'
import { ApiError } from './api'
import { setLang } from './i18n'
import type { Task } from './types'
import { capTasks, forgetTask, isPending, pollInterval, reportTask, taskFolders, taskFraction, taskLoader, trackTask, waitingText, warningText } from './tasks'

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
    expect(taskFolders([{ path: '/s1/a/x.txt', archive: null, file: null } as Task])).toEqual(['/s1/a', '/s1'])
  })
})

describe('task polling', () => {
  it('polls queued tasks slower than running ones', () => {
    expect(pollInterval('queued')).toBe(5000)
    expect(pollInterval('running')).toBe(1000)
    expect(pollInterval(undefined)).toBe(1000)
  })
})

describe('task codes', () => {
  it('translates warnings and waiting by code and falls back to the message', () => {
    setLang('en')
    expect(warningText({ code: 'archive_file_gone', params: { name: 'a/b.txt' }, message: 'x' })).toBe('a/b.txt: no longer in Telegram, left out of the archive')
    expect(warningText({ code: 'archive_files_deleted', params: { count: 2 }, message: 'x' })).toBe('2 selected files were deleted before the archive was built')
    expect(warningText({ code: 'too_big_to_scan', params: { limit: 2 * 1024 ** 3 }, message: 'x' })).toBe('The file exceeds the antivirus limit (2.0 GB) — accepted without a virus scan')
    expect(warningText({ code: 'other', params: {}, message: 'legacy text' })).toBe('legacy text')
    expect(warningText({ code: 'brand_new', params: {}, message: 'new text' })).toBe('new text')
    expect(waitingText({ code: 'queue', params: { queue: 'uploads.telegram' }, reason: 'queue:uploads.telegram', seconds: null })).toBe('Telegram upload queue')
    expect(waitingText({ code: 'queue', params: { queue: 'other.queue' }, reason: 'queue:other.queue', seconds: null })).toBe('queue:other.queue')
    expect(waitingText({ code: 'flood_wait', params: {}, reason: 'flood', seconds: 30 })).toBe('Telegram pause (FloodWait)')
    setLang('ru')
    expect(warningText({ code: 'archive_files_deleted', params: { count: 5 }, message: 'x' })).toBe('5 выбранных файлов удалены до сборки архива')
  })
})

describe('task loader', () => {
  it('batches ids of one tick, chunks by 100 and rejects omitted ids as 404', async () => {
    const fetchMany = vi.fn(async (ids: string[]) => ids.filter((id) => id !== 'gone').map((id) => ({ id }) as Task))
    const load = taskLoader(fetchMany, 0)
    const ids = Array.from({ length: 150 }, (_, i) => `t${i}`)
    const [first, again, gone, ...rest] = await Promise.allSettled([load('t0'), load('t0'), load('gone'), ...ids.slice(1).map(load)])
    expect(fetchMany).toHaveBeenCalledTimes(2)
    expect(fetchMany.mock.calls.map(([chunk]) => chunk.length)).toEqual([100, 51])
    expect(first).toEqual({ status: 'fulfilled', value: { id: 't0' } })
    expect(again).toEqual(first)
    expect(gone.status === 'rejected' && gone.reason instanceof ApiError && gone.reason.status).toBe(404)
    expect(rest.every((result) => result.status === 'fulfilled')).toBe(true)
  })

  it('rejects the whole chunk when the request fails', async () => {
    const load = taskLoader(() => Promise.reject(new Error('down')), 0)
    await expect(load('a')).rejects.toThrow('down')
  })
})

describe('stored task ids', () => {
  it('ignores non-array or mixed JSON in localStorage', async () => {
    localStorage.setItem('tcloud.tasks', '{"a":1}')
    localStorage.setItem('tcloud.tasks.pending', '[1,"p",null]')
    vi.resetModules()
    const tasks = await import('./tasks')
    tasks.trackTask('n')
    expect(JSON.parse(localStorage.getItem('tcloud.tasks')!)).toEqual(['n'])
    expect(tasks.isPending('n')).toBe(true)
    localStorage.clear()
  })
})
