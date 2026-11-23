import { describe, expect, it } from 'vitest'
import { clampWidth, fitColumns, fitWidth, parseColumns, tableMinWidth } from './columns'

describe('columns', () => {
  it('clamps widths per column', () => {
    expect(clampWidth('name', 100)).toBe(160)
    expect(clampWidth('size', 10)).toBe(48)
    expect(clampWidth('type', 5000)).toBe(2000)
    expect(clampWidth('modified', 99.6)).toBe(100)
  })

  it('fits to the widest measured cell', () => {
    expect(fitWidth('type', [40.2, 77.1, 60])).toBe(78)
    expect(fitWidth('name', [90])).toBe(160)
    expect(fitWidth('size', [])).toBe(48)
    expect(fitWidth('uploaded', [9000])).toBe(2000)
  })

  it('parses the local copy tolerantly', () => {
    expect(parseColumns('{"name":300,"size":10,"bogus":5,"type":"x"}')).toEqual({ name: 300, size: 48 })
    expect(parseColumns('nope')).toEqual({})
    expect(parseColumns(null)).toEqual({})
    expect(parseColumns('[1]')).toEqual({})
  })

  it('sums visible columns with defaults and the name minimum', () => {
    expect(tableMinWidth({}, ['name', 'size'], 32)).toBe(32 + 160 + 110)
    expect(tableMinWidth({ name: 400, uploaded: 300 }, ['name'], 0)).toBe(400)
  })
})

describe('fitColumns', () => {
  it('adds columns in priority order until the next one does not fit', () => {
    expect(fitColumns(728, {}, 160)).toEqual({ name: true, size: true, modified: true, uploaded: false, type: false })
    expect(fitColumns(912, {}, 160)).toEqual({ name: true, size: true, modified: true, uploaded: true, type: true })
    expect(fitColumns(400, {}, 160)).toEqual({ name: true, size: false, modified: false, uploaded: false, type: false })
    expect(fitColumns(600, { size: 300 }, 160)).toEqual({ name: true, size: false, modified: false, uploaded: false, type: false })
  })
})
