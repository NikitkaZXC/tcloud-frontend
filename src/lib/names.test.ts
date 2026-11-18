import { describe, expect, it } from 'vitest'
import { fileName, humanPath, isUnavailable, storageName, taskTitle } from './names'
import type { Task } from './types'

const storages = [{ id: '01a1eb9b-0000', name: 'Фото' }]

describe('names', () => {
  it('hides storage ids behind names', () => {
    expect(humanPath('tcloud/01a1eb9b-0000/2025/лето', storages)).toBe('Фото › 2025 › лето')
    expect(humanPath('tcloud/01a1eb9b-0000', storages)).toBe('Фото')
    expect(humanPath('tcloud/unknown/a', storages)).toBe('хранилище › a')
    expect(storageName({ name: null })).toBe('хранилище')
  })

  it('titles uploads by file name and archives by archive name', () => {
    expect(taskTitle({ path: 'tcloud/01a1eb9b-0000/933.jpg', archive: null } as Task, storages)).toEqual({ name: '933.jpg', where: 'Фото' })
    expect(taskTitle({ path: 'tcloud/01a1eb9b-0000/2025', archive: { name: '2025.zip' } } as Task, storages)).toEqual({ name: '2025.zip', where: 'Фото › 2025' })
    expect(fileName('tcloud/x/a/b.txt')).toBe('b.txt')
  })

  it('treats only an explicit false as unavailable', () => {
    expect(isUnavailable({ available: false })).toBe(true)
    expect(isUnavailable({ available: true })).toBe(false)
    expect(isUnavailable({} as { available: boolean })).toBe(false)
  })
})
