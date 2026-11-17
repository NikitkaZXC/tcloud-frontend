import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { isFinished, useTasks } from '@/hooks/use-tasks'
import { ApiError } from '@/lib/api'
import { forgetTasks, useTrackedTasks } from '@/lib/tasks'

export function TaskWatcher() {
  const ids = useTrackedTasks()
  const results = useTasks(ids)
  const queryClient = useQueryClient()
  const seen = useRef(new Map<string, string>())

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
      const name = task.archive?.name ?? task.path.split('/').pop()
      if (task.status === 'done') toast.success(`Готово: ${name}`)
      if (task.status === 'failed') toast.error(`Ошибка: ${name} — ${task.error?.message ?? ''}`)
    }
  }, [ids, results, queryClient])

  return null
}
