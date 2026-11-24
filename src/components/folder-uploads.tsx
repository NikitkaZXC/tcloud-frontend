import { useQueryClient } from '@tanstack/react-query'
import { UploadIcon, XIcon } from 'lucide-react'
import { type ReactNode, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Confirm } from '@/components/confirm'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useTasks } from '@/hooks/use-tasks'
import { formatBytes, formatDuration } from '@/lib/format'
import { ApiError, api, errorText, showError } from '@/lib/api'
import { IoTag } from '@/components/fx'
import { useStorageIo, useStorages } from '@/hooks/use-storages'
import { storageIdOf } from '@/lib/format'
import { fileName, taskTitle } from '@/lib/names'
import { useReads } from '@/lib/reads'
import { forgetTask, stageLabel, statusLabel, taskFraction, useTrackedTasks } from '@/lib/tasks'
import type { Task } from '@/lib/types'
import { cancelSending, discardSession, resumeUpload, sameFile, sendTracked, startSending, type StoredSession, usePausedSessions, useSending } from '@/lib/upload'
import { canCancel, isMeasured, phaseLabel, stepFraction, stepLabel, taskPhases, taskTrail, trail } from '@/lib/steps'
import { t } from '@/lib/i18n'

type Trail = ReturnType<typeof trail>

function StepTrail({ steps }: { steps: Trail }) {
  return (
    <ol className="fx-trail" aria-label={t('uploads.trail')}>
      {steps.map(({ phase, mark }) => (
        <li key={phase} data-mark={mark} aria-current={mark === 'active' ? 'step' : undefined}>
          {phaseLabel(phase)}
        </li>
      ))}
    </ol>
  )
}

function Row({
  name,
  label,
  fraction,
  meta,
  steps,
  error,
  muted,
  onCancel,
  cancelDisabled,
  onForget,
  actions,
}: {
  name: string
  label: string
  fraction?: number | null
  meta?: string
  steps: Trail
  error?: string
  muted?: boolean
  onCancel?: () => void
  cancelDisabled?: boolean
  onForget?: () => void
  actions?: ReactNode
}) {
  return (
    <li className="grid gap-1" data-muted={muted || undefined}>
      <div className="flex items-center gap-x-2 text-sm max-sm:flex-wrap">
        <span className="min-w-0 flex-1 truncate" title={name}>{name}</span>
        <span className={cn('min-w-0 truncate max-sm:order-last max-sm:basis-full sm:shrink-0', error ? 'text-destructive' : 'text-muted-foreground')}>
          {label}
          {fraction != null && ` · ${(fraction * 100).toFixed(0)}%`}
        </span>
        {actions}
        {onCancel && (
          <Button size="icon-sm" variant="ghost" onClick={onCancel} disabled={cancelDisabled} aria-label={`${t('uploads.cancel')}: ${name}`} title={t('uploads.cancel')}>
            <XIcon />
          </Button>
        )}
        {onForget && (
          <Button size="icon-sm" variant="ghost" onClick={onForget} aria-label={t('tasks.forget')}>
            <XIcon />
          </Button>
        )}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : fraction !== undefined && <Progress value={fraction == null ? null : fraction * 100} />}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <StepTrail steps={steps} />
        {meta && <span className="text-xs text-muted-foreground tabular-nums">{meta}</span>}
      </div>
    </li>
  )
}

function PickFile({ onPick }: { onPick: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={input}
        type="file"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) onPick(file)
        }}
      />
      <Button size="sm" variant="outline" onClick={() => input.current?.click()}>
        <UploadIcon /> {t('uploads.pickFile')}
      </Button>
    </>
  )
}

function speedText(speed: number | null, eta: number | null): string | undefined {
  if (speed == null) return undefined
  return [t('tasks.speed', { speed: formatBytes(speed) }), eta != null && t('tasks.eta', { time: formatDuration(Math.ceil(eta)) })].filter(Boolean).join(' · ')
}

function taskLabel(task: Task): string {
  if (task.status === 'cancelled') return t('uploads.cancelled')
  if (task.cancel_requested) return t('uploads.cancelling')
  if (task.step) return task.status === 'queued' && task.queue_position != null ? `${stepLabel(task.step)} · ${task.queue_position}` : stepLabel(task.step)
  if (task.status === 'queued') return task.queue_position != null ? t('uploads.queuedAt', { n: task.queue_position }) : statusLabel('queued')
  if (task.status === 'running') return stageLabel(task.stage)
  return statusLabel(task.status)
}

const ACTIVE = ['queued', 'running', 'failed', 'cancelled']

