import { type ReactNode, useId } from 'react'
import { useProgress } from '@/hooks/use-fx'
import { openPalette } from '@/lib/commands'
import type { Activity, ChannelUsage, Io } from '@/lib/dashboard'
import { easeOut } from '@/lib/fx'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'

export function PageTitle({ text, eyebrow, children, className }: { text: string; eyebrow?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className="fx-page grid gap-2">
      <h1 className={cn('fx-pixel flex flex-wrap items-center gap-3 text-[25px] uppercase [overflow-wrap:anywhere] min-[400px]:text-[30px] sm:text-[40px] md:text-[50px]', className)}>
        {text}
        {children}
      </h1>
      {eyebrow && <p className="max-w-lg text-sm text-muted-foreground">{eyebrow}</p>}
    </div>
  )
}

export function CountUp({ value, format = String }: { value: number; format?: (value: number) => string }) {
  const progress = useProgress(1200, value)
  return <span className="tabular-nums">{format(Math.round(value * easeOut(progress)))}</span>
}

export type Tone = 'ok' | 'busy' | 'fail' | 'read' | 'idle'

export function StatusLight({ ok }: { ok: boolean | 'wait' }) {
  return <span className="fx-light" data-tone={ok === 'wait' ? 'busy' : ok ? 'ok' : 'fail'} aria-hidden />
}

const STATUS = {
  ok: ['status.done', true, 'text-success'],
  fail: ['status.failed', false, 'text-destructive'],
  wait: ['chip.wait', 'wait', 'text-warning'],
} as const

export function StatusChip({ status, label }: { status: keyof typeof STATUS; label?: string }) {
  const [text, light, tone] = STATUS[status]
  return (
    <span className={cn('fx-chip', tone)}>
      <StatusLight ok={light} />
      {label ?? t(text)}
    </span>
  )
}

const SEGMENTS = 24

export function Ring({
  value,
  center,
  label,
  caption,
  tone,
  size = 'md',
}: {
  value: number | null
  center?: ReactNode
  label: string
  caption?: ReactNode
  tone?: Tone
  size?: 'sm' | 'md' | 'lg'
}) {
  const progress = useProgress(1100, value)
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const raw = value == null ? 0.25 : Math.min(Math.max(value, 0), 1) * easeOut(progress)
  const ratio = raw > 0 ? Math.max(Math.round(raw * SEGMENTS), 1) / SEGMENTS : 0
  const r = 42
  const length = 2 * Math.PI * r
  const segment = length / SEGMENTS
  return (
    <figure className="fx-ring" data-size={size} data-tone={tone} data-busy={value == null || undefined}>
      <div className="relative">
        <svg viewBox="0 0 100 100" className="-rotate-90" role="img" aria-label={`${label}: ${value == null ? t('status.running') : `${Math.round(value * 100)}%`}`}>
          <defs>
            <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" style={{ stopColor: 'var(--ring-from)' }} />
              <stop offset="1" style={{ stopColor: 'var(--ring-to)' }} />
            </linearGradient>
            <pattern id={`${id}d`} width="2" height="2" patternUnits="userSpaceOnUse">
              <rect width="2" height="2" className="fx-dither-a" />
              <rect width="1" height="1" className="fx-dither-b" />
              <rect x="1" y="1" width="1" height="1" className="fx-dither-b" />
            </pattern>
            <mask id={`${id}m`}>
              <circle cx="50" cy="50" r={r} fill="none" stroke="white" strokeWidth="10" strokeDasharray={`${segment - 2.5} 2.5`} />
            </mask>
          </defs>
          <g mask={`url(#${id}m)`}>
            <circle cx="50" cy="50" r={r} className="fx-ring-track" stroke={`url(#${id}d)`} />
            <circle cx="50" cy="50" r={r} className="fx-ring-bar" stroke={`url(#${id}g)`} strokeDasharray={length} strokeDashoffset={length * (1 - ratio)} />
          </g>
        </svg>
        <span className="fx-ring-center">{center ?? (value == null ? '…' : `${Math.round(value * 100)}%`)}</span>
        {tone && <span className="fx-light absolute top-0 right-0" data-tone={tone} aria-hidden />}
      </div>
      <figcaption className="grid justify-items-center gap-0.5 text-center">
        <span className="fx-label">{label}</span>
        {caption && <span className="text-xs text-muted-foreground">{caption}</span>}
      </figcaption>
    </figure>
  )
}

export function ChannelsRing({ usage, size = 'lg' }: { usage: ChannelUsage; size?: 'md' | 'lg' }) {
  return (
    <Ring
      size={size}
      value={usage.used / usage.limit}
      center={
        <span className="grid leading-none">
          <span>{usage.used}</span>
          <span className="text-[0.45em] text-muted-foreground">/ {usage.limit}</span>
        </span>
      }
      label={t(usage.accountWide ? 'channels.used' : 'channels.storagesOfLimit')}
      caption={t(usage.accountWide ? 'channels.usedOf' : 'channels.noData', { used: usage.used, limit: usage.limit })}
      tone={usage.used / usage.limit > 0.9 ? 'fail' : usage.used / usage.limit > 0.75 ? 'busy' : 'ok'}
    />
  )
}

const DRIVE: [number, number, number, number][] = [
  [3, 1, 19, 1],
  [21, 1, 1, 13],
  [2, 2, 1, 1],
  [20, 2, 1, 1],
  [20, 14, 1, 1],
  [1, 3, 19, 1],
  [1, 15, 19, 1],
  [1, 3, 1, 13],
  [19, 3, 1, 13],
]
const DRIVE_FAINT: [number, number, number, number][] = [
  [3, 10, 15, 1],
  [15, 5, 1, 3],
  [17, 5, 1, 3],
]
const DOWN: [number, number, number, number][] = [
  [3, 5, 5, 1],
  [4, 6, 3, 1],
  [5, 7, 1, 1],
]
const UP: [number, number, number, number][] = [
  [11, 5, 1, 1],
  [10, 6, 3, 1],
  [9, 7, 5, 1],
]

