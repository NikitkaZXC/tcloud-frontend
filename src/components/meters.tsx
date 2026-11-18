import { useState } from 'react'
import { useFileActivity } from '@/hooks/use-activity'
import { activityGrid, type Transfer } from '@/lib/dashboard'
import { filesCount, formatBytes, formatDuration } from '@/lib/format'
import { t } from '@/lib/i18n'

const SCALES = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]
const MB = 1024 * 1024

function Flap({ text, label }: { text: string; label: string }) {
  return (
    <span className="fx-flaps" aria-label={label} role="text">
      {[...text].map((char, i) => (
        <span key={`${i}-${char}`} className="fx-flap" aria-hidden>
          {char}
        </span>
      ))}
    </span>
  )
}

export function Speedometer({ transfer }: { transfer: Transfer }) {
  const mbps = transfer.speed / MB
  const max = SCALES.find((scale) => scale >= mbps) ?? SCALES.at(-1)!
  const angle = Math.min(mbps / max, 1) * 180
  const ticks = Array.from({ length: 11 }, (_, i) => (i / 10) * Math.PI)
  const value = mbps >= 100 ? mbps.toFixed(0) : mbps.toFixed(1)

  return (
    <figure className="fx-speedo">
      <svg viewBox="0 0 120 68" aria-hidden>
        {ticks.map((t, i) => (
          <rect
            key={i}
            x={Math.round(60 - Math.cos(t) * 50) - (i % 5 ? 1 : 2)}
            y={Math.round(62 - Math.sin(t) * 50) - (i % 5 ? 1 : 2)}
            width={i % 5 ? 2 : 4}
            height={i % 5 ? 2 : 4}
            className={i / 10 <= mbps / max && mbps > 0 ? 'fx-speedo-on' : 'fx-speedo-off'}
          />
        ))}
        <g className="fx-speedo-needle" style={{ rotate: `${angle}deg` }}>
          <rect x="18" y="61" width="42" height="2" />
        </g>
        <rect x="56" y="58" width="8" height="8" className="fx-speedo-hub" />
      </svg>
      <figcaption className="grid justify-items-center gap-1">
        <span className="flex items-baseline gap-1.5">
          <Flap text={value} label={t('meter.mbps', { value })} />
          <span className="fx-label">MB/s</span>
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {t('meter.scale', { max })}{transfer.eta != null && ` · ${t('tasks.eta', { time: formatDuration(Math.ceil(transfer.eta)) })}`}
        </span>
      </figcaption>
    </figure>
  )
}

export function ActivityMap() {
  const activity = useFileActivity()
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const data = activity.data
  const weeks = activityGrid(data?.items ?? [], data?.until ?? today, data?.days ?? 365)
  const summary = data ? t('map.summary', { days: data.days, files: filesCount(data.files), size: formatBytes(data.size) }) : t('common.noData')

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {data && <span className="fx-pixel text-[33px]">{data.files}</span>}
        <span className="text-sm text-muted-foreground">{activity.isPending ? t('common.loading') : summary}</span>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="fx-heat" role="img" aria-label={`${t('dashboard.map')}: ${summary}`}>
          {weeks.map((week) => (
            <div key={week[0].date} className="grid gap-[2px]">
              {week.map((cell) => (
                <span key={cell.date} className="fx-heat-cell" data-level={cell.level} title={`${cell.date}: ${filesCount(cell.files)}, ${formatBytes(cell.size)}`} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-hidden>
        {t('map.less')}
        {[0, 1, 2, 3, 4].map((level) => (
          <span key={level} className="fx-heat-cell" data-level={level} />
        ))}
        {t('map.more')}
      </div>
    </div>
  )
}
