import { afterEach, describe, expect, it, vi } from 'vitest'

function stubStorage(initial: Record<string, string> = {}) {
  const data = { ...initial }
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value
    },
  })
  return data
}

describe('theme', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('defaults to dark and reads a saved light theme', async () => {
    stubStorage()
    const { readTheme } = await import('./theme')
    expect(readTheme()).toBe('dark')
    stubStorage({ 'tcloud.theme': 'light' })
    expect(readTheme()).toBe('light')
    stubStorage({ 'tcloud.theme': 'garbage' })
    expect(readTheme()).toBe('dark')
  })

  it('saves the choice and toggles the root class', async () => {
    const data = stubStorage()
    const toggle = vi.fn()
    vi.stubGlobal('document', { documentElement: { classList: { toggle } } })
    const { setTheme, readTheme } = await import('./theme')
    setTheme('light')
    expect(data['tcloud.theme']).toBe('light')
    expect(readTheme()).toBe('light')
    expect(toggle).toHaveBeenCalledWith('light', true)
  })

  it('falls back to dark when storage throws', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
    })
    const { readTheme } = await import('./theme')
    expect(readTheme()).toBe('dark')
  })
})
