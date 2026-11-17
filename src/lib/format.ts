const UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '—'
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit++
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${UNITS[unit]}`
}

export function formatDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString() : '—'
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—'
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const rest = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`
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

export function parseUrlLines(text: string, folder: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [url, name] = line.split('|').map((part) => part.trim())
      const fallback = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() ?? '') || 'file'
      return { url, path: joinPath(folder, name || fallback) }
    })
}
