import { ApiError, errorMessage } from './api'
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
  return name ? `${name}-выбранное` : undefined
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

const MESSAGES: Record<string, string> = {
  empty_selection: 'Ничего не выбрано',
  storage_mismatch: 'Архив собирается только из одного хранилища',
  forbidden: 'Нет доступа к части выбранного',
  file_not_found: 'Часть выбранного уже удалена — обновите папку',
  folder_not_found: 'Часть выбранного уже удалена — обновите папку',
  storage_not_found: 'Хранилище не найдено',
  telegram_unauthorized: 'Telegram не подключён: нужен вход сессии upload',
  insufficient_storage: 'На сервере не хватает места для архива',
}

export function archiveError(error: unknown): string {
  if (!(error instanceof ApiError)) return errorMessage(error)
  if (error.code === 'too_many_items') return `Слишком много элементов: не больше ${error.body.limit ?? 1000} за раз`
  return MESSAGES[error.code] ?? errorMessage(error)
}
