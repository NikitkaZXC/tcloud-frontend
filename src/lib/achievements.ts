import type { Key } from './i18n'

export const ACHIEVEMENTS = {
  'first-file': 'achievement.firstFile',
  'files-100': 'achievement.files100',
  'first-gb': 'achievement.firstGb',
  checklist: 'achievement.checklist',
} as const satisfies Record<string, Key>

export type Achievement = keyof typeof ACHIEVEMENTS

export function reached(stats: { files: number; size: number; checklist: boolean }): Achievement[] {
  return [
    ...(stats.files >= 1 ? (['first-file'] as const) : []),
    ...(stats.files >= 100 ? (['files-100'] as const) : []),
    ...(stats.size >= 1024 ** 3 ? (['first-gb'] as const) : []),
    ...(stats.checklist ? (['checklist'] as const) : []),
  ]
}

export function unlocked(now: Achievement[], fired: string[]): Achievement[] {
  return now.filter((key) => !fired.includes(key))
}

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']

export function konami(keys: string[]): boolean {
  return keys.slice(-KONAMI.length).map((key) => key.toLowerCase()).join() === KONAMI.map((key) => key.toLowerCase()).join()
}