function pixels(list: [number, number, number, number][], className?: string) {
  return list.map(([x, y, w, h]) => <rect key={`${x}-${y}-${w}-${h}`} x={x} y={y} width={w} height={h} className={className} />)
}

export function StorageIcon({ id, io, off, scale = 2, className }: { id?: string; io?: Io; off?: boolean; scale?: 1 | 2 | 3; className?: string }) {
  const read = io === 'read' || io === 'both'
  const write = io === 'write' || io === 'both'
  return (
    <svg
      viewBox="0 0 23 17"
      width={23 * scale}
      height={17 * scale}
      className={cn('fx-drive', className)}
      data-storage={id}
      data-read={read || undefined}
      data-write={write || undefined}
      data-off={off || undefined}
      role="img"
      aria-label={t(off ? 'io.off' : write && read ? 'io.both' : write ? 'io.writing' : read ? 'io.reading' : 'names.storage')}
    >
      {pixels(DRIVE)}
      {pixels(DRIVE_FAINT, 'fx-drive-faint')}
      <g className="fx-drive-led fx-drive-write">{pixels(DOWN)}</g>
      <g className="fx-drive-led fx-drive-read">{pixels(UP)}</g>
      <path d="M3 12.5 H18" className="fx-drive-bar" />
    </svg>
  )
}

export function IoTag({ io, short }: { io?: Io; short?: boolean }) {
  if (!io) return null
  return (
    <span className="flex shrink-0 gap-1" role="status">
      {(io === 'write' || io === 'both') && (
        <span className="fx-io" data-io="write">
          ↓{short ? '' : ` ${t('io.write')}`}
        </span>
      )}
      {(io === 'read' || io === 'both') && (
        <span className="fx-io" data-io="read">
          ↑{short ? '' : ` ${t('io.read')}`}
        </span>
      )}
    </span>
  )
}

export const WRITTEN: Activity = { count: 0, percent: 100 }

function activityLabel({ count, percent }: Activity): string {
  if (!count) return t('io.written')
  return `${t('io.uploading', { n: count })}${percent != null ? ` · ${percent}%` : ''}`
}

export function UploadPulse({ activity, compact }: { activity: Activity; compact?: boolean }) {
  if (compact) return <span className="fx-flow" role="status" aria-label={activityLabel(activity)} title={activityLabel(activity)} />
  return (
    <span className="flex min-w-0 items-center gap-2" role="status">
      <span className="fx-flow min-w-6 flex-1" aria-hidden />
      <span className="fx-label min-w-0 truncate text-foreground tabular-nums">{activityLabel(activity)}</span>
    </span>
  )
}

export function WireCubes({ className }: { className?: string }) {
  const cube = (x: number, y: number, s: number) =>
    `M${x} ${y + s * 0.3} L${x + s * 0.5} ${y} L${x + s} ${y + s * 0.3} L${x + s} ${y + s} L${x + s * 0.5} ${y + s * 1.3} L${x} ${y + s} Z M${x} ${y + s * 0.3} L${x + s * 0.5} ${y + s * 0.6} L${x + s} ${y + s * 0.3} M${x + s * 0.5} ${y + s * 0.6} V${y + s * 1.3}`
  const dots = [[20, 30], [150, 20], [210, 60], [30, 150], [230, 140], [120, 175], [185, 110], [75, 10]]
  return (
    <svg viewBox="0 0 250 200" className={cn('fx-cubes', className)} aria-hidden>
      <path d={cube(40, 40, 60)} />
      <path d={cube(110, 70, 70)} />
      <path d={cube(60, 110, 45)} />
      <path d={cube(170, 30, 38)} className="fx-cubes-solid" />
      {dots.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="5" height="5" className="fx-cubes-dot" />
      ))}
    </svg>
  )
}

export function CornerHint() {
  return (
    <button type="button" onClick={openPalette} className="fx-corner fx-label hidden md:block" aria-label={t('nav.paletteKey')}>
      Ctrl K
    </button>
  )
}

export function Section({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <section aria-label={label} className={cn('fx-dotted flex gap-4 border-t py-6 md:gap-8 md:py-8', className)}>
      <span className="fx-vlabel hidden shrink-0 sm:block" aria-hidden>
        {label}
      </span>
      <div className="grid min-w-0 flex-1 content-start gap-5">
        <h2 className="fx-label sm:sr-only">{label}</h2>
        {children}
      </div>
    </section>
  )
}

export function Stat({ label, value, format }: { label: string; value: number; format?: (value: number) => string }) {
  return (
    <div className="grid content-center justify-items-center gap-2 px-3 py-5 text-center">
      <span className="fx-pixel text-[30px] sm:text-[45px]">
        <CountUp value={value} format={format} />
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

export function PixelToggle({ checked, onChange, disabled, labelledBy, describedBy }: { checked: boolean; onChange: (next: boolean) => void; disabled?: boolean; labelledBy?: string; describedBy?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="fx-toggle relative inline-flex h-7 w-13 shrink-0 items-center border p-0.5 after:absolute after:-inset-2 after:content-[''] disabled:opacity-40 pointer-coarse:after:-inset-3"
      data-on={checked || undefined}
    >
      <span className={cn('flex size-6 items-center justify-center border transition-transform duration-300', checked ? 'translate-x-6 border-foreground bg-foreground' : 'border-muted-foreground bg-transparent')} aria-hidden>
        <span className={cn('size-2', checked ? 'bg-background' : 'bg-muted-foreground')} />
      </span>
    </button>
  )
}
