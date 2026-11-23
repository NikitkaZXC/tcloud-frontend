import { useQueryClient } from '@tanstack/react-query'
import { DownloadIcon, RotateCcwIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Link } from 'react-router'
import { PageTitle } from '@/components/fx'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAction } from '@/hooks/use-action'
import { isFinished, useTasks } from '@/hooks/use-tasks'
import { api, errorText } from '@/lib/api'
import { t, type Key } from '@/lib/i18n'
import { filesCount, formatBytes, formatDate, formatDuration, formatShortDate, parentPath } from '@/lib/format'
import { markRead } from '@/lib/reads'
import { useStorages } from '@/hooks/use-storages'
import { taskTitle } from '@/lib/names'
import { forgetTask, forgetTasks, stageLabel, statusLabel, TASK_STATUS, taskFraction, trackTask, useTrackedTasks, waitingText, warningText } from '@/lib/tasks'
import { isMeasured, stepLabel } from '@/lib/steps'
import { settingsError, type TasksFilter, updateSettings, useSettings, visibleTasks } from '@/lib/settings'
import type { Priority, Task } from '@/lib/types'

const FILTERS: [TasksFilter, Key][] = [
  ['all', 'tasks.filterAll'],
  ['active_and_failed', 'tasks.filterActive'],
]

export function TasksPage() {
  const ids = useTrackedTasks()
  const results = useTasks(ids)
  const all = results.map((r) => r.data).filter((t): t is Task => !!t)
  const filter = useSettings().interface.tasks_filter
  const setFilter = (tasks_filter: TasksFilter) => updateSettings({ interface: { tasks_filter } }).catch((error) => toast.error(settingsError(error)))
  const tasks = visibleTasks(all, filter)
  const finished = all.filter(isFinished).map((t) => t.id)

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <PageTitle text={t('nav.tasks')} />
        {finished.length > 0 && (
          <Button variant="outline" onClick={() => forgetTasks(finished)}>
            {t('tasks.clearFinished')}
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t('tasks.hint')}</p>
        <div role="group" aria-label={t('tasks.filter')} className="flex">
          {FILTERS.map(([value, label]) => (
            <Button key={value} size="sm" variant={filter === value ? 'default' : 'outline'} aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {t(label)}
            </Button>
          ))}
        </div>
      </div>
      {ids.length === 0 && <p className="text-muted-foreground">{t('tasks.none')}</p>}
      {ids.length > 0 && all.length > 0 && tasks.length === 0 && <p className="text-muted-foreground">{t('tasks.noneActive')}</p>}
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  )
}

function TaskCard({ task }: { task: Task }) {
  const queryClient = useQueryClient()
  const update = (next: Task) => queryClient.setQueryData(['task', next.id], next)
  const cancel = useAction(() => api.post<Task>(`/tasks/${task.id}/cancel`), { onSuccess: update })
  const priority = useAction((value: Priority) => api.post<Task>(`/tasks/${task.id}/priority`, { priority: value }), {
    onSuccess: update,
  })
  const retry = useAction(() => api.post<Task>(`/tasks/${task.id}/retry`), {
    onSuccess: (next) => {
      update(next)
      trackTask(next.id)
    },
  })

  const status = { label: statusLabel(task.status), variant: TASK_STATUS[task.status]?.variant ?? ('outline' as const) }
  const finished = isFinished(task)
  const { name, where } = taskTitle(task, useStorages().data ?? [])
  const fraction = taskFraction(task)
  const percent = fraction != null ? fraction * 100 : null

  return (
    <Card className="py-4">
      <CardContent className="grid gap-2 px-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status.variant}>{status.label}</Badge>
          {task.step && task.status !== 'done' ? (
            <span className="text-xs text-muted-foreground">{task.cancel_requested && !finished ? t('uploads.cancelling') : stepLabel(task.step)}</span>
          ) : (
            !finished && <span className="text-xs text-muted-foreground">{stageLabel(task.stage)}</span>
          )}
          <span className="min-w-0 flex-1 truncate text-foreground max-sm:order-first max-sm:basis-full">{name}</span>
          <div className="ml-auto flex items-center gap-1">
            {task.status === 'queued' && (
              <Select value={task.priority} onValueChange={(v) => priority.mutate(v as Priority)}>
                <SelectTrigger size="sm" className="w-32" aria-label={t('upload.priority')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t('priority.low')}</SelectItem>
                  <SelectItem value="normal">{t('priority.normal')}</SelectItem>
                  <SelectItem value="high">{t('priority.high')}</SelectItem>
                </SelectContent>
              </Select>
            )}
            {task.status === 'done' && task.archive && (
              <Button size="sm" asChild>
                <a href={`/api/tasks/${task.id}/archive`} download={task.archive.name} onClick={() => markRead(task.path)}>
                  <DownloadIcon /> {t('common.download')}
                </a>
              </Button>
            )}
            {(task.status === 'failed' || task.status === 'cancelled') && task.archive == null && (
              <Button size="sm" variant="outline" onClick={() => retry.mutate()} disabled={retry.isPending}>
                <RotateCcwIcon /> {t('tasks.retry')}
              </Button>
            )}
            {!finished && (
              <Button size="sm" variant="outline" onClick={() => cancel.mutate()} disabled={cancel.isPending || task.cancel_requested}>
                <XIcon /> {t('tasks.cancel')}
              </Button>
            )}
            {finished && (
              <Button size="icon-sm" variant="ghost" onClick={() => forgetTask(task.id)} aria-label={t('tasks.forget')}>
                <XIcon />
              </Button>
            )}
          </div>
        </div>
        {!finished && <Progress value={percent} />}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <Link to={`/files?path=${encodeURIComponent(parentPath(task.path) || task.path)}`} className="truncate hover:underline pointer-coarse:py-3">
            {where}
          </Link>
          <span>
            {formatBytes(task.bytes_done)} / {formatBytes(task.bytes_total)}
            {percent != null && ` · ${percent.toFixed(0)}%`}
          </span>
          {task.speed != null && isMeasured(task) && <span>{t('tasks.speed', { speed: formatBytes(task.speed) })}</span>}
          {task.eta != null && isMeasured(task) && <span>{t('tasks.eta', { time: formatDuration(task.eta) })}</span>}
          {task.queue_position != null && <span>{t('tasks.queuePosition', { n: task.queue_position })}</span>}
          {task.waiting && (
            <span>
              {t('tasks.waiting', { reason: waitingText(task.waiting) })}
              {task.waiting.seconds != null && ` (${t('tasks.seconds', { n: task.waiting.seconds })})`}
            </span>
          )}
          {task.archive && (
            <span>
              {filesCount(task.archive.files)}{task.archive.size != null && ` · ${formatBytes(task.archive.size)}`}
              {task.archive.expires_at && ` · ${t('tasks.keptUntil', { date: formatShortDate(task.archive.expires_at) })}`}
            </span>
          )}
          <span title={formatDate(task.created_at)}>{formatShortDate(task.created_at)}</span>
        </div>
        {task.error && (
          <p className="text-sm text-destructive">
            {errorText(task.error)} ({task.error.code})
          </p>
        )}
        {task.warning_details.map((warning, index) => (
          <p key={index} className="text-sm text-warning">
            {warningText(warning)}
          </p>
        ))}
      </CardContent>
    </Card>
  )
}
