import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveTheme } from './theme'

function stubSystem(light: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: light && query === '(prefers-color-scheme: light)' }))
}

describe('resolveTheme', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('keeps explicit themes', () => {
    stubSystem(true)
    expect(resolveTheme('dark')).toBe('dark')
    expect(resolveTheme('light')).toBe('light')
  })

  it('follows the OS for system', () => {
    stubSystem(true)
    expect(resolveTheme('system')).toBe('light')
    stubSystem(false)
    expect(resolveTheme('system')).toBe('dark')
  })

  it('falls back to dark without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(resolveTheme('system')).toBe('dark')
  })
})
