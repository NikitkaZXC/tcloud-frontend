import { getSettings, type Theme, updateSettings, useSettings } from './settings'

export type { Theme }

export function applyTheme(theme: Theme = getSettings().interface.theme) {
  document.documentElement.classList.toggle('light', theme === 'light')
}

export function setTheme(theme: Theme) {
  return updateSettings({ interface: { theme } })
}

export function useTheme(): Theme {
  return useSettings().interface.theme
}
