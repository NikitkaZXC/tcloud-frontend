import type { Folder, TFile } from './types'

export type SortKey = 'name' | 'modified' | 'uploaded' | 'type' | 'size'
export interface Sort {
  key: SortKey
  desc: boolean
  foldersFirst: boolean
}

export const DEFAULT_SORT: Sort = { key: 'name', desc: false, foldersFirst: true }

export const SORT_LABELS: Record<SortKey, string> = { name: 'Имя', modified: 'Изменён', uploaded: 'Загружен', type: 'Тип', size: 'Размер' }

export type Entry = { type: 'folder'; item: Folder } | { type: 'file'; item: TFile }

const collator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' })

const extension = (name: string) => (name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '')

export function typeLabel(entry: Entry): string {
  if (entry.type === 'folder') return 'папка'
  return extension(entry.item.name) || entry.item.kind
}

function matches(name: string, query: string): boolean {
  return name.toLowerCase().includes(query.trim().toLowerCase())
}

const time = (iso: string) => Date.parse(iso) || 0

const size = (entry: Entry) => entry.item.size

const COMPARE: Record<SortKey, (a: Entry, b: Entry) => number> = {
  name: () => 0,
  modified: (a, b) => time(a.item.updated_at) - time(b.item.updated_at),
  uploaded: (a, b) => time(a.item.created_at) - time(b.item.created_at),
  type: (a, b) => collator.compare(typeLabel(a), typeLabel(b)),
  size: (a, b) => size(a) - size(b),
}

export function viewEntries(folders: Folder[], files: TFile[], query: string, sort: Sort): Entry[] {
  const entries: Entry[] = [
    ...folders.filter((f) => matches(f.name, query)).map((item) => ({ type: 'folder' as const, item })),
    ...files.filter((f) => matches(f.name, query)).map((item) => ({ type: 'file' as const, item })),
  ]
  const sign = sort.desc ? -1 : 1
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      if (sort.foldersFirst && a.entry.type !== b.entry.type) return a.entry.type === 'folder' ? -1 : 1
      return sign * (COMPARE[sort.key](a.entry, b.entry) || collator.compare(a.entry.item.name, b.entry.item.name)) || a.index - b.index
    })
    .map(({ entry }) => entry)
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
