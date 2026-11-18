import { useQueryClient } from '@tanstack/react-query'
import { SearchIcon } from 'lucide-react'
import { type KeyboardEvent, useEffect, useId, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { isAdmin, useMe } from '@/hooks/use-me'
import { useStorages } from '@/hooks/use-storages'
import { type Command, filterCommands, type FolderAction, OPEN_PALETTE, runFolderAction } from '@/lib/commands'
import { storageName } from '@/lib/names'
import type { FolderListing } from '@/lib/types'
import { cn } from '@/lib/utils'

const folderLink = (path: string) => `/files?path=${encodeURIComponent(path)}`

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const queryClient = useQueryClient()
  const { data: me } = useMe()
  const storages = useStorages()
  const listId = useId()

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_PALETTE, onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_PALETTE, onOpen)
    }
  }, [])

  const folder = pathname === '/files' ? params.get('path') : null
  const go = (to: string) => () => navigate(to)
  const act = (action: FolderAction) => () => runFolderAction(action)
  const listing = open && folder ? queryClient.getQueryData<FolderListing>(['folder', folder]) : undefined

  const commands: Command[] = [
    ...(folder
      ? ([
          ['upload', 'Загрузить файлы'],
          ['upload-folder', 'Загрузить папку'],
          ['url', 'Загрузить по ссылке'],
          ['new-folder', 'Новая папка'],
          ['archive', 'Скачать текущую папку (zip)'],
          ['search', 'Фильтр по имени'],
        ] as [FolderAction, string][]).map(([action, label]) => ({ id: `a:${action}`, group: 'Действия', label, run: act(action) }))
      : []),
    ...(listing?.folders ?? []).map((f) => ({ id: `f:${f.path}`, group: 'Папки', label: f.name, hint: f.path.split('/').slice(2).join('/'), run: go(folderLink(f.path)) })),
    { id: 'p:dashboard', group: 'Страницы', label: 'Дашборд', run: go('/dashboard') },
    { id: 'p:files', group: 'Страницы', label: 'Хранилища', run: go('/files') },
    { id: 'p:tasks', group: 'Страницы', label: 'Задачи', run: go('/tasks') },
    { id: 'p:account', group: 'Страницы', label: 'Аккаунт', run: go('/account') },
    ...(isAdmin(me) ? [{ id: 'p:users', group: 'Страницы', label: 'Пользователи', run: go('/users') }] : []),
    ...(me?.role === 'root' ? [{ id: 'p:telegram', group: 'Страницы', label: 'Telegram', run: go('/telegram') }] : []),
    ...(storages.data ?? []).map((s) => ({ id: `s:${s.id}`, group: 'Хранилища', label: storageName(s), hint: s.description ?? undefined, run: go(folderLink(s.path)) })),
  ]
  const shown = filterCommands(commands, query)
  const current = Math.min(index, Math.max(shown.length - 1, 0))

  function close(next: boolean) {
    setOpen(next)
    if (!next) {
      setQuery('')
      setIndex(0)
    }
  }

  function run(command: Command | undefined) {
    if (!command) return
    close(false)
    command.run()
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setIndex((current + step + shown.length) % Math.max(shown.length, 1))
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setIndex(event.key === 'Home' ? 0 : shown.length - 1)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      run(shown[current])
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent showCloseButton={false} aria-describedby={undefined} className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Командная строка</DialogTitle>
        <div className="flex items-center gap-2 border-b px-4 py-2.5">
          <SearchIcon className="size-4 shrink-0 text-primary" aria-hidden />
          <input
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={shown[current] ? `${listId}-${current}` : undefined}
            aria-label="Команда или поиск"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIndex(0)
            }}
            onKeyDown={onKey}
            placeholder="перейти, загрузить, найти…"
            className="h-9 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          <button type="button" onClick={() => close(false)} className="fx-chip text-[10px] text-muted-foreground pointer-coarse:h-11 pointer-coarse:px-3" aria-label="Закрыть">
            Esc
          </button>
        </div>
        <ul id={listId} role="listbox" aria-label="Команды" className="max-h-80 overflow-y-auto p-1.5 text-sm max-sm:max-h-none">
          {shown.map((command, i) => (
            <li
              key={command.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === current}
              onMouseMove={() => setIndex(i)}
              onClick={() => run(command)}
              ref={(el) => {
                if (i === current) el?.scrollIntoView({ block: 'nearest' })
              }}
              className={cn('flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition-colors pointer-coarse:py-3', i === current && 'bg-foreground/8 text-foreground shadow-[inset_2px_0_0_var(--primary-ink)]')}
            >
              <span className="fx-label w-24 shrink-0 truncate text-[10px] max-sm:hidden">{command.group}</span>
              <span className="min-w-0 flex-1 truncate">{command.label}</span>
              {command.hint && <span className="max-w-40 truncate text-xs text-muted-foreground">{command.hint}</span>}
            </li>
          ))}
          {shown.length === 0 && <li className="px-3 py-4 text-center text-muted-foreground">Ничего не найдено</li>}
        </ul>
        <p className="border-t px-4 py-2 text-[11px] text-muted-foreground max-sm:hidden">↑↓ выбор · enter запуск · ctrl+k открыть/закрыть</p>
      </DialogContent>
    </Dialog>
  )
}
