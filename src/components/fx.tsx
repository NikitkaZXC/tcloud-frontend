import type { ReactNode } from 'react'
import { useProgress } from '@/hooks/use-fx'
import { easeOut, scramble } from '@/lib/fx'
import { cn } from '@/lib/utils'

export function PageTitle({ text, children, className }: { text: string; children?: ReactNode; className?: string }) {
  const progress = useProgress(700, text)
  return (
    <h1 className={cn('flex items-center gap-2 text-2xl font-bold', className)}>
      <span className="sr-only">{text}</span>
      <span className="fx-glitch fx-cursor fx-neon" aria-hidden>
        {scramble(text, progress)}
      </span>
      {children}
    </h1>
  )
}

export function CountUp({ value, format = String }: { value: number; format?: (value: number) => string }) {
  const progress = useProgress(1200, value)
  return <span className="tabular-nums">{format(Math.round(value * easeOut(progress)))}</span>
}

export function StatusLight({ ok }: { ok: boolean }) {
  return <span className="fx-light" data-ok={ok} aria-hidden />
}

export function TermStatus({ status }: { status: 'ok' | 'fail' | 'wait' }) {
  const look = { ok: ['OK', 'text-neon-green'], fail: ['FAIL', 'text-neon-red'], wait: ['...', 'text-neon-yellow'] }[status]
  return <span className={cn('font-mono text-xs whitespace-pre', look[1])}>[ {look[0].padEnd(4)} ]</span>
}
