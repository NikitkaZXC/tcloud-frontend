import { describe, expect, it } from 'vitest'
import { InfiniteQueryObserver, QueryClient } from '@tanstack/react-query'
import { DEFAULT_SORT, listingEntries, listingKey, listingParams, nextSort, parseSort, selectRange, type Sort } from './files'
import type { Folder, FolderListing, TFile } from './types'

const file = (name: string, size: number, updated_at: string, kind: TFile['kind'] = 'document', created_at = '2026-01-01T00:00:00Z') =>
  ({ uuid: name, name, size, updated_at, created_at, kind }) as TFile
const folder = (name: string, updated_at = '2026-01-01T00:00:00Z', size?: number) => ({ name, updated_at, created_at: updated_at, size }) as Folder
const page = (items: FolderListing['items'], next_cursor: string | null = null) => ({ items, next_cursor }) as FolderListing
const fileItem = (name: string) => ({ ...file(name, 1, ''), type: 'file' as const })
const folderItem = (name: string) => ({ ...folder(name), path: `tcloud/s/${name}`, type: 'folder' as const })

describe('folder listing pages', () => {
  it('merges pages in server order and drops repeats', () => {
    const entries = listingEntries([page([folderItem('b'), fileItem('a.txt')], 'c1'), page([fileItem('a.txt'), fileItem('z.txt')])])
    expect(entries.map((e) => [e.type, e.item.name])).toEqual([
      ['folder', 'b'],
      ['file', 'a.txt'],
      ['file', 'z.txt'],
    ])
    expect(listingEntries([])).toEqual([])
  })

  it('puts every sort param and the language into the query key', () => {
    expect(listingParams({ key: 'size', desc: true, foldersFirst: false }, 'en')).toEqual({ sort_by: 'size', sort_order: 'desc', folders_first: false, lang: 'en' })
    expect(listingKey('tcloud/s', DEFAULT_SORT, 'ru')).toEqual(['folder', 'tcloud/s', { sort_by: 'name', sort_order: 'asc', folders_first: true, lang: 'ru' }])
  })

  it('starts a new listing from the first page when the sort changes', async () => {
    const client = new QueryClient()
    const calls: (string | undefined)[] = []
    const observe = (sort: Sort) =>
      new InfiniteQueryObserver(client, {
        queryKey: listingKey('tcloud/s', sort, 'ru'),
        queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
          calls.push(pageParam)
          return page([fileItem(`${sort.key}-${pageParam ?? 0}`)], pageParam ? null : 'c1')
        },
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (last: FolderListing) => last.next_cursor ?? undefined,
      })
    const byName = observe(DEFAULT_SORT)
    await byName.fetchNextPage()
    await byName.fetchNextPage()
    expect(byName.getCurrentResult().data?.pages).toHaveLength(2)
    const bySize = observe({ ...DEFAULT_SORT, key: 'size' })
    await bySize.refetch()
    expect(bySize.getCurrentResult().data?.pages.map((p) => p.items[0].name)).toEqual(['size-0'])
    expect(calls).toEqual([undefined, 'c1', undefined])
    await client.invalidateQueries({ queryKey: ['folder', 'tcloud/s'] })
    await byName.refetch()
    expect(calls.slice(3, 5)).toEqual([undefined, 'c1'])
  })

  it('cycles the header sort and parses old values', () => {
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
