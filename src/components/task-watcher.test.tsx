import { QueryClient } from '@tanstack/react-query'
import { waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { afterEach, expect, it, vi } from 'vitest'
import { isPending, trackTask } from '@/lib/tasks'
import { json, renderApp } from '@/test-utils'
import { TaskWatcher } from './task-watcher'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

it('reports a finished upload once and refreshes its folders, storages and search', async () => {
  const done = { id: 't1', status: 'done', path: 'tcloud/s/a/b.txt', archive: null, file: null, error: null }
  vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.startsWith('/api/tasks?') ? json(200, { items: [done] }) : json(200, []))))
  trackTask('t1')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  renderApp(<TaskWatcher />, { client })
  await waitFor(() => expect(isPending('t1')).toBe(false))
  const keys = invalidate.mock.calls.map(([filter]) => JSON.stringify(filter?.queryKey))
  expect(keys).toEqual(expect.arrayContaining(['["task-counts"]', '["folder","tcloud/s/a"]', '["folder","tcloud/s"]', '["storages"]', '["account"]', '["search"]', '["mimes"]']))
  expect(toast.success).toHaveBeenCalledTimes(1)
})
