import { describe, expect, it } from 'vitest'
import { crumbs, filesCount, formatBytes, formatCount, formatDuration, formatShortDate, formatSpan, joinPath, parentPath, parseUrlLines, storageIdOf } from './format'
import { setLang } from './i18n'

const root = 'tcloud/0190a2b4-0000-7000-8000-000000000000'

describe('paths', () => {
  it('builds breadcrumbs below the storage root', () => {
    expect(crumbs(`${root}/a/b`)).toEqual([
      { name: 'a', path: `${root}/a` },
      { name: 'b', path: `${root}/a/b` },
    ])
    expect(crumbs(root)).toEqual([])
  })

  it('joins, splits and finds the storage', () => {
    expect(joinPath(`${root}/`, '/x.txt')).toBe(`${root}/x.txt`)
    expect(parentPath(`${root}/a/x.txt`)).toBe(`${root}/a`)
    expect(storageIdOf(`${root}/a`)).toBe(root.split('/')[1])
  })
})

describe('parseUrlLines', () => {
  it('takes the name from the url or after a pipe', () => {
    expect(parseUrlLines('https://e.com/v/%D0%B2%D0%B8%D0%B4%D0%B5%D0%BE.mp4\n\n  https://e.com/get?id=1 | p.jpg ', root)).toEqual([
      { url: 'https://e.com/v/%D0%B2%D0%B8%D0%B4%D0%B5%D0%BE.mp4', path: `${root}/видео.mp4` },
      { url: 'https://e.com/get?id=1', path: `${root}/p.jpg` },
    ])
    expect(parseUrlLines('https://e.com/', root)[0].path).toBe(`${root}/file`)
  })

  it('keeps pipes inside the url and in the name, and survives broken escapes', () => {
    expect(parseUrlLines('https://e.com/a?x=1|2 | my | name.txt', root)).toEqual([{ url: 'https://e.com/a?x=1|2', path: `${root}/my | name.txt` }])
    expect(parseUrlLines('https://e.com/a|b.jpg', root)[0]).toEqual({ url: 'https://e.com/a|b.jpg', path: `${root}/a|b.jpg` })
    expect(parseUrlLines('https://e.com/100%25%zz.bin', root)[0].path).toBe(`${root}/100%25%zz.bin`)
  })

  it('throws on a broken url', () => {
    expect(() => parseUrlLines('not a url', root)).toThrow()
  })
})

describe('format', () => {
  it('formats bytes and durations', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1,5 KB')
    setLang('en')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(filesCount(1)).toBe('1 file')
    setLang('ru')
    expect(formatBytes(null)).toBe('—')
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(3725)).toBe('1:02:05')
  })

  it('formats short dates without seconds', () => {
    expect(formatShortDate(null)).toBe('—')
    const iso = '2026-11-18T02:49:50Z'
    const expected = new Intl.DateTimeFormat('ru', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
    expect(formatShortDate(iso)).toBe(expected)
    expect(formatShortDate(iso)).not.toContain('50')
  })
})

describe('plural', () => {
  it('picks the Russian form', () => {
    expect([0, 1, 2, 5, 11, 12, 21, 22, 25, 111].map(filesCount)).toEqual([
      '0 файлов', '1 файл', '2 файла', '5 файлов', '11 файлов', '12 файлов', '21 файл', '22 файла', '25 файлов', '111 файлов',
    ])
  })
})

describe('formatCount', () => {
  it('keeps small counts and compacts big ones', () => {
    setLang('en')
    expect(formatCount(9999)).toBe('9999')
    expect(formatCount(1222205)).toBe('1.2M')
    setLang('ru')
    expect(formatCount(12345)).toBe('12,3 тыс.')
  })
})

describe('formatSpan', () => {
  it('writes quota windows and waits in words, at most two units', () => {
    expect([86400, 30, 300, 90, 3725, 0.4, 90061].map(formatSpan)).toEqual(['1 д', '30 с', '5 мин', '1 мин 30 с', '1 ч 2 мин', '0 с', '1 д 1 ч'])
    setLang('en')
    expect(formatSpan(86400)).toBe('1 d')
    setLang('ru')
  })
})
