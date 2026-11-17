import type { Storage, TelegramSessionState } from './types'

export interface Step {
  key: 'telegram' | 'storage' | 'file'
  label: string
  done: boolean
  to: string
  action: string
}

const folderLink = (path: string) => `/files?path=${encodeURIComponent(path)}`

export function checklist(sessions: TelegramSessionState[], storages: Storage[]): Step[] {
  const authorized = sessions.filter((s) => s.authorized).length
  const target = storages.find((s) => s.available) ?? storages[0]
  return [
    {
      key: 'telegram',
      label: `Войти в Telegram (${authorized} / ${sessions.length || 3} сессий)`,
      done: sessions.length > 0 && authorized === sessions.length,
      to: '/telegram',
      action: 'Войти',
    },
    { key: 'storage', label: 'Создать хранилище', done: storages.length > 0, to: '/files', action: 'Создать' },
    {
      key: 'file',
      label: 'Загрузить первый файл',
      done: storages.some((s) => (s.files ?? 0) > 0),
      to: target ? folderLink(target.path) : '/files',
      action: 'Загрузить',
    },
  ]
}

const KEY = 'tcloud.onboarding.dismissed'

export function isDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function dismiss() {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    return
  }
}
