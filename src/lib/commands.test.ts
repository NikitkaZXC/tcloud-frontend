import { describe, expect, it } from 'vitest'
import { type Command, filterCommands } from './commands'

const command = (group: string, label: string, hint?: string): Command => ({ id: label, group, label, hint, run: () => undefined })

describe('command palette', () => {
  it('matches every word against group, label and hint', () => {
    const all = [command('Страницы', 'Задачи'), command('Хранилища', 'Фото', 'tcloud/x'), command('Действия', 'Загрузить папку')]
    expect(filterCommands(all, '').length).toBe(3)
    expect(filterCommands(all, 'загр пап').map((c) => c.label)).toEqual(['Загрузить папку'])
    expect(filterCommands(all, 'хран фото').map((c) => c.label)).toEqual(['Фото'])
    expect(filterCommands(all, 'нет')).toEqual([])
  })
})
