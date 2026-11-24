import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Storage } from '@/lib/types'
import { json, renderApp } from '@/test-utils'
import { StorageForm } from './storages'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const storage = { id: 's1', path: 'tcloud/s1', name: 'Photos', description: 'old', has_photo: false, available: true } as Storage

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

const bodies = (fetch: ReturnType<typeof vi.fn>) => fetch.mock.calls.map(([url, init]) => [init.method, url, typeof init.body === 'string' ? JSON.parse(init.body) : init.body?.constructor.name])

describe('StorageForm', () => {
  it('closes and refreshes the list after create even when the photo upload fails', async () => {
    const fetch = vi.fn(async (url: string) => (url === '/api/storages' ? json(201, { ...storage, id: 's2' }) : json(400, { error: { code: 'unsupported_media_type', message: 'x' } })))
    vi.stubGlobal('fetch', fetch)
    const { client } = renderApp(<StorageForm />)
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Создать/ }))
    await user.type(screen.getByLabelText('Название канала'), 'New')
    await user.upload(screen.getByLabelText('Фото канала'), new File(['x'], 'a.png', { type: 'image/png' }))
    await user.click(screen.getByRole('button', { name: 'Создать канал' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Хранилище сохранено, но фото не загрузилось: Неподдерживаемый тип файла'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(bodies(fetch)).toEqual([
      ['POST', '/api/storages', { name: 'New', description: '' }],
      ['PUT', '/api/storages/s2/photo', 'File'],
    ])
    expect(invalidate.mock.calls.map(([filter]) => filter?.queryKey)).toEqual([['storages'], ['account']])
  })

  it('sends a cleared description as an empty string and resets the form on reopen', async () => {
    const fetch = vi.fn(async () => json(200, storage))
    vi.stubGlobal('fetch', fetch)
    renderApp(<StorageForm storage={storage} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Изменить' }))
    await user.clear(screen.getByLabelText('Описание'))
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(bodies(fetch)).toEqual([['PATCH', '/api/storages/s1', { name: 'Photos', description: '' }]])
    await user.click(screen.getByRole('button', { name: 'Изменить' }))
    await user.type(screen.getByLabelText('Название канала'), ' draft')
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Изменить' }))
    expect((screen.getByLabelText('Название канала') as HTMLInputElement).value).toBe('Photos')
    expect((screen.getByLabelText('Описание') as HTMLInputElement).value).toBe('old')
  })

  it('fills an empty name for an unavailable channel and accepts only still images', async () => {
    renderApp(<StorageForm storage={{ ...storage, name: null, description: null }} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Изменить' }))
    expect((screen.getByLabelText('Название канала') as HTMLInputElement).value).toBe('')
    expect(screen.getByLabelText('Фото канала').getAttribute('accept')).toBe('image/jpeg,image/png,image/webp,image/heic,image/heif,image/gif')
  })

  it('rejects a photo over 10 MB before sending', async () => {
    const fetch = vi.fn(async () => json(201, storage))
    vi.stubGlobal('fetch', fetch)
    renderApp(<StorageForm />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Создать/ }))
    await user.type(screen.getByLabelText('Название канала'), 'New')
    const big = new File(['x'], 'big.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: 10 * 1024 * 1024 + 1 })
    await user.upload(screen.getByLabelText('Фото канала'), big)
    expect(toast.error).toHaveBeenCalledWith('Фото больше 10,0 MB')
    await user.click(screen.getByRole('button', { name: 'Создать канал' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    expect(bodies(fetch)[0][1]).toBe('/api/storages')
  })
})
