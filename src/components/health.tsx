import { healthRows, type HealthRow } from '@/lib/dashboard'
import { t } from '@/lib/i18n'
import type { Health } from '@/lib/types'
import { cn } from '@/lib/utils'

function Led({ ok, className }: { ok: boolean; className?: string }) {
  return <span className={cn('fx-light', className)} data-tone={ok ? 'ok' : 'fail'} data-alert={ok ? undefined : ''} aria-hidden />
}

function Metric({ row, className }: { row: HealthRow; className?: string }) {
  return <span className={cn('whitespace-nowrap', row.ok ? 'text-muted-foreground' : 'text-destructive', className)}>{row.ok ? row.metric : `✗ ${row.metric}`}</span>
}

export function HealthRack({ health }: { health: Health }) {
  const groups = healthRows(health)
  const rows = groups.flatMap((group) => group.rows)
  const ok = rows.filter((row) => row.ok).length

  return (
    <div className="@container grid gap-5">
      <p className="flex items-center gap-2 text-xs tracking-[0.1em] uppercase">
        <Led ok={health.ok} />
        <span className={health.ok ? 'text-success' : 'text-destructive'}>{t(health.ok ? 'dashboard.healthy' : 'dashboard.unhealthy')}</span>
        <span className="text-muted-foreground">· {t('dashboard.components', { ok, n: rows.length })}</span>
      </p>
      {groups.map(({ id, inline, rows: items }) => (
        <div key={id} className="grid gap-3">
          <h3 className="fx-group-label">
            <span>{t(`health.group.${id}`)}</span>
            <span className="h-px flex-1 border-b border-dotted border-(--dots)" aria-hidden />
            <Led ok={items.every((row) => row.ok)} />
          </h3>
          {inline ? (
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {items.map((row) => (
                <li key={row.key} className="flex items-center gap-2" title={row.hint}>
                  <Led ok={row.ok} />
                  <span>{row.name}</span>
                  <Metric row={row} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="grid gap-2 text-sm">
              {items.map((row) => (
                <li key={row.key} className="grid grid-cols-[8px_minmax(0,1fr)] items-baseline gap-x-3 @md:grid-cols-[8px_minmax(0,16rem)_minmax(0,1fr)_auto]">
                  <Led ok={row.ok} className="self-center" />
                  <span className="min-w-0 truncate">{row.name}</span>
                  <Metric row={row} className="col-start-2 @md:order-last @md:col-start-auto @md:text-right" />
                  {row.hint && <span className="col-start-2 truncate text-xs text-muted-foreground @md:col-start-auto">{row.hint}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}
