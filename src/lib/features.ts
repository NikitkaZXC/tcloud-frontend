import { type Settings, useSettings } from './settings'

export const FEATURES = {
  pet: 'fx_pet',
  sounds: 'fx_sounds',
  confetti: 'fx_confetti',
  cursor: 'fx_cursor',
  eggs: 'fx_easter_eggs',
} as const satisfies Record<string, keyof Settings['interface']>

export type Feature = keyof typeof FEATURES

export const TASK_EVENT = 'tcloud:task-finished'

export function useFeature(feature: Feature): boolean {
  return useSettings().interface[FEATURES[feature]]
}
