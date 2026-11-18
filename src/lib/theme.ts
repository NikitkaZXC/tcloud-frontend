import { useSyncExternalStore } from 'react'
import { getSettings, type Theme, type ThemeName, THEMES, updateSettings, useSettings } from './settings'

export type { Theme, ThemeName }
export { THEMES }

const LIGHT_QUERY = '(prefers-color-scheme: light)'
const LIGHT_THEMES: ThemeName[] = ['light', 'lavender', 'clay']

export const THEME_SWATCHES: Record<ThemeName, string[]> = {
  dark: ['#051f20', '#235347', '#8eb69b', '#daf1de'],
  light: ['#daf1de', '#8eb69b', '#235347', '#0b2b26'],
  sunset: ['#1d1a39', '#451952', '#ae445a', '#f39f5a'],
  navy: ['#0d1b2a', '#415a77', '#778d7a', '#d4c4a8'],
  lavender: ['#f7eef2', '#d7b6c7', '#8d73a8', '#4a355e'],
  clay: ['#fff4e6', '#e7b79b', '#c46f52', '#a2533d'],
}

function systemLight() {
  return typeof matchMedia === 'function' && matchMedia(LIGHT_QUERY).matches
}

function subscribeSystem(onChange: () => void) {
  if (typeof matchMedia !== 'function') return () => {}
  const media = matchMedia(LIGHT_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

export function resolveTheme(theme: Theme): ThemeName {
  if (theme === 'system') return systemLight() ? 'light' : 'dark'
  return THEMES.includes(theme) ? theme : 'dark'
}

export function themeMode(theme: Theme): 'dark' | 'light' {
  return LIGHT_THEMES.includes(resolveTheme(theme)) ? 'light' : 'dark'
}

let watching = false

export function applyTheme(theme: Theme = getSettings().interface.theme) {
  const root = document.documentElement
  root.classList.toggle('light', themeMode(theme) === 'light')
  root.dataset.theme = resolveTheme(theme)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_SWATCHES[resolveTheme(theme)][0])
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
  return themeMode(theme)
}
