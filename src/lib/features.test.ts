import { describe, expect, it } from 'vitest'
import { isOn, setFeature } from './features'
import { pour, scatter } from './particles'

describe('features', () => {
  it('are off by default and switchable', () => {
    const store = new Map<string, string>()
    globalThis.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) } as unknown as Storage
    expect(isOn('pet')).toBe(false)
    setFeature('pet', true)
    expect(isOn('pet')).toBe(true)
    expect(store.get('tcloud.feature.pet')).toBe('on')
  })
})

describe('particles', () => {
  it('pours into the target and scatters upwards, deterministically', () => {
    const into = pour({ x: 100, y: 100 }, { x: 10, y: 10 }, 20)
    expect(into).toHaveLength(20)
    expect(into.every((p) => Math.abs(p.to.x - 10) <= 5 && Math.abs(p.to.y - 10) <= 3)).toBe(true)
    expect(pour({ x: 100, y: 100 }, { x: 10, y: 10 }, 20)).toEqual(into)
    expect(scatter({ x: 0, y: 0 }, 10).every((p) => p.to.y < 0)).toBe(true)
  })
})
