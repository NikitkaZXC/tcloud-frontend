import { useSyncExternalStore } from 'react'
import { getSettings, type Theme, updateSettings, useSettings } from './settings'

export type { Theme }

const LIGHT_QUERY = '(prefers-color-scheme: light)'

function systemLight() {
  return typeof matchMedia === 'function' && matchMedia(LIGHT_QUERY).matches
}

function subscribeSystem(onChange: () => void) {
  if (typeof matchMedia !== 'function') return () => {}
  const media = matchMedia(LIGHT_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

export function resolveTheme(theme: Theme): 'dark' | 'light' {
  return theme === 'system' ? (systemLight() ? 'light' : 'dark') : theme
}

let watching = false

export function applyTheme(theme: Theme = getSettings().interface.theme) {
  document.documentElement.classList.toggle('light', resolveTheme(theme) === 'light')
  if (!watching) {
    watching = true
    subscribeSystem(() => applyTheme())
  }
}

export function setTheme(theme: Theme) {
  return updateSettings({ interface: { theme } })
}

export function useTheme(): 'dark' | 'light' {
  const theme = useSettings().interface.theme
  useSyncExternalStore(subscribeSystem, systemLight)
  return resolveTheme(theme)
}
