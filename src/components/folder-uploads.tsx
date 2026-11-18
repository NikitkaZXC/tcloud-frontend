import { XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useTasks } from '@/hooks/use-tasks'
import { formatBytes } from '@/lib/format'
import { forgetTask, taskFraction, TASK_STAGE, TASK_STATUS, useTrackedTasks } from '@/lib/tasks'
import type { Task } from '@/lib/types'
import { useSending } from '@/lib/upload'

function Row({ name, status, percent, error, onForget }: { name: string; status: string; percent: number | null; error?: string; onForget?: () => void }) {
  return (
    <li className="grid gap-1">
      <div className="flex items-center gap-2 text-sm">
        <span className="min-w-0 flex-1 truncate">{name}</span>
        <span className={error ? 'shrink-0 text-destructive' : 'shrink-0 text-muted-foreground'}>
          {status}
          {percent != null && ` · ${percent.toFixed(0)}%`}
        </span>
        {onForget && (
          <Button size="icon-sm" variant="ghost" onClick={onForget} aria-label="Убрать из списка">
            <XIcon />
          </Button>
        )}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : <Progress value={percent} />}
    </li>
  )
}

function taskStatus(task: Task): string {
  if (task.status === 'queued') return task.queue_position != null ? `в очереди, место ${task.queue_position}` : TASK_STATUS.queued.label
  if (task.status === 'running') return TASK_STAGE[task.stage] ?? task.stage
  return TASK_STATUS[task.status]?.label ?? task.status
}

export function FolderUploads({ path }: { path: string }) {
  const inside = (item: string) => item.startsWith(`${path}/`)
  const name = (item: string) => item.slice(path.length + 1)
  const sending = useSending().filter((item) => inside(item.path))
  const ids = useTrackedTasks()
  const tasks = useTasks(ids)
    .map((result) => result.data)
    .filter((task): task is Task => !!task && !task.archive && inside(task.path) && (task.status === 'queued' || task.status === 'running' || task.status === 'failed'))

  if (sending.length + tasks.length === 0) return null

  return (
    <ul className="grid gap-3 rounded-xl border p-4">
      {sending.map((item) => (
        <Row
          key={item.id}
          name={name(item.path)}
          status={item.loaded ? `отправка на сервер, ${formatBytes(item.loaded)} / ${formatBytes(item.total)}` : 'ожидает отправки'}
          percent={item.loaded ? (item.loaded / Math.max(item.total, 1)) * 100 : null}
        />
      ))}
      {tasks.map((task) => (
        <Row
          key={task.id}
          name={name(task.path)}
          status={taskStatus(task)}
          percent={task.status !== 'failed' && task.progress != null ? taskFraction(task)! * 100 : null}
          error={task.status === 'failed' ? (task.error?.message ?? TASK_STATUS.failed.label) : undefined}
          onForget={task.status === 'failed' ? () => forgetTask(task.id) : undefined}
        />
      ))}
    </ul>
  )
}
