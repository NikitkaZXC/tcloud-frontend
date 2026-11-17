import { describe, expect, it } from 'vitest'
import { crumbs, formatBytes, formatDuration, joinPath, parentPath, parseUrlLines, storageIdOf } from './format'

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

  it('throws on a broken url', () => {
    expect(() => parseUrlLines('not a url', root)).toThrow()
  })
})

describe('format', () => {
  it('formats bytes and durations', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(null)).toBe('—')
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(3725)).toBe('1:02:05')
  })
})
