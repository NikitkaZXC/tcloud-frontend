import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { StorageIcon } from '@/components/fx'
import { burst } from '@/components/pixel-fx'
import { Button } from '@/components/ui/button'
import { ACHIEVEMENTS, konami, reached, unlocked } from '@/lib/achievements'
import { TASK_EVENT, useFeature } from '@/lib/features'
import { prefersReducedMotion } from '@/lib/fx'
import { scatter } from '@/lib/particles'
import { load, save } from '@/lib/prefs'
import { beep } from '@/lib/sounds'
import { t, type Key } from '@/lib/i18n'
import { useSending } from '@/lib/upload'

const TIPS: Key[] = ['tip.palette', 'tip.search', 'tip.paste', 'tip.shift', 'tip.archive', 'tip.dropFolder']

export function Extras() {
  const sounds = useFeature('sounds')
  const cursor = useFeature('cursor')
  const eggs = useFeature('eggs')
  const keys = useRef<string[]>([])

  useEffect(() => {
    document.documentElement.classList.toggle('fx-cursor', cursor)
    if (!cursor) return
    const spark = (event: PointerEvent) => burst(scatter({ x: event.clientX, y: event.clientY }, 6, 14, event.clientX), 'var(--foreground)', 3)
    window.addEventListener('pointerdown', spark, { passive: true })
    return () => window.removeEventListener('pointerdown', spark)
  }, [cursor])

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

type Mood = 'sleep' | 'eat' | 'happy' | 'scared'

export function Pet() {
  const on = useFeature('pet')
  const eating = useSending().length > 0
  const [mood, setMood] = useState<Mood | null>(null)

  useEffect(() => {
    if (!on) return
    let timer: ReturnType<typeof setTimeout>
    const finished = (event: Event) => {
      setMood((event as CustomEvent<string>).detail === 'done' ? 'happy' : 'scared')
      clearTimeout(timer)
      timer = setTimeout(() => setMood(null), 4000)
    }
    window.addEventListener(TASK_EVENT, finished)
    return () => {
      clearTimeout(timer)
      window.removeEventListener(TASK_EVENT, finished)
    }
  }, [on])

  if (!on) return null
  const current: Mood = mood ?? (eating ? 'eat' : 'sleep')
  const label = t(`pet.${current}`)
  return (
    <div className="fx-pet" data-mood={current} role="img" aria-label={label} title={label}>
      <svg viewBox="0 0 16 14" width="48" height="42" aria-hidden>
        <rect x="1" y="3" width="14" height="10" className="fx-pet-body" />
        <rect x="2" y="4" width="12" height="8" className="fx-pet-face" />
        <g className="fx-pet-eyes-open">
          <rect x="4" y="6" width="2" height="2" />
          <rect x="10" y="6" width="2" height="2" />
        </g>
        <g className="fx-pet-eyes-shut">
          <rect x="4" y="7" width="2" height="1" />
          <rect x="10" y="7" width="2" height="1" />
        </g>
        <rect x="7" y="9" width="2" height="1" className="fx-pet-mouth" />
        <g className="fx-pet-z">
          <rect x="13" y="0" width="3" height="1" />
          <rect x="14" y="1" width="1" height="1" />
          <rect x="13" y="2" width="3" height="1" />
        </g>
      </svg>
    </div>
  )
}

export function Achievements({ files, size, checklist }: { files: number; size: number; checklist: boolean }) {
  const on = useFeature('confetti')
  useEffect(() => {
    if (!files && !checklist) return
    let fired: string[] = []
    try {
      fired = JSON.parse(load('achievements') ?? '[]')
    } catch {
      fired = []
    }
    const fresh = unlocked(reached({ files, size, checklist }), fired)
    if (!fresh.length) return
    save('achievements', JSON.stringify([...fired, ...fresh]))
    if (!on) return
    for (const key of fresh) toast.success(t('achievement.toast', { name: t(ACHIEVEMENTS[key]) }))
    if (prefersReducedMotion()) return
    const colors = ['var(--warning)', 'var(--read)', 'var(--success)', 'var(--foreground)']
    colors.forEach((color, i) => burst(scatter({ x: innerWidth / 2, y: innerHeight / 3 }, 16, 220, i + 3), color, 6))
  }, [files, size, checklist, on])
  return null
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
