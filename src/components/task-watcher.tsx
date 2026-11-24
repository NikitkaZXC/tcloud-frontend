import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { isFinished, useTasks } from '@/hooks/use-tasks'
import { ApiError, errorText } from '@/lib/api'
import { markRead } from '@/lib/reads'
import { useStorages } from '@/hooks/use-storages'
import { TASK_EVENT } from '@/lib/features'
import { taskTitle } from '@/lib/names'
import { forgetTasks, isPending, reportTask, taskFolders, useTrackedTasks } from '@/lib/tasks'
import { parentPath } from '@/lib/format'
import { getPausedSessions, useSending } from '@/lib/upload'
import { t } from '@/lib/i18n'
import type { Task } from '@/lib/types'

let pausedShown = false

export function TaskWatcher() {
  const ids = useTrackedTasks()
  const results = useTasks(ids)
  const queryClient = useQueryClient()
  const uploading = useSending().some((item) => !item.cancelled)
  const storages = useStorages()
  const navigate = useNavigate()

  useEffect(() => {
    const paused = getPausedSessions()
    if (pausedShown || !paused.length) return
    pausedShown = true
    const folder = parentPath(paused[0].path)
    toast.info(t('uploads.pausedFound', { n: paused.length }), {
      id: 'paused-uploads',
      duration: 15000,
      action: { label: t('folder.open'), onClick: () => navigate(`/files?path=${encodeURIComponent(folder)}`) },
    })
  }, [navigate])

  useEffect(() => {
    if (!uploading) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [uploading])

  useEffect(() => {
    const gone = ids.filter((_, i) => results[i].error instanceof ApiError && results[i].error.status === 404)
    if (gone.length) forgetTasks(gone)
    const finished: Task[] = []
    for (const { data: task } of results) {
      if (!task || !isFinished(task) || !isPending(task.id)) continue
      reportTask(task.id, task.status === 'done' && !task.archive)
      finished.push(task)
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
    if (!finished.length) return
    queryClient.invalidateQueries({ queryKey: ['task-counts'] })
    const folders = taskFolders(finished)
    if (!folders.length) return
    folders.forEach((folder) => queryClient.invalidateQueries({ queryKey: ['folder', folder] }))
    queryClient.invalidateQueries({ queryKey: ['storages'] })
    queryClient.invalidateQueries({ queryKey: ['account'] })
    queryClient.invalidateQueries({ queryKey: ['activity'] })
    queryClient.invalidateQueries({ queryKey: ['search'] })
    queryClient.invalidateQueries({ queryKey: ['mimes'] })
  }, [ids, results, queryClient, storages.data])

  return null
}
