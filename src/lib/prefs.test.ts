import { afterEach, describe, expect, it, vi } from 'vitest'
import { load, save } from './prefs'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('prefs', () => {
  it('stores values under the tcloud. prefix', () => {
    save('sidebar', 'collapsed')
    expect(localStorage.getItem('tcloud.sidebar')).toBe('collapsed')
    expect(load('sidebar')).toBe('collapsed')
    expect(load('missing')).toBeNull()
  })

  it('never throws when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(() => save('sidebar', 'x')).not.toThrow()
    expect(load('sidebar')).toBeNull()
  })
})
