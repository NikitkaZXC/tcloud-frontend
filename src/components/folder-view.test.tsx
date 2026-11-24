import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/test-utils'
import { LoadMore } from './folder-view'

const observed = vi.fn()

class Observer {
  callback: IntersectionObserverCallback
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
  }
  observe() {
    observed()
    this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
  disconnect() {}
}

afterEach(() => {
  vi.unstubAllGlobals()
  observed.mockClear()
})

describe('LoadMore', () => {
  it('loads the next page when the sentinel is in view', () => {
    vi.stubGlobal('IntersectionObserver', Observer)
    const more = vi.fn()
    render(<LoadMore loading={false} failed={false} onMore={more} left={5} />)
    expect(more).toHaveBeenCalledTimes(1)
  })

  it('stops observing after a failed page and keeps a manual retry', async () => {
    vi.stubGlobal('IntersectionObserver', Observer)
    const more = vi.fn()
    render(<LoadMore loading={false} failed onMore={more} left={5} />)
    expect([observed.mock.calls.length, more.mock.calls.length]).toEqual([0, 0])
    await userEvent.setup().click(screen.getByRole('button', { name: /Показать ещё/ }))
    expect(more).toHaveBeenCalledTimes(1)
  })
})
