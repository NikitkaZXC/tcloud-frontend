import { XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useTasks } from '@/hooks/use-tasks'
import { formatBytes } from '@/lib/format'
import { errorText } from '@/lib/api'
import { IoTag } from '@/components/fx'
import { Speedometer } from '@/components/meters'
import { transferStats } from '@/lib/dashboard'
import { useStorageIo, useStorages } from '@/hooks/use-storages'
import { storageIdOf } from '@/lib/format'
import { fileName, taskTitle } from '@/lib/names'
import { useReads } from '@/lib/reads'
import { forgetTask, stageLabel, statusLabel, taskFraction, useTrackedTasks } from '@/lib/tasks'
import type { Task } from '@/lib/types'
import { useSending } from '@/lib/upload'
import { t } from '@/lib/i18n'

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
          <Button size="icon-sm" variant="ghost" onClick={onForget} aria-label={t('tasks.forget')}>
            <XIcon />
          </Button>
        )}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : <Progress value={percent} />}
    </li>
  )
}

function taskStatus(task: Task): string {
  if (task.status === 'queued') return task.queue_position != null ? t('uploads.queuedAt', { n: task.queue_position }) : statusLabel('queued')
  if (task.status === 'running') return stageLabel(task.stage)
  return statusLabel(task.status)
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
    <div className="fx-panel flex flex-wrap items-center gap-6 p-4">
    <ul className="grid min-w-0 flex-1 basis-72 gap-3">
      {sending.map((item) => (
        <Row
          key={item.id}
          name={name(item.path)}
          status={item.loaded ? t('uploads.sending', { done: formatBytes(item.loaded), total: formatBytes(item.total) }) : t('uploads.waiting')}
          percent={item.loaded ? (item.loaded / Math.max(item.total, 1)) * 100 : null}
        />
      ))}
      {tasks.map((task) => (
        <Row
          key={task.id}
          name={name(task.path)}
          status={taskStatus(task)}
          percent={task.status !== 'failed' && task.progress != null ? taskFraction(task)! * 100 : null}
          error={task.status === 'failed' ? (task.error ? errorText(task.error) : statusLabel('failed')) : undefined}
          onForget={task.status === 'failed' ? () => forgetTask(task.id) : undefined}
        />
      ))}
    </ul>
    {(sending.length > 0 || tasks.some((task) => task.status === 'running')) && <Speedometer transfer={transferStats(sending, tasks)} />}
    </div>
  )
}

export function IoBanner({ path }: { path: string }) {
  const storages = useStorages().data ?? []
  const storage = storages.find((s) => s.id === storageIdOf(path))
  const io = useStorageIo(storage ? [storage] : [])[storage?.id ?? '']
  const within = (item: string) => !!storage && (item === storage.path || item.startsWith(`${storage.path}/`))
  const sending = useSending().filter((item) => within(item.path))
  const tasks = useTasks(useTrackedTasks())
    .map((result) => result.data)
    .filter((task): task is Task => !!task && within(task.path) && (task.status === 'queued' || task.status === 'running'))
  const reads = useReads().filter((read) => within(read.path))
  if (!io) return null
  const uploads = tasks.filter((task) => !task.archive)
  const archive = tasks.find((task) => task.archive)
  const writing = sending[0]
    ? { name: fileName(sending[0].path), percent: sending[0].total ? Math.round((sending[0].loaded / sending[0].total) * 100) : null }
    : uploads[0]
      ? { name: taskTitle(uploads[0]).name, percent: taskFraction(uploads[0]) != null ? Math.round(taskFraction(uploads[0])! * 100) : null }
      : null
  const more = sending.length + uploads.length - 1
  const reading = reads.at(-1) ? fileName(reads.at(-1)!.path) : archive ? taskTitle(archive).name : null

  return (
    <div className="grid gap-2" role="status">
      {(io === 'write' || io === 'both') && (
        <p className="fx-io-line" data-io="write">
          <IoTag io="write" />
          {writing ? (
            <span className="min-w-0 truncate">
              {t('uploads.writing')}: <span className="text-foreground">{writing.name}</span>
              {writing.percent != null && ` · ${writing.percent}%`}
              {more > 0 && ` · ${t('uploads.more', { n: more })}`}
            </span>
          ) : (
            <span>{t('uploads.writeDone')}</span>
          )}
        </p>
      )}
      {(io === 'read' || io === 'both') && (
        <p className="fx-io-line" data-io="read">
          <IoTag io="read" />
          <span className="min-w-0 truncate">
            {t('io.reading')}{reading && <>: <span className="text-foreground">{reading}</span></>}
          </span>
        </p>
      )}
    </div>
  )
}
