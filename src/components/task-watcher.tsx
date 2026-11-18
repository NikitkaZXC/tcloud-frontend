import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { isFinished, useTasks } from '@/hooks/use-tasks'
import { ApiError, errorText } from '@/lib/api'
import { markRead } from '@/lib/reads'
import { useStorages } from '@/hooks/use-storages'
import { TASK_EVENT } from '@/lib/features'
import { taskTitle } from '@/lib/names'
import { forgetTasks, useTrackedTasks } from '@/lib/tasks'
import { useSending } from '@/lib/upload'
import { t } from '@/lib/i18n'

export function TaskWatcher() {
  const ids = useTrackedTasks()
  const results = useTasks(ids)
  const queryClient = useQueryClient()
  const seen = useRef(new Map<string, string>())
  const uploading = useSending().length > 0
  const storages = useStorages()

  useEffect(() => {
    if (!uploading) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [uploading])

  useEffect(() => {
    const gone = ids.filter((_, i) => results[i].error instanceof ApiError && results[i].error.status === 404)
    if (gone.length) forgetTasks(gone)
    for (const { data: task } of results) {
      if (!task) continue
      const before = seen.current.get(task.id)
      seen.current.set(task.id, task.status)
      if (before === undefined || before === task.status || !isFinished(task)) continue
      queryClient.invalidateQueries({ queryKey: ['folder'] })
      queryClient.invalidateQueries({ queryKey: ['storages'] })
      queryClient.invalidateQueries({ queryKey: ['account'] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
      window.dispatchEvent(new CustomEvent(TASK_EVENT, { detail: task.status }))
      const name = taskTitle(task, storages.data ?? []).name
      if (task.status === 'done' && task.archive) {
        const { id, path } = task
        toast.success(t('watcher.archiveReady', { name }), {
          duration: 30000,
          action: {
            label: t('common.download'),
            onClick: () => {
              markRead(path)
              location.assign(`/api/tasks/${id}/archive`)
            },
          },
        })
      } else if (task.status === 'done') toast.success(t('watcher.done', { name }))
      if (task.status === 'failed') toast.error(t('watcher.failed', { name, error: errorText(task.error) }))
    }
  }, [ids, results, queryClient, storages.data])

  return null
}
