import { describe, expect, it } from 'vitest'
import { ApiError } from './api'
import { archiveError, archiveName, selectionPayload } from './archive'

describe('selection archive', () => {
  it('splits selected keys into file ids and folder paths', () => {
    expect(selectionPayload(['d:tcloud/s/trip/day 1', 'f:u1', 'f:u2'], '7z', 'normal')).toEqual({
      files: ['u1', 'u2'],
      folders: ['tcloud/s/trip/day 1'],
      format: '7z',
      priority: 'normal',
    })
  })

  it('names a selection at the storage root after the storage, not its id', () => {
    expect(archiveName('Фото/2026')).toBe('Фото-2026-выбранное')
    expect(archiveName(null)).toBeUndefined()
    expect(selectionPayload(['f:u1'], 'zip', 'high', 'Фото-выбранное').name).toBe('Фото-выбранное')
  })

  it('explains backend errors', () => {
    expect(archiveError(new ApiError(422, { code: 'too_many_items', message: 'x', limit: 1000 }))).toBe('Слишком много элементов: не больше 1000 за раз')
    expect(archiveError(new ApiError(422, { code: 'storage_mismatch', message: 'x' }))).toBe('Архив собирается только из одного хранилища')
    expect(archiveError(new ApiError(500, { code: 'boom', message: 'x' }))).toBe('x (boom)')
  })
})
