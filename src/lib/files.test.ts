import { describe, expect, it } from 'vitest'
import { selectRange, viewFiles, viewFolders } from './files'
import type { Folder, TFile } from './types'

const file = (name: string, size: number, updated_at: string, kind: TFile['kind'] = 'document') => ({ uuid: name, name, size, updated_at, kind }) as TFile
const files = [file('b10.txt', 5, '2026-01-03T00:00:00Z'), file('B2.jpg', 50, '2026-01-01T00:00:00Z', 'photo'), file('a.txt', 1, '2026-01-02T00:00:00Z')]

describe('folder listing view', () => {
  it('filters by name case-insensitively and sorts', () => {
    expect(viewFiles(files, 'b', { key: 'name', desc: false }).map((f) => f.name)).toEqual(['B2.jpg', 'b10.txt'])
    expect(viewFiles(files, '', { key: 'size', desc: true }).map((f) => f.name)).toEqual(['B2.jpg', 'b10.txt', 'a.txt'])
    expect(viewFiles(files, '', { key: 'date', desc: false }).map((f) => f.name)).toEqual(['B2.jpg', 'a.txt', 'b10.txt'])
    expect(viewFiles(files, '', { key: 'type', desc: false }).map((f) => f.name)).toEqual(['a.txt', 'b10.txt', 'B2.jpg'])
  })

  it('keeps folders sorted by name unless sorting by date', () => {
    const folders = [{ name: 'z', updated_at: '2026-01-01T00:00:00Z' }, { name: 'a', updated_at: '2026-01-02T00:00:00Z' }] as Folder[]
    expect(viewFolders(folders, '', { key: 'size', desc: true }).map((f) => f.name)).toEqual(['a', 'z'])
    expect(viewFolders(folders, '', { key: 'date', desc: true }).map((f) => f.name)).toEqual(['a', 'z'])
    expect(viewFolders(folders, '', { key: 'name', desc: true }).map((f) => f.name)).toEqual(['z', 'a'])
  })
})

describe('selection', () => {
  const order = ['a', 'b', 'c', 'd', 'e']
  it('toggles one item and selects a shift range from the anchor', () => {
    const one = selectRange(order, new Set(), null, 'b', false)
    expect([...one]).toEqual(['b'])
    expect([...selectRange(order, one, 'b', 'd', true)].sort()).toEqual(['b', 'c', 'd'])
    expect([...selectRange(order, new Set(['a', 'b', 'c', 'd']), 'd', 'b', false)].sort()).toEqual(['a', 'c', 'd'])
    expect([...selectRange(order, new Set(['a', 'c', 'd']), 'b', 'd', true)].sort()).toEqual(['a'])
  })
})
