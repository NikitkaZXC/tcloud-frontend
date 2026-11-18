import { storageIdOf } from './format'
import type { TFile } from './types'
import type { Key } from './i18n'

export type Scope = 'folder' | 'storage' | 'all'
export type SearchSort = 'relevance' | 'name' | 'size' | 'date'
export type Kind = TFile['kind']

export interface SearchState {
  q: string
  scope: Scope
  in: string | null
  kinds: Kind[]
  mime: string | null
  sizeMin: number | null
  sizeMax: number | null
  dateFrom: string
  dateTo: string
  encrypted: boolean
  sort: SearchSort
  desc: boolean | null
}

export const KINDS: [Kind, Key][] = [
  ['photo', 'kind.photo'],
  ['video', 'kind.video'],
  ['audio', 'kind.audio'],
  ['animation', 'kind.animation'],
  ['document', 'kind.document'],
]
export const SCOPES: [Scope, Key][] = [
  ['folder', 'scope.folder'],
  ['storage', 'scope.storage'],
  ['all', 'scope.all'],
]
export const SEARCH_SORTS: [SearchSort, Key][] = [
  ['relevance', 'searchSort.relevance'],
  ['name', 'searchSort.name'],
  ['size', 'searchSort.size'],
  ['date', 'searchSort.date'],
]
export const SIZE_UNITS: [string, number][] = [
  ['KB', 1024],
  ['MB', 1024 ** 2],
  ['GB', 1024 ** 3],
]

export const EMPTY_SEARCH: SearchState = {
  q: '',
  scope: 'all',
  in: null,
  kinds: [],
  mime: null,
  sizeMin: null,
  sizeMax: null,
  dateFrom: '',
  dateTo: '',
  encrypted: false,
  sort: 'relevance',
  desc: null,
}

const isRoot = (path: string) => path.split('/').length <= 2

export function scopesFor(where: string | null): Scope[] {
  if (!where) return ['all']
  return isRoot(where) ? ['storage', 'all'] : ['folder', 'storage', 'all']
}

export function defaultScope(where: string | null): Scope {
  return scopesFor(where)[0]
}

const bytes = (value: string | null) => (value && /^\d+$/.test(value) ? Number(value) : null)
const day = (value: string | null) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '')

export function parseSearch(params: URLSearchParams): SearchState {
  const where = params.get('in') || null
  const scope = params.get('scope') as Scope
  const sort = params.get('sort') as SearchSort
  const order = params.get('order')
  return {
    q: params.get('q') ?? '',
    in: where,
    scope: scopesFor(where).includes(scope) ? scope : defaultScope(where),
    kinds: params.getAll('kind').filter((kind): kind is Kind => KINDS.some(([k]) => k === kind)),
    mime: params.get('mime') || null,
    sizeMin: bytes(params.get('size_min')),
    sizeMax: bytes(params.get('size_max')),
    dateFrom: day(params.get('from')),
    dateTo: day(params.get('to')),
    encrypted: params.get('enc') === '1',
    sort: SEARCH_SORTS.some(([s]) => s === sort) ? sort : 'relevance',
    desc: order === 'desc' ? true : order === 'asc' ? false : null,
  }
}

export function searchUrl(state: SearchState): string {
  const params = new URLSearchParams()
  if (state.q) params.set('q', state.q)
  if (state.in) params.set('in', state.in)
  if (state.in && state.scope !== defaultScope(state.in)) params.set('scope', state.scope)
  state.kinds.forEach((kind) => params.append('kind', kind))
  if (state.mime) params.set('mime', state.mime)
  if (state.sizeMin != null) params.set('size_min', String(state.sizeMin))
  if (state.sizeMax != null) params.set('size_max', String(state.sizeMax))
  if (state.dateFrom) params.set('from', state.dateFrom)
  if (state.dateTo) params.set('to', state.dateTo)
  if (state.encrypted) params.set('enc', '1')
  if (state.sort !== 'relevance') params.set('sort', state.sort)
  if (state.desc != null) params.set('order', state.desc ? 'desc' : 'asc')
  const qs = params.toString()
  return qs ? `/search?${qs}` : '/search'
}

export function isDesc(state: Pick<SearchState, 'sort' | 'desc'>): boolean {
  return state.desc ?? (state.sort === 'size' || state.sort === 'date')
}

export function scopePath(state: Pick<SearchState, 'scope' | 'in'>): string | undefined {
  if (!state.in || state.scope === 'all') return undefined
  return state.scope === 'storage' ? `tcloud/${storageIdOf(state.in)}` : state.in
}

export function hasFilters(state: SearchState): boolean {
  return state.kinds.length > 0 || !!state.mime || state.sizeMin != null || state.sizeMax != null || !!state.dateFrom || !!state.dateTo || state.encrypted
}

export function hasCriteria(state: SearchState): boolean {
  return !!state.q.trim() || hasFilters(state)
}

export function searchQuery(state: SearchState, offset = 0, limit = 50): string {
  const params = new URLSearchParams()
  if (state.q.trim()) params.set('q', state.q.trim())
  const path = scopePath(state)
  if (path) params.set('path', path)
  state.kinds.forEach((kind) => params.append('kind', kind))
  if (state.mime) params.append('mime', state.mime)
  if (state.sizeMin != null) params.set('size_min', String(state.sizeMin))
  if (state.sizeMax != null) params.set('size_max', String(state.sizeMax))
  if (state.dateFrom) params.set('date_from', new Date(`${state.dateFrom}T00:00:00`).toISOString())
  if (state.dateTo) params.set('date_to', new Date(`${state.dateTo}T23:59:59.999`).toISOString())
  if (state.encrypted) params.set('encrypted', 'true')
  if (state.sort !== 'relevance') params.set('sort', state.sort)
  if (state.desc != null) params.set('order', state.desc ? 'desc' : 'asc')
  params.set('limit', String(limit))
  params.set('offset', String(offset))
  return params.toString()
}
