import type { Folder, TFile } from './types'

export type SortKey = 'name' | 'size' | 'date' | 'type'
export interface Sort {
  key: SortKey
  desc: boolean
}

export const SORT_LABELS: Record<SortKey, string> = { name: 'имя', size: 'размер', date: 'дата', type: 'тип' }

const collator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' })

const extension = (name: string) => (name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '')

function matches(name: string, query: string): boolean {
  return name.toLowerCase().includes(query.trim().toLowerCase())
}

function ordered<T>(items: T[], sort: Sort, compare: (a: T, b: T) => number, name: (item: T) => string): T[] {
  const sign = sort.desc ? -1 : 1
  return [...items].sort((a, b) => sign * (compare(a, b) || collator.compare(name(a), name(b))))
}

export function viewFiles(files: TFile[], query: string, sort: Sort): TFile[] {
  const compare = {
    name: (a: TFile, b: TFile) => collator.compare(a.name, b.name),
    size: (a: TFile, b: TFile) => a.size - b.size,
    date: (a: TFile, b: TFile) => Date.parse(a.updated_at) - Date.parse(b.updated_at),
    type: (a: TFile, b: TFile) => collator.compare(`${a.kind}.${extension(a.name)}`, `${b.kind}.${extension(b.name)}`),
  }[sort.key]
  return ordered(files.filter((f) => matches(f.name, query)), sort, compare, (f) => f.name)
}

export function viewFolders(folders: Folder[], query: string, sort: Sort): Folder[] {
  const compare =
    sort.key === 'date'
      ? (a: Folder, b: Folder) => Date.parse(a.updated_at) - Date.parse(b.updated_at)
      : (a: Folder, b: Folder) => collator.compare(a.name, b.name)
  return ordered(folders.filter((f) => matches(f.name, query)), sort.key === 'date' ? sort : { ...sort, desc: sort.key === 'name' && sort.desc }, compare, (f) => f.name)
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
