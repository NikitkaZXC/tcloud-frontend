import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, it, vi } from 'vitest'
import { RouteError } from './extras'

function Boom(): never {
  throw new TypeError('boom')
}

it('a render error shows the friendly message with a reload button', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const router = createMemoryRouter([{ path: '*', element: <Boom />, errorElement: <RouteError /> }])
  render(<RouterProvider router={router} />)
  expect(screen.getByRole('alert').textContent).toContain('Что-то пошло не так')
  expect(screen.getByRole('button', { name: 'Обновить страницу' })).toBeTruthy()
})
