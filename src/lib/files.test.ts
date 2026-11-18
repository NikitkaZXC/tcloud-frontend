import { describe, expect, it } from 'vitest'
import { DEFAULT_SORT, nextSort, parseSort, selectRange, type Sort, viewEntries } from './files'
import type { Folder, TFile } from './types'

const file = (name: string, size: number, updated_at: string, kind: TFile['kind'] = 'document', created_at = '2026-01-01T00:00:00Z') =>
  ({ uuid: name, name, size, updated_at, created_at, kind }) as TFile
const folder = (name: string, updated_at = '2026-01-01T00:00:00Z', size?: number) => ({ name, updated_at, created_at: updated_at, size }) as Folder
const names = (folders: Folder[], files: TFile[], sort: Partial<Sort>, query = '') => viewEntries(folders, files, query, { ...DEFAULT_SORT, ...sort }).map((e) => e.item.name)

describe('folder listing order', () => {
  it('uses natural, case-insensitive order for Latin and Cyrillic', () => {
    const files = [file('IMG10.jpg', 1, ''), file('img2.jpg', 1, ''), file('фото 10', 1, ''), file('Фото 9', 1, ''), file('file100', 1, ''), file('file2', 1, '')]
    expect(names([], files, {})).toEqual(['Фото 9', 'фото 10', 'file2', 'file100', 'img2.jpg', 'IMG10.jpg'])
  })

  it('keeps folders first in both directions when the toggle is on', () => {
    const folders = [folder('b'), folder('a10'), folder('a2')]
    const files = [file('z.txt', 1, ''), file('a.txt', 1, '')]
    expect(names(folders, files, {})).toEqual(['a2', 'a10', 'b', 'a.txt', 'z.txt'])
    expect(names(folders, files, { desc: true })).toEqual(['b', 'a10', 'a2', 'z.txt', 'a.txt'])
  })

  it('mixes folders with files like Finder when the toggle is off', () => {
    const folders = [folder('b'), folder('d')]
    const files = [file('c.txt', 1, ''), file('a.txt', 1, '')]
    expect(names(folders, files, { foldersFirst: false })).toEqual(['a.txt', 'b', 'c.txt', 'd'])
    expect(names(folders, files, { foldersFirst: false, desc: true })).toEqual(['d', 'c.txt', 'b', 'a.txt'])
  })

  it('sorts by size, dates and type with name as tie-breaker', () => {
    const files = [
      file('b.txt', 5, '2026-01-03T00:00:00Z', 'document', '2026-01-01T00:00:00Z'),
      file('a.jpg', 50, '2026-01-01T00:00:00Z', 'photo', '2026-01-03T00:00:00Z'),
      file('c.txt', 5, '2026-01-02T00:00:00Z', 'document', '2026-01-02T00:00:00Z'),
    ]
    const folders = [folder('big', '2026-01-01T00:00:00Z', 100), folder('small', '2026-01-01T00:00:00Z', 1)]
    expect(names(folders, files, { key: 'size' })).toEqual(['small', 'big', 'b.txt', 'c.txt', 'a.jpg'])
    expect(names([], files, { key: 'modified' })).toEqual(['a.jpg', 'c.txt', 'b.txt'])
    expect(names([], files, { key: 'uploaded', desc: true })).toEqual(['a.jpg', 'c.txt', 'b.txt'])
    expect(names([], files, { key: 'type' })).toEqual(['a.jpg', 'b.txt', 'c.txt'])
    expect(names(folders, files, { key: 'size', foldersFirst: false })).toEqual(['small', 'b.txt', 'c.txt', 'a.jpg', 'big'])
  })

  it('filters by name and cycles the header sort', () => {
    expect(names([folder('Bar')], [file('b10.txt', 1, ''), file('a.txt', 1, '')], {}, 'b')).toEqual(['Bar', 'b10.txt'])
    expect(nextSort(DEFAULT_SORT, 'name')).toEqual({ ...DEFAULT_SORT, desc: true })
    expect(nextSort({ ...DEFAULT_SORT, desc: true }, 'size')).toEqual({ ...DEFAULT_SORT, key: 'size' })
    expect(parseSort('{"key":"created","desc":true,"foldersFirst":false}')).toEqual({ key: 'uploaded', desc: true, foldersFirst: false })
    expect(parseSort('garbage')).toEqual(DEFAULT_SORT)
    expect(parseSort(null)).toEqual(DEFAULT_SORT)
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
