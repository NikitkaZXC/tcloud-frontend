import { type Settings, useSettings } from './settings'

export const FEATURES = {
  sounds: 'fx_sounds',
  eggs: 'fx_easter_eggs',
} as const satisfies Record<string, keyof Settings['interface']>

export type Feature = keyof typeof FEATURES

export const TASK_EVENT = 'tcloud:task-finished'

export function useFeature(feature: Feature): boolean {
  return useSettings().interface[FEATURES[feature]]
}
