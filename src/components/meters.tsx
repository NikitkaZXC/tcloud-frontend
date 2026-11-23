import { useState } from 'react'
import { useFileActivity } from '@/hooks/use-activity'
import { activityGrid } from '@/lib/dashboard'
import { filesCount, formatBytes } from '@/lib/format'
import { t } from '@/lib/i18n'

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
