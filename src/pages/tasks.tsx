import { useQueryClient } from '@tanstack/react-query'
import { DownloadIcon, RotateCcwIcon, XIcon } from 'lucide-react'
import { Link } from 'react-router'
import { PageTitle } from '@/components/fx'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAction } from '@/hooks/use-action'
import { isFinished, useTasks } from '@/hooks/use-tasks'
import { api } from '@/lib/api'
import { formatBytes, formatDate, formatDuration, parentPath } from '@/lib/format'
import { markRead } from '@/lib/reads'
import { useStorages } from '@/hooks/use-storages'
import { taskTitle } from '@/lib/names'
import { forgetTask, taskFraction, forgetTasks, TASK_STAGE, TASK_STATUS, trackTask, useTrackedTasks } from '@/lib/tasks'
import type { Priority, Task } from '@/lib/types'

export function TasksPage() {
  const ids = useTrackedTasks()
  const results = useTasks(ids)
  const tasks = results.map((r) => r.data).filter((t): t is Task => !!t)
  const finished = tasks.filter(isFinished).map((t) => t.id)

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <PageTitle text="Задачи" />
        {finished.length > 0 && (
          <Button variant="outline" onClick={() => forgetTasks(finished)}>
            Убрать завершённые
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Здесь показаны задачи, запущенные из этого браузера.
      </p>
      {ids.length === 0 && <p className="text-muted-foreground">Задач нет.</p>}
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
      trackTask(next.id)
      update(next)
    },
  })

  const status = TASK_STATUS[task.status] ?? { label: task.status, variant: 'outline' as const }
  const finished = isFinished(task)
  const { name, where } = taskTitle(task, useStorages().data ?? [])
  const fraction = taskFraction(task)
  const percent = fraction != null ? fraction * 100 : null

  return (
    <Card className="py-4">
      <CardContent className="grid gap-2 px-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status.variant}>{status.label}</Badge>
          {!finished && <span className="text-xs text-muted-foreground">{TASK_STAGE[task.stage] ?? task.stage}</span>}
          <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
          <div className="flex items-center gap-1">
            {task.status === 'queued' && (
              <Select value={task.priority} onValueChange={(v) => priority.mutate(v as Priority)}>
                <SelectTrigger size="sm" className="w-32" aria-label="Приоритет">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">низкий</SelectItem>
                  <SelectItem value="normal">обычный</SelectItem>
                  <SelectItem value="high">высокий</SelectItem>
                </SelectContent>
              </Select>
            )}
            {task.status === 'done' && task.archive && (
              <Button size="sm" asChild>
                <a href={`/api/tasks/${task.id}/archive`} download={task.archive.name} onClick={() => markRead(task.path)}>
                  <DownloadIcon /> Скачать
                </a>
              </Button>
            )}
            {(task.status === 'failed' || task.status === 'cancelled') && task.archive == null && (
              <Button size="sm" variant="outline" onClick={() => retry.mutate()} disabled={retry.isPending}>
                <RotateCcwIcon /> Повторить
              </Button>
            )}
            {!finished && (
              <Button size="sm" variant="outline" onClick={() => cancel.mutate()} disabled={task.cancel_requested}>
                <XIcon /> Отменить
              </Button>
            )}
            {finished && (
              <Button size="icon-sm" variant="ghost" onClick={() => forgetTask(task.id)} aria-label="Убрать из списка">
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
          {task.speed != null && !finished && <span>{formatBytes(task.speed)}/с</span>}
          {task.eta != null && !finished && <span>осталось {formatDuration(task.eta)}</span>}
          {task.queue_position != null && <span>место в очереди: {task.queue_position}</span>}
          {task.waiting && (
            <span>
              ждёт: {task.waiting.reason}
              {task.waiting.seconds != null && ` (${task.waiting.seconds} с)`}
            </span>
          )}
          {task.archive && (
            <span>
              {task.archive.files} файлов{task.archive.size != null && ` · ${formatBytes(task.archive.size)}`}
              {task.archive.expires_at && ` · хранится до ${formatDate(task.archive.expires_at)}`}
            </span>
          )}
          <span>{formatDate(task.created_at)}</span>
        </div>
        {task.error && (
          <p className="text-sm text-destructive">
            {task.error.message} ({task.error.code})
          </p>
        )}
        {task.warnings.map((warning) => (
          <p key={warning} className="text-sm text-warning">
            {warning}
          </p>
        ))}
      </CardContent>
    </Card>
  )
}
