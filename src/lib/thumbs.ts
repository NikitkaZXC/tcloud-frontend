import type { TFile } from './types'

export function thumbUrl(file: Pick<TFile, 'uuid' | 'kind' | 'updated_at'>): string | null {
  if (file.kind === 'audio') return null
  return `/api/files/${file.uuid}/thumb?v=${encodeURIComponent(file.updated_at)}`
}
