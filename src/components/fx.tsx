import { type ReactNode, useEffect } from 'react'
import { useProgress } from '@/hooks/use-fx'
import type { Activity } from '@/lib/dashboard'
import { easeOut, prefersReducedMotion } from '@/lib/fx'
import { cn } from '@/lib/utils'

export function PageTitle({ text, children, className }: { text: string; children?: ReactNode; className?: string }) {
  return (
    <h1 className={cn('fx-page flex items-center gap-2 text-3xl font-extrabold tracking-tight', className)}>
      {text}
      {children}
    </h1>
  )
}

export function CountUp({ value, format = String }: { value: number; format?: (value: number) => string }) {
  const progress = useProgress(1200, value)
  return <span className="tabular-nums">{format(Math.round(value * easeOut(progress)))}</span>
}

export function StatusLight({ ok }: { ok: boolean | 'wait' }) {
  return <span className="fx-light" data-ok={ok} aria-hidden />
}

const STATUS = {
  ok: ['готово', true, 'text-success'],
  fail: ['ошибка', false, 'text-destructive'],
  wait: ['ожидание', 'wait', 'text-warning'],
} as const

export function StatusChip({ status, label }: { status: keyof typeof STATUS; label?: string }) {
  const [text, light, tone] = STATUS[status]
  return (
    <span className={cn('fx-chip', tone)}>
      <StatusLight ok={light} />
      {label ?? text}
    </span>
  )
}

function activityLabel({ count, percent }: Activity): string {
  return `загружается ${count}${percent != null ? ` · ${percent}%` : ''}`
}

export function UploadPulse({ activity, compact }: { activity: Activity; compact?: boolean }) {
  if (compact) return <span className="fx-flow h-0.5" role="status" aria-label={activityLabel(activity)} title={activityLabel(activity)} />
  return (
    <span className="flex items-center gap-2" role="status">
      <span className="fx-flow flex-1" aria-hidden />
      <span className="shrink-0 text-xs font-semibold text-primary tabular-nums">{activityLabel(activity)}</span>
    </span>
  )
}

export function Backdrop() {
  useEffect(() => {
    if (prefersReducedMotion()) return
    const move = (event: PointerEvent) => {
      const card = (event.target as Element | null)?.closest?.<HTMLElement>('[data-slot=card]')
      if (!card) return
      const box = card.getBoundingClientRect()
      card.style.setProperty('--mx', `${event.clientX - box.left}px`)
      card.style.setProperty('--my', `${event.clientY - box.top}px`)
    }
    document.addEventListener('pointermove', move, { passive: true })
    return () => document.removeEventListener('pointermove', move)
  }, [])
  return <div className="fx-bg" aria-hidden />
}