export function FolderUploads({ path }: { path: string }) {
  const queryClient = useQueryClient()
  const [inFlight, setInFlight] = useState<string[]>([])
  const inside = (item: string) => item.startsWith(`${path}/`)
  const name = (item: string) => item.slice(path.length + 1)
  const sending = useSending().filter((item) => inside(item.path))
  const paused = usePausedSessions().filter((entry) => inside(entry.path))
  const ids = useTrackedTasks()
  const tasks = useTasks(ids)
    .map((result) => result.data)
    .filter((task): task is Task => !!task && !task.archive && inside(task.path) && ACTIVE.includes(task.status))

  if (sending.length + tasks.length + paused.length === 0) return null

  async function cancelTask(id: string) {
    setInFlight((list) => [...list, id])
    try {
      queryClient.setQueryData(['task', id], await api.post<Task>(`/tasks/${id}/cancel`))
      queryClient.invalidateQueries({ queryKey: ['task', id] })
    } catch (e) {
      if (!(e instanceof ApiError && e.code === 'task_finished')) showError(e)
    } finally {
      setInFlight((list) => list.filter((x) => x !== id))
    }
  }

  function resume(entry: StoredSession, file: File) {
    if (!sameFile(entry, file)) {
      toast.error(t('uploads.wrongFile', { name: entry.name, size: formatBytes(entry.size) }))
      return
    }
    const id = startSending(entry.path, entry.size, entry.encrypt)
    sendTracked(queryClient, id, entry.name, entry.encrypt, (onProgress, signal) => resumeUpload(entry, file, onProgress, signal))
  }

  const openSending = sending.filter((item) => !item.cancelled)
  const openTasks = tasks.filter((task) => canCancel(task, inFlight.includes(task.id)))
  const open = openSending.length + openTasks.length

  function cancelAll() {
    openSending.forEach((item) => cancelSending(item.id))
    openTasks.forEach((task) => cancelTask(task.id))
  }

  return (
    <div className="fx-panel grid gap-3 p-4" data-uploads>
    {open > 1 && (
      <div className="flex justify-end">
        <Confirm
          title={t('uploads.cancelAllQ', { n: open })}
          description={t('uploads.cancelAllHint')}
          action={t('uploads.cancelAll')}
          onConfirm={cancelAll}
        >
          <Button size="sm" variant="outline">
            <XIcon /> {t('uploads.cancelAll')}
          </Button>
        </Confirm>
      </div>
    )}
    <div className="flex flex-wrap items-center gap-6">
    <ul className="grid min-w-0 flex-1 basis-72 gap-4">
      {sending.map((item) => (
        <Row
          key={item.id}
          name={name(item.path)}
          label={item.cancelled ? t('uploads.cancelled') : item.conflict ? t('uploads.conflict') : item.loaded ? t('step.uploading') : t('uploads.waiting')}
          fraction={item.cancelled || item.conflict ? undefined : item.loaded ? item.loaded / Math.max(item.total, 1) : null}
          meta={item.cancelled || !item.loaded ? undefined : [`${formatBytes(item.loaded)} / ${formatBytes(item.total)}`, speedText(item.rate, item.rate ? (item.total - item.loaded) / item.rate : null)].filter(Boolean).join(' · ')}
          steps={trail(taskPhases({ step: null, archive: null, source: 'device' }, { encrypt: !!item.encrypt }), 'upload', item.cancelled ? 'cancelled' : 'running')}
          muted={item.cancelled}
          onCancel={item.cancelled ? undefined : () => cancelSending(item.id)}
        />
      ))}
      {paused.map((entry) => (
        <Row
          key={entry.session_id}
          name={name(entry.path)}
          label={t('uploads.paused')}
          meta={formatBytes(entry.size)}
          steps={trail(taskPhases({ step: null, archive: null, source: 'device' }, { encrypt: entry.encrypt }), 'upload', 'cancelled')}
          muted
          actions={<PickFile onPick={(file) => resume(entry, file)} />}
          onCancel={() => discardSession(entry.session_id)}
        />
      ))}
      {tasks.map((task) => {
        const finished = task.status === 'failed' || task.status === 'cancelled'
        return (
          <Row
            key={task.id}
            name={name(task.path)}
            label={taskLabel(task)}
            fraction={finished ? undefined : stepFraction(task)}
            meta={isMeasured(task) ? speedText(task.speed, task.eta) : undefined}
            steps={taskTrail(task)}
            error={task.status === 'failed' ? (task.error ? errorText(task.error) : statusLabel('failed')) : undefined}
            muted={task.status === 'cancelled'}
            onCancel={finished ? undefined : () => cancelTask(task.id)}
            cancelDisabled={!canCancel(task, inFlight.includes(task.id))}
            onForget={finished ? () => forgetTask(task.id) : undefined}
          />
        )
      })}
    </ul>
    </div>
    </div>
  )
}

export function IoBanner({ path }: { path: string }) {
  const storages = useStorages().data ?? []
  const storage = storages.find((s) => s.id === storageIdOf(path))
  const io = useStorageIo()[storage?.id ?? '']
  const within = (item: string) => !!storage && (item === storage.path || item.startsWith(`${storage.path}/`))
  const sending = useSending().filter((item) => !item.cancelled && within(item.path))
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
