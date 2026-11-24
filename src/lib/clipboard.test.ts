import { toast } from 'sonner'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { absoluteUrl, copy } from './clipboard'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('clipboard', () => {
  it('copies and names what was copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await copy('k-123', 'API-ключ')
    expect(writeText).toHaveBeenCalledWith('k-123')
    expect(toast.success).toHaveBeenCalledWith('Скопировано: API-ключ')
  })

  it('reports a denied or missing clipboard', async () => {
    vi.stubGlobal('navigator', {})
    await copy('x', 'y')
    expect(toast.error).toHaveBeenCalledWith('Браузер не дал доступ к буферу обмена')
  })

  it('builds absolute urls on the current origin', () => {
    expect(absoluteUrl('/api/files/1/download')).toBe(`${location.origin}/api/files/1/download`)
  })
})
