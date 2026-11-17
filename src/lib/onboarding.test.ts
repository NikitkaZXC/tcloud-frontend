import { describe, expect, it } from 'vitest'
import { checklist } from './onboarding'
import type { Storage, TelegramSessionState } from './types'

const session = (authorized: boolean) => ({ session: 'api', authorized, login: null }) as TelegramSessionState

describe('first-run checklist', () => {
  it('derives steps from sessions and storages', () => {
    expect(checklist([session(true), session(false), session(false)], []).map((s) => s.done)).toEqual([false, false, false])
    const storages = [{ path: 'tcloud/a', available: true, files: 0 }] as Storage[]
    const steps = checklist([session(true), session(true), session(true)], storages)
    expect(steps.map((s) => s.done)).toEqual([true, true, false])
    expect(steps[2].to).toBe('/files?path=tcloud%2Fa')
    expect(checklist([], [{ ...storages[0], files: 2 }]).map((s) => s.done)).toEqual([false, true, true])
  })
})
