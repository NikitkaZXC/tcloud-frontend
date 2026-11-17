import { useSyncExternalStore } from 'react'
import { load, save } from '@/lib/prefs'

export type Theme = 'dark' | 'light'

const listeners = new Set<() => void>()
let current: Theme = readTheme()

export function readTheme(): Theme {
  return load('theme') === 'light' ? 'light' : 'dark'
}

export function applyTheme(theme: Theme = current) {
  document.documentElement.classList.toggle('light', theme === 'light')
}

export function setTheme(theme: Theme) {
  current = theme
  save('theme', theme)
  applyTheme(theme)
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, () => current)
}
