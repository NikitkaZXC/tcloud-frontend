import { QueryClient } from '@tanstack/react-query'
import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Me, Role, User } from '@/lib/types'
import { json, renderApp } from '@/test-utils'
import { DashboardPage } from './dashboard'
import { UserPage } from './user'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

function serve(users: Record<string, User> = {}) {
  const fetch = vi.fn(async (url: string) => {
    const path = url.split('?')[0]
    if (path === '/api/telegram') return json(200, { sessions: [] })
    if (path === '/api/tasks/counts') return json(200, { total: 0, by_status: {} })
    if (path === '/api/account') return json(200, { telegram_connected: false })
    if (path === '/api/health') return json(200, { status: 'ok' })
    const user = users[path.slice('/api/users/'.length)]
    if (user) return json(200, user)
    return json(200, [])
  })
  vi.stubGlobal('fetch', fetch)
  return () => fetch.mock.calls.map(([url]) => url.split('?')[0])
}

function client(role: Role) {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  c.setQueryData(['me'], { id: 'me', role, grants: [], settings: {} } as unknown as Me)
  return c
}

afterEach(() => vi.unstubAllGlobals())

describe('dashboard by role', () => {
  it.each([
    ['user', false, false],
    ['admin', true, false],
    ['root', true, true],
  ] as const)('%s: users block %s, first-run checklist %s', async (role, users, checklist) => {
    const urls = serve()
    renderApp(<DashboardPage />, { client: client(role), path: '/dashboard' })
    await waitFor(() => expect(urls()).toContain('/api/storages'))
    expect(urls().includes('/api/users')).toBe(users)
    expect(urls().includes('/api/telegram')).toBe(checklist)
  })
})

describe('user page by role', () => {
  const target = (role: Role) => ({ id: 'u2', login: 'bob', role, blocked: false, created_at: '', updated_at: '' }) as unknown as User

  it.each([
    ['admin', 'user', true],
    ['admin', 'admin', false],
    ['root', 'admin', true],
    ['root', 'root', false],
  ] as const)('%s viewing %s sees unfinished uploads: %s', async (viewer, role, shown) => {
    const urls = serve({ u2: target(role) })
    renderApp(<UserPage />, { client: client(viewer), path: '/users/u2', route: '/users/:id' })
    await screen.findByText('bob')
    await waitFor(() => expect(urls()).toContain('/api/users/u2/api-keys'))
    expect(urls().includes('/api/uploads/sessions')).toBe(shown)
  })
})
