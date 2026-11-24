import { ApiError, errorMessage } from './api'
import { formatBytes } from './format'
import { type Key, t } from './i18n'
import type { ArchiveFormat, Priority } from './types'

export interface SelectionArchive {
  files: string[]
  folders: string[]
  format: ArchiveFormat
  priority: Priority
  name?: string
}

export function archiveName(storage: string | null | undefined): string | undefined {
  const name = storage?.replace(/[/\\\p{Cc}]+/gu, '-').trim().slice(0, 190)
  return name ? `${name}-${t('archive.selectedSuffix')}` : undefined
}

export function selectionPayload(keys: string[], format: ArchiveFormat, priority: Priority, name?: string): SelectionArchive {
  return {
    ...(name ? { name } : {}),
    files: keys.filter((key) => key.startsWith('f:')).map((key) => key.slice(2)),
    folders: keys.filter((key) => key.startsWith('d:')).map((key) => key.slice(2)),
    format,
    priority,
  }
}

const MESSAGES: Record<string, Key> = {
  empty_selection: 'archive.emptySelection',
  storage_mismatch: 'archive.storageMismatch',
  forbidden: 'archive.forbidden',
  file_not_found: 'archive.gone',
  folder_not_found: 'archive.gone',
  storage_not_found: 'error.storage_not_found',
  telegram_unauthorized: 'archive.telegramUnauthorized',
  insufficient_storage: 'archive.insufficientStorage',
  body_too_large: 'archive.bodyTooLarge',
}

export function archiveError(error: unknown): string {
  if (!(error instanceof ApiError)) return errorMessage(error)
  if (error.code === 'too_many_items') return t('archive.tooMany', { limit: Number(error.body.limit ?? 1000) })
  if (error.code === 'too_large' && typeof error.body.limit === 'number') return t('archive.tooLarge', { limit: formatBytes(error.body.limit) })
  return MESSAGES[error.code] ? t(MESSAGES[error.code]) : errorMessage(error)
}
