import { afterEach, describe, expect, it } from 'vitest'
import { DICTIONARIES, type Entry, getLang, resolveLang, setLang, t, tAll, translate } from './i18n'

const placeholders = (entry: Entry) => [...new Set((typeof entry === 'string' ? [entry] : Object.values(entry)).flatMap((text) => text.match(/\{\w+\}/g) ?? []))].sort()

describe('i18n', () => {
  afterEach(() => setLang('ru'))

  it('has the same keys, kinds and placeholders in both dictionaries', () => {
    const { ru, en } = DICTIONARIES
    expect(Object.keys(en).sort()).toEqual(Object.keys(ru).sort())
    for (const key of Object.keys(ru) as (keyof typeof ru)[]) {
      expect(typeof en[key], key).toBe(typeof ru[key])
      expect(placeholders(en[key]), key).toEqual(placeholders(ru[key]))
      if (typeof ru[key] === 'object') {
        expect(Object.keys(ru[key]).sort(), key).toEqual(['few', 'many', 'one', 'other'])
        expect(Object.keys(en[key]).sort(), key).toEqual(['one', 'other'])
      }
      const english = typeof en[key] === 'string' ? [en[key]] : Object.values(en[key])
      expect(english.every((text) => text.trim() && !/[А-Яа-яЁё]/.test(text)), key).toBe(true)
    }
  })

  it('picks Russian and English plural forms', () => {
    const ru = [0, 1, 2, 5, 11, 12, 21, 22, 25, 111].map((n) => translate('ru', 'count.files', { n }))
    expect(ru).toEqual(['0 файлов', '1 файл', '2 файла', '5 файлов', '11 файлов', '12 файлов', '21 файл', '22 файла', '25 файлов', '111 файлов'])
    expect(translate('ru', 'count.files', { n: 1.5 })).toBe('1.5 файла')
    expect([0, 1, 2, 21].map((n) => translate('en', 'count.files', { n }))).toEqual(['0 files', '1 file', '2 files', '21 files'])
  })

  it('interpolates params and switches the current language', () => {
    expect(t('folder.deleteFileQ', { name: 'a.txt' })).toBe('Удалить «a.txt»?')
    setLang('en')
    expect(getLang()).toBe('en')
    expect(t('folder.deleteFileQ', { name: 'a.txt' })).toBe('Delete “a.txt”?')
    expect(tAll('nav.tasks')).toBe('Задачи Tasks')
  })

  it('resolves the language from the setting or the browser', () => {
    expect(resolveLang('en', 'ru-RU')).toBe('en')
    expect(resolveLang(null, 'ru-RU')).toBe('ru')
    expect(resolveLang(null, 'RU')).toBe('ru')
    expect(resolveLang(null, 'de-DE')).toBe('en')
    expect(resolveLang(undefined, undefined)).toBe('en')
  })
})
