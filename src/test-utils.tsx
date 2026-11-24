import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach } from 'vitest'

afterEach(cleanup)

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

export const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

export function renderApp(ui: ReactNode, { client = new QueryClient({ defaultOptions: { queries: { retry: false } } }), path = '/' } = {}) {
  const router = createMemoryRouter(
    [
      { path: '*', element: ui },
      { path: '/login', element: <p>login page</p> },
    ],
    { initialEntries: [path] },
  )
  return { client, router, ...render(<QueryClientProvider client={client}>{<RouterProvider router={router} />}</QueryClientProvider>) }
}
