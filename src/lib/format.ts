import { getLang, type Key, t } from './i18n'
const UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '—'
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit++
  }
  const digits = unit === 0 ? 0 : 1
  return `${value.toLocaleString(getLang(), { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${UNITS[unit]}`
}

export const filesCount = (n: number) => t('count.files', { n })

export function formatDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString(getLang()) : '—'
}

export const formatCount = (n: number) => (n < 10000 ? String(n) : new Intl.NumberFormat(getLang(), { notation: 'compact', maximumFractionDigits: 1 }).format(n).replace(/\s/g, ' '))

const shortDates = new Map<string, Intl.DateTimeFormat>()

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const lang = getLang()
  let format = shortDates.get(lang)
  if (!format) shortDates.set(lang, (format = new Intl.DateTimeFormat(lang, { dateStyle: 'short', timeStyle: 'short' })))
  return format.format(new Date(iso))
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—'
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const rest = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`
}

const SPANS: [number, Key][] = [
  [86400, 'duration.d'],
  [3600, 'duration.h'],
  [60, 'duration.min'],
  [1, 'duration.s'],
]

export function formatSpan(seconds: number): string {
  let rest = Math.max(Math.round(seconds), 0)
  const parts = SPANS.flatMap(([size, key]) => {
    const n = Math.floor(rest / size)
    rest %= size
    return n ? [t(key, { n })] : []
  })
  return parts.slice(0, 2).join(' ') || t('duration.s', { n: 0 })
}

export function joinPath(base: string, name: string): string {
  return `${base.replace(/\/+$/, '')}/${name.replace(/^\/+/, '')}`
}

export function parentPath(path: string): string {
  return path.slice(0, path.lastIndexOf('/'))
}

export function storageIdOf(path: string): string {
  return path.split('/')[1] ?? ''
}

export function crumbs(path: string): { name: string; path: string }[] {
  const parts = path.split('/').slice(2)
  return parts.map((name, i) => ({ name, path: ['tcloud', storageIdOf(path), ...parts.slice(0, i + 1)].join('/') }))
}

export function downloadUrl(file: { uuid: string }): string {
  return `/api/files/${file.uuid}/download`
}

function decoded(part: string): string {
  try {
    return decodeURIComponent(part)
  } catch {
    return part
  }
}

export function parseUrlLines(text: string, folder: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [, url, name] = line.match(/^(.*?)\s+\|\s+(.*)$/s) ?? [line, line, '']
      const fallback = decoded(new URL(url).pathname.split('/').filter(Boolean).pop() ?? '') || 'file'
      return { url, path: joinPath(folder, name || fallback) }
    })
}
