import { useSyncExternalStore } from 'react'
import { en } from './locales/en'
import { ru } from './locales/ru'

export type Lang = 'ru' | 'en'
export type Plural = { one: string; few?: string; many?: string; other: string }
export type Entry = string | Plural
export type Key = keyof typeof ru
export type Params = Record<string, string | number>

export const DICTIONARIES: Record<Lang, Record<Key, Entry>> = { ru, en }
export const LANGS: Lang[] = ['ru', 'en']

let lang: Lang = 'ru'
const listeners = new Set<() => void>()
const rules = new Map<Lang, Intl.PluralRules>()

export function resolveLang(setting: Lang | null | undefined, browser: string | undefined): Lang {
  if (setting === 'ru' || setting === 'en') return setting
  return browser?.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

export function getLang(): Lang {
  return lang
}

export function setLang(next: Lang) {
  if (next === lang) return
  lang = next
  listeners.forEach((listener) => listener())
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getLang,
  )
}

function pluralForm(language: Lang, n: number): keyof Plural {
  let rule = rules.get(language)
  if (!rule) rules.set(language, (rule = new Intl.PluralRules(language)))
  return rule.select(n) as keyof Plural
}

export function translate(language: Lang, key: Key, params?: Params): string {
  const entry = DICTIONARIES[language][key] ?? DICTIONARIES.ru[key] ?? key
  const text = typeof entry === 'string' ? entry : (entry[pluralForm(language, Number(params?.n ?? 0))] ?? entry.other)
  return params ? text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match)) : text
}

export function t(key: Key, params?: Params): string {
  return translate(lang, key, params)
}

export function tAll(key: Key, params?: Params): string {
  return LANGS.map((language) => translate(language, key, params)).join(' ')
}
