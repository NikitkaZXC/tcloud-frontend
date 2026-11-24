import { describe, expect, it } from 'vitest'
import { setLang } from './i18n'
import { canCancel, hintTask, isMeasured, PHASE_OF, stepFraction, stepLabel, taskPhases, taskTrail, trail } from './steps'
import type { Task, TaskStep } from './types'

const task = (patch: Partial<Task>) => ({ id: 'x', status: 'running', step: null, step_progress: null, archive: null, source: null, cancel_requested: false, ...patch }) as Task

describe('task steps', () => {
  it('labels every step in both languages and falls back to the code', () => {
    for (const step of Object.keys(PHASE_OF)) expect(stepLabel(step)).not.toBe(step)
    expect(stepLabel('scanning')).toBe('Проверка антивирусом')
    setLang('en')
    expect(stepLabel('scanning')).toBe('Antivirus scan')
    setLang('ru')
    expect(stepLabel('new_step')).toBe('new_step')
  })

  it('lists only the phases that apply to the file', () => {
    expect(taskPhases({ step: 'archiving', archive: {} as Task['archive'], source: null })).toEqual(['archive'])
    expect(taskPhases({ step: 'queued_for_archive', archive: null, source: 'archive' })).toEqual(['archive'])
    expect(taskPhases({ step: 'analyzing', archive: null, source: 'device' }, { encrypt: true })).toEqual(['upload', 'check', 'encrypt', 'send'])
    expect(taskPhases({ step: 'sending', archive: null, source: 'url' }, { encrypt: false })).toEqual(['download', 'check', 'send'])
    expect(taskPhases({ step: 'downloading', archive: null, source: null })).toEqual(['download', 'check', 'send'])
    expect(taskPhases({ step: 'previewing', archive: null, source: null })).toEqual(['check', 'encrypt', 'send'])
  })

  it('fills phases before the current one and marks where a task stopped', () => {
    const phases = taskPhases({ step: null, archive: null, source: 'url' }, { encrypt: true })
    expect(trail(phases, 'encrypt', 'running').map((s) => s.mark)).toEqual(['done', 'done', 'active', 'todo'])
    expect(trail(phases, 'check', 'cancelled').map((s) => s.mark)).toEqual(['done', 'stopped', 'todo', 'todo'])
    expect(trail(phases, null, 'done').every((s) => s.mark === 'done')).toBe(true)
    expect(trail(phases, null, 'queued').map((s) => s.mark)).toEqual(['todo', 'todo', 'todo', 'todo'])
    hintTask('h', { encrypt: false })
    expect(taskTrail(task({ id: 'h', step: 'queued_for_telegram', source: 'device' })).map((s) => `${s.phase}:${s.mark}`)).toEqual(['upload:done', 'check:done', 'send:active'])
  })

  it('shows speed and a bar only for measured running steps', () => {
    const measured: TaskStep[] = ['downloading', 'analyzing', 'scanning', 'encrypting', 'sending', 'archiving']
    for (const step of Object.keys(PHASE_OF) as TaskStep[]) expect(isMeasured(task({ step }))).toBe(measured.includes(step))
    expect(isMeasured(task({ step: 'sending', status: 'done' }))).toBe(false)
    expect(stepFraction(task({ step_progress: 0.4 }))).toBe(0.4)
    expect(stepFraction(task({ step_progress: 1.2 }))).toBe(1)
    expect(stepFraction(task({ step_progress: null }))).toBeNull()
    expect(stepFraction(task({ step_progress: 0.4, status: 'cancelled' }))).toBeNull()
  })

  it('allows one cancel request for an unfinished task', () => {
    expect(canCancel(task({ status: 'queued' }), false)).toBe(true)
    expect(canCancel(task({}), true)).toBe(false)
    expect(canCancel(task({ cancel_requested: true }), false)).toBe(false)
    for (const status of ['done', 'failed', 'cancelled'] as const) expect(canCancel(task({ status }), false)).toBe(false)
  })
})
