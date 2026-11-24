import { QueryClient } from '@tanstack/react-query'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hintTask, taskHint } from '@/lib/steps'
import { trackTask } from '@/lib/tasks'
import type { Me } from '@/lib/types'
import { json, renderApp } from '@/test-utils'
import { Layout } from './layout'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const me = { id: 'u1', login: 'alice', role: 'user', grants: [], settings: {} } as unknown as Me

function mount(logout: Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => (url === '/api/auth/logout' ? logout : url === '/api/users/me' ? json(200, me) : url.startsWith('/api/tasks?') ? json(200, { items: [] }) : json(200, []))),
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  client.setQueryData(['me'], me)
  return renderApp(<Layout />, { client, path: '/dashboard' })
}

beforeEach(() => {
  localStorage.setItem('tcloud.sidebar', 'expanded')
  localStorage.setItem('tcloud.uploads.sessions', JSON.stringify([{ session_id: 's', expires_at: new Date(Date.now() + 60000).toISOString() }]))
  trackTask('t1')
  hintTask('t1', { encrypt: false })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  localStorage.clear()
})

describe('Layout logout', () => {
  it('clears user data and goes to /login, keeping prefs', async () => {
    const { router } = mount(new Response(null, { status: 204 }))
    await userEvent.setup().click(screen.getAllByRole('button', { name: 'Выйти' })[0])
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(JSON.parse(localStorage.getItem('tcloud.tasks')!)).toEqual([])
    expect(JSON.parse(localStorage.getItem('tcloud.tasks.pending')!)).toEqual([])
    expect(JSON.parse(localStorage.getItem('tcloud.uploads.sessions')!)).toEqual([])
    expect(taskHint('t1')).toBeUndefined()
    expect(localStorage.getItem('tcloud.sidebar')).toBe('expanded')
  })

  it('stays and shows a toast when logout fails', async () => {
    const { router } = mount(json(503, { error: { code: 'internal', message: 'x' } }))
    await userEvent.setup().click(screen.getAllByRole('button', { name: 'Выйти' })[0])
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(router.state.location.pathname).toBe('/dashboard')
    expect(JSON.parse(localStorage.getItem('tcloud.uploads.sessions')!)).toHaveLength(1)
    expect(taskHint('t1')).toBeDefined()
  })

  it('treats an expired session on logout as signed out', async () => {
    const { router } = mount(json(401, { error: { code: 'token_expired', message: 'x' } }))
    await userEvent.setup().click(screen.getAllByRole('button', { name: 'Выйти' })[0])
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })
})
