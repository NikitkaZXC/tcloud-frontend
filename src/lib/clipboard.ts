import { toast } from 'sonner'

export async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`Скопировано: ${what}`)
  } catch {
    toast.error('Браузер не дал доступ к буферу обмена')
  }
}

export function absoluteUrl(path: string): string {
  return new URL(path, location.origin).href
}
