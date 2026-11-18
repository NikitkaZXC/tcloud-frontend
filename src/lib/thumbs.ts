import type { TFile } from './types'

const THUMB_KINDS: TFile['kind'][] = ['photo', 'video', 'animation']

export function thumbUrl(file: Pick<TFile, 'uuid' | 'kind' | 'encrypted' | 'updated_at'>): string | null {
  if (file.encrypted || !THUMB_KINDS.includes(file.kind)) return null
  return `/api/files/${file.uuid}/thumb?v=${encodeURIComponent(file.updated_at)}`
}
