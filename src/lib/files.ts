import type { Folder, FolderListing, TFile } from './types'
import { type Key, type Lang, t } from './i18n'

export type SortKey = 'name' | 'modified' | 'uploaded' | 'type' | 'size'
export interface Sort {
  key: SortKey
  desc: boolean
  foldersFirst: boolean
}

export const DEFAULT_SORT: Sort = { key: 'name', desc: false, foldersFirst: true }

export const SORT_LABELS: Record<SortKey, Key> = { name: 'sort.name', modified: 'sort.modified', uploaded: 'sort.uploaded', type: 'sort.type', size: 'sort.size' }

export type Entry = { type: 'folder'; item: Folder } | { type: 'file'; item: TFile }

const extension = (name: string) => (name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '')

export function typeLabel(entry: Entry): string {
  if (entry.type === 'folder') return t('files.folderType')
  return extension(entry.item.name) || entry.item.kind
}

export const PAGE_SIZES = [20, 50, 100, 200] as const
export type PageSize = (typeof PAGE_SIZES)[number]

export function pageSize(value: unknown): PageSize {
  return PAGE_SIZES.find((size) => size === Number(value)) ?? PAGE_SIZES[0]
}

export function listingParams(sort: Sort, lang: Lang, limit: PageSize) {
  return { sort_by: sort.key, sort_order: sort.desc ? 'desc' : 'asc', folders_first: sort.foldersFirst, lang, limit } as const
}

export const listingKey = (path: string, sort: Sort, lang: Lang, limit: PageSize) => ['folder', path, listingParams(sort, lang, limit)] as const

export function listingEntries(pages: FolderListing[]): Entry[] {
  const seen = new Set<string>()
  return pages
    .flatMap((page) => page.items)
    .filter((item) => {
      const id = item.type === 'folder' ? `d:${item.path}` : `f:${item.uuid}`
      return !seen.has(id) && !!seen.add(id)
    })
    .map((item) => (item.type === 'folder' ? { type: 'folder' as const, item } : { type: 'file' as const, item }))
}

export function parseSort(raw: string | null): Sort {
  try {
    const value = JSON.parse(raw ?? '{}') as Partial<Sort>
    const key = ({ updated: 'modified', created: 'uploaded' } as Record<string, SortKey>)[value.key ?? ''] ?? value.key
    return {
      key: key && key in SORT_LABELS ? key : DEFAULT_SORT.key,
      desc: value.desc === true,
      foldersFirst: value.foldersFirst !== false,
    }
  } catch {
    return DEFAULT_SORT
  }
}

export function nextSort(sort: Sort, key: SortKey): Sort {
  return sort.key === key ? { ...sort, desc: !sort.desc } : { ...sort, key, desc: false }
}

export function selectRange(order: string[], selected: Set<string>, anchor: string | null, key: string, shift: boolean): Set<string> {
  const next = new Set(selected)
  const from = anchor ? order.indexOf(anchor) : -1
  const to = order.indexOf(key)
  if (shift && from >= 0 && to >= 0) {
    const value = selected.has(anchor!)
    for (const item of order.slice(Math.min(from, to), Math.max(from, to) + 1)) {
      if (value) next.add(item)
      else next.delete(item)
    }
    return next
  }
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}
