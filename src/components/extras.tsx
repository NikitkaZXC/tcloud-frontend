import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { StorageIcon } from '@/components/fx'
import { Button } from '@/components/ui/button'
import { konami } from '@/lib/eggs'
import { TASK_EVENT, useFeature } from '@/lib/features'
import { beep } from '@/lib/sounds'
import { t, type Key } from '@/lib/i18n'

const TIPS: Key[] = ['tip.palette', 'tip.search', 'tip.paste', 'tip.shift', 'tip.archive', 'tip.dropFolder']

export function Extras() {
  const sounds = useFeature('sounds')
  const eggs = useFeature('eggs')
  const keys = useRef<string[]>([])

  useEffect(() => {
    if (!sounds) return
    const click = (event: PointerEvent) => (event.target as Element | null)?.closest?.('button, a') && beep('click')
    const finished = (event: Event) => beep((event as CustomEvent<string>).detail === 'done' ? 'done' : 'error')
    window.addEventListener('pointerdown', click, { passive: true })
    window.addEventListener(TASK_EVENT, finished)
    return () => {
      window.removeEventListener('pointerdown', click)
      window.removeEventListener(TASK_EVENT, finished)
    }
  }, [sounds])

  useEffect(() => {
    if (!eggs) {
      document.documentElement.classList.remove('fx-secret')
      return
    }
    const onKey = (event: KeyboardEvent) => {
      keys.current = [...keys.current.slice(-12), event.key]
      if (!konami(keys.current)) return
      const on = document.documentElement.classList.toggle('fx-secret')
      toast(t(on ? 'eggs.secretOn' : 'eggs.secretOff'))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [eggs])

  return null
}

export function Tip() {
  const eggs = useFeature('eggs')
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)])
  if (!eggs) return null
  return <p className="fx-dotted mt-10 border-t pt-4 text-xs text-muted-foreground">{t('tip.prefix', { tip: t(tip) })}</p>
}

export function RouteError() {
  return (
    <div role="alert" className="fx-page grid justify-items-start gap-5 p-8">
      <StorageIcon scale={3} off />
      <p className="text-sm text-muted-foreground">{t('error.crashed')}</p>
      <Button variant="outline" onClick={() => location.reload()}>
        {t('error.reload')}
      </Button>
    </div>
  )
}

export function NotFound() {
  return (
    <div className="fx-page grid justify-items-start gap-5 py-10">
      <p className="fx-pixel text-[88px]">404</p>
      <StorageIcon scale={3} off />
      <p className="text-sm text-muted-foreground">{t('notFound.text')}</p>
      <Button asChild variant="outline">
        <Link to="/dashboard">{t('notFound.back')}</Link>
      </Button>
    </div>
  )
}
