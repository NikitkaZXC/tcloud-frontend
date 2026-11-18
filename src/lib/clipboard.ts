import { toast } from 'sonner'
import { t } from './i18n'

export async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(t('clipboard.copied', { what }))
  } catch {
    toast.error(t('clipboard.denied'))
  }
}

export function absoluteUrl(path: string): string {
  return new URL(path, location.origin).href
}
