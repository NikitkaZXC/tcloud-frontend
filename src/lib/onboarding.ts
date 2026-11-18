import type { Storage, Task, TelegramSessionState } from './types'
import { t } from './i18n'

export interface Step {
  key: 'telegram' | 'storage' | 'file'
  label: string
  done: boolean
  to: string
  action: string
}

const folderLink = (path: string) => `/files?path=${encodeURIComponent(path)}`

export function checklist(sessions: TelegramSessionState[], storages: Storage[], tasks: Task[] = []): Step[] {
  const authorized = sessions.filter((s) => s.authorized).length
  const target = storages.find((s) => s.available !== false) ?? storages[0]
  return [
    {
      key: 'telegram',
      label: t('onboarding.telegram', { done: authorized, n: sessions.length || 3 }),
      done: sessions.length > 0 && authorized === sessions.length,
      to: '/telegram',
      action: t('onboarding.signIn'),
    },
    { key: 'storage', label: t('onboarding.storage'), done: storages.length > 0, to: '/files', action: t('onboarding.create') },
    {
      key: 'file',
      label: t('onboarding.file'),
      done: storages.some((s) => (s.files ?? 0) > 0) || tasks.some((t) => !t.archive && t.status === 'done'),
      to: target ? folderLink(target.path) : '/files',
      action: t('onboarding.upload'),
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
