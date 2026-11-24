import { QueryClient } from '@tanstack/react-query'
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hintTask } from '@/lib/steps'
import type { Me, Task } from '@/lib/types'
import { json, renderApp } from '@/test-utils'
import { TaskCard } from './tasks'

const task = (id: string, extra: Partial<Task> = {}) =>
  ({ id, status: 'failed', stage: 'downloading', step: null, priority: 'normal', path: 'tcloud/s/a.txt', bytes_done: 0, bytes_total: null, progress: null, warnings: [], warning_details: [], archive: null, file: null, cancel_requested: false, error: null, ...extra }) as unknown as Task

function show(card: Task, role: Me['role'] = 'user') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  client.setQueryData(['me'], { role } as Me)
  return renderApp(<TaskCard task={card} />, { client })
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => json(200, [])))
  Element.prototype.scrollIntoView ??= () => {}
  Element.prototype.hasPointerCapture ??= () => false
})

describe('TaskCard', () => {
  it('offers retry only for URL tasks', () => {
    hintTask('u1', { source: 'url', encrypt: false })
    hintTask('d1', { source: 'device', encrypt: false })
    show(task('u1'))
    expect(screen.getAllByRole('button', { name: 'Повторить' })).toHaveLength(1)
    show(task('d1'))
    show(task('x1', { status: 'cancelled' }))
    expect(screen.getAllByRole('button', { name: 'Повторить' })).toHaveLength(1)
  })

  it('disables high priority for non-admins', async () => {
    show(task('q1', { status: 'queued' }), 'user')
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    expect((await screen.findByRole('option', { name: /высокий/ })).getAttribute('aria-disabled')).toBe('true')
  })

  it('enables high priority for admins', async () => {
    show(task('q2', { status: 'queued' }), 'admin')
    await screen.findByRole('combobox')
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    expect((await screen.findByRole('option', { name: /высокий/ })).getAttribute('aria-disabled')).toBeNull()
  })
})
