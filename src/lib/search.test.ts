import { describe, expect, it } from 'vitest'
import { foundLocation } from './names'
import { getLang } from './i18n'
import type { FoundFile, SearchResult } from './types'
import { defaultScope, foundFiles, isDesc, EMPTY_SEARCH, hasCriteria, parseSearch, searchQuery, searchUrl, scopePath } from './search'

const sid = '0190a2b4-0000-7000-8000-000000000000'
const folder = `tcloud/${sid}/trip/day 1`

describe('search state', () => {
  it('defaults the scope to the current folder, the storage at its root, else everywhere', () => {
    expect(defaultScope(folder)).toBe('folder')
    expect(defaultScope(`tcloud/${sid}`)).toBe('storage')
    expect(defaultScope(null)).toBe('all')
    expect(parseSearch(new URLSearchParams('scope=folder')).scope).toBe('all')
  })

  it('round-trips through the URL', () => {
    const state = { ...EMPTY_SEARCH, q: 'отпуск', in: folder, scope: 'storage' as const, kinds: ['photo' as const, 'video' as const], mimes: ['image/jpeg', 'image/png'], sizeMin: 1024, dateFrom: '2026-01-02', encrypted: true, sort: 'size' as const, desc: false }
    const url = searchUrl(state)
    expect(url.startsWith('/search?')).toBe(true)
    expect(parseSearch(new URLSearchParams(url.split('?')[1]))).toEqual(state)
    expect(searchUrl(EMPTY_SEARCH)).toBe('/search')
  })

  it('ignores junk in the URL', () => {
    const state = parseSearch(new URLSearchParams('kind=pdf&kind=audio&size_min=-5&from=yesterday&sort=x&order=up&mime=&mime=a/b&mime=a/b'))
    expect(state).toEqual({ ...EMPTY_SEARCH, kinds: ['audio'], mimes: ['a/b'] })
  })

  it('builds the API query with repeated kinds and the scope path', () => {
    const state = { ...EMPTY_SEARCH, q: '  cat ', in: folder, scope: 'storage' as const, kinds: ['photo' as const, 'video' as const], mimes: ['image/png', 'video/mp4'], sizeMax: 10, encrypted: true }
    const params = new URLSearchParams(searchQuery(state, 50, 50))
    expect(params.get('q')).toBe('cat')
    expect(params.get('path')).toBe(`tcloud/${sid}`)
    expect(params.getAll('kind')).toEqual(['photo', 'video'])
    expect(params.getAll('mime')).toEqual(['image/png', 'video/mp4'])
    expect(params.get('size_max')).toBe('10')
    expect(params.get('encrypted')).toBe('true')
    expect(params.get('offset')).toBe('50')
    expect(params.has('sort')).toBe(false)
    expect(params.get('lang')).toBe(getLang())
    expect(scopePath({ scope: 'folder', in: folder })).toBe(folder)
    expect(scopePath({ scope: 'all', in: folder })).toBeUndefined()
  })

  it('sends whole local days as an ISO range', () => {
    const params = new URLSearchParams(searchQuery({ ...EMPTY_SEARCH, dateFrom: '2026-03-01', dateTo: '2026-03-01' }))
    expect(Date.parse(params.get('date_to')!) - Date.parse(params.get('date_from')!)).toBe(86399999)
  })

  it('uses the backend default order per sort', () => {
    expect(isDesc({ sort: 'date', desc: null })).toBe(true)
    expect(isDesc({ sort: 'name', desc: null })).toBe(false)
    expect(isDesc({ sort: 'size', desc: false })).toBe(false)
  })

  it('needs a query or a filter', () => {
    expect(hasCriteria({ ...EMPTY_SEARCH, q: '   ', in: folder })).toBe(false)
    expect(hasCriteria({ ...EMPTY_SEARCH, encrypted: true })).toBe(true)
  })
})

describe('found location', () => {
  it('names the storage and folders, never the uuid', () => {
    expect(foundLocation(folder, { storage_id: sid, storage_name: 'Фото' })).toBe('Фото › trip › day 1')
    expect(foundLocation(`tcloud/${sid}`, { storage_id: sid, storage_name: null }, [{ id: sid, name: 'Архив' }])).toBe('Архив')
    expect(foundLocation(folder, { storage_id: sid, storage_name: null })).toBe('хранилище › trip › day 1')
  })
})

it('drops files repeated across offset pages', () => {
  const page = (...ids: string[]) => ({ items: ids.map((uuid) => ({ uuid }) as FoundFile) }) as SearchResult
  expect(foundFiles([page('a', 'b'), page('b', 'c')]).map((f) => f.uuid)).toEqual(['a', 'b', 'c'])
})
