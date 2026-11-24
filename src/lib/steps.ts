import { DICTIONARIES, type Key, t } from './i18n'
import type { Task, TaskStep } from './types'

const FINISHED_STATUSES = ['done', 'failed', 'cancelled']

export type Phase = 'upload' | 'download' | 'check' | 'encrypt' | 'send' | 'archive'

export type Mark = 'done' | 'active' | 'todo' | 'stopped'

export const PHASE_OF: Record<TaskStep, Phase> = {
  queued_for_download: 'download',
  downloading: 'download',
  queued_for_prepare: 'check',
  analyzing: 'check',
  scanning: 'check',
  converting: 'check',
  encrypting: 'encrypt',
  previewing: 'encrypt',
  queued_for_telegram: 'send',
  sending: 'send',
  finishing: 'send',
  queued_for_archive: 'archive',
  archiving: 'archive',
}

export const MEASURED: TaskStep[] = ['downloading', 'analyzing', 'scanning', 'encrypting', 'sending', 'archiving']

export const stepLabel = (step: string) => (`step.${step}` in DICTIONARIES.ru ? t(`step.${step}` as Key) : step)

export const phaseLabel = (phase: Phase) => t(`phase.${phase}`)

export interface Hint {
  source: 'device' | 'url'
  encrypt: boolean
}

const hints = new Map<string, Hint>()

export function hintTask(id: string, hint: Hint) {
  hints.set(id, hint)
}

export const taskHint = (id: string) => hints.get(id)

export const clearHints = () => hints.clear()

export function taskPhases(task: Pick<Task, 'step' | 'archive'>, hint?: Hint): Phase[] {
  if (task.archive) return ['archive']
  const current = task.step ? PHASE_OF[task.step] : null
  const url = hint ? hint.source === 'url' : current === 'download'
  const encrypt = hint ? hint.encrypt : current === 'encrypt'
  const phases: (Phase | false)[] = [hint?.source === 'device' && 'upload', url && 'download', 'check', encrypt && 'encrypt', 'send']
  return phases.filter((phase): phase is Phase => !!phase)
}

export function trail(phases: Phase[], current: Phase | null, status: string): { phase: Phase; mark: Mark }[] {
  const at = current ? phases.indexOf(current) : -1
  return phases.map((phase, i) => {
    if (status === 'done' || i < at) return { phase, mark: 'done' }
    if (i !== at) return { phase, mark: 'todo' }
    return { phase, mark: FINISHED_STATUSES.includes(status) ? 'stopped' : 'active' }
  })
}

export const taskTrail = (task: Task) => trail(taskPhases(task, taskHint(task.id)), task.step ? PHASE_OF[task.step] : null, task.status)

export const isMeasured = (task: Pick<Task, 'status' | 'step'>) => task.status === 'running' && !!task.step && MEASURED.includes(task.step)

export const stepFraction = (task: Pick<Task, 'status' | 'step_progress'>) =>
  task.status === 'running' && task.step_progress != null ? Math.min(Math.max(task.step_progress, 0), 1) : null

export const canCancel = (task: Pick<Task, 'status' | 'cancel_requested'>, inFlight: boolean) =>
  !inFlight && !task.cancel_requested && !FINISHED_STATUSES.includes(task.status)
