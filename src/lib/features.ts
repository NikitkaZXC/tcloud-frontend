import { useSyncExternalStore } from 'react'
import { load, save } from './prefs'

export const FEATURES = {
  pet: 'Пиксельный питомец',
  sounds: '8-битные звуки',
  confetti: 'Конфетти за достижения',
  cursor: 'Пиксельный курсор',
  eggs: 'Пасхалки и подсказки',
} as const

export type Feature = keyof typeof FEATURES

export const TASK_EVENT = 'tcloud:task-finished'

const listeners = new Set<() => void>()
let version = 0

export function isOn(feature: Feature): boolean {
  return load(`feature.${feature}`) === 'on'
}

export function setFeature(feature: Feature, on: boolean) {
  save(`feature.${feature}`, on ? 'on' : 'off')
  version++
  listeners.forEach((listener) => listener())
}

export function useFeature(feature: Feature): boolean {
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => version,
  )
  return isOn(feature)
}
