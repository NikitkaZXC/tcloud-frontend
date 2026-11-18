import { useQuery, useQueryClient } from '@tanstack/react-query'
import { SearchIcon } from 'lucide-react'
import { type KeyboardEvent, useEffect, useId, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { isAdmin, useMe } from '@/hooks/use-me'
import { useStorages } from '@/hooks/use-storages'
import { type Command, filterCommands, focusSearch, type FolderAction, OPEN_PALETTE, runFolderAction } from '@/lib/commands'
import { foundLocation, storageName } from '@/lib/names'
import { api } from '@/lib/api'
import { parentPath } from '@/lib/format'
import { t, tAll, type Key, type Params } from '@/lib/i18n'
import { useSettings } from '@/lib/settings'
import { EMPTY_SEARCH, searchQuery, searchUrl } from '@/lib/search'
import { FileDialog } from '@/components/file-dialog'
import { useDebounced } from '@/hooks/use-search'
import type { FolderListing, FoundFile, SearchResult } from '@/lib/types'
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
  const [opened, setOpened] = useState<FoundFile | null>(null)
  const term = useDebounced(query.trim())
  const found = useQuery({
    queryKey: ['search', 'palette', term],
    queryFn: () => api.get<SearchResult>(`/files/search?${searchQuery({ ...EMPTY_SEARCH, q: term }, 0, 8)}`),
    enabled: open && term.length >= 2,
    retry: false,
  })
  const storageList = storages.data ?? []
  const archiveFormat = useSettings().archives.format

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

  const fixed = (id: string, group: Key, label: Key, run: () => void, params?: Params, hint?: string): Command => ({
    id,
    group: t(group),
    label: t(label, params),
    keywords: `${tAll(group)} ${tAll(label, params)}`,
    hint,
    run,
  })
  const commands: Command[] = [
    ...(folder
      ? ([
          ['upload', 'palette.uploadFiles'],
          ['upload-folder', 'folder.uploadFolder'],
          ['url', 'palette.uploadUrl'],
          ['new-folder', 'folder.newFolder'],
          ['archive', 'palette.archive'],
        ] as [FolderAction, Key][]).map(([action, label]) => fixed(`a:${action}`, 'palette.actions', label, act(action), { format: archiveFormat }))
      : []),
    ...(listing?.folders ?? []).map((f) => ({ id: `f:${f.path}`, group: t('palette.folders'), keywords: tAll('palette.folders'), label: f.name, hint: f.path.split('/').slice(2).join('/'), run: go(folderLink(f.path)) })),
    fixed('a:search', 'palette.actions', 'palette.searchFiles', focusSearch, undefined, '/'),
    fixed('p:dashboard', 'palette.pages', 'nav.dashboard', go('/dashboard')),
    fixed('p:files', 'palette.pages', 'nav.storages', go('/files')),
    fixed('p:tasks', 'palette.pages', 'nav.tasks', go('/tasks')),
    fixed('p:account', 'palette.pages', 'nav.account', go('/account')),
    fixed('p:settings', 'palette.pages', 'nav.settings', go('/settings')),
    ...(isAdmin(me) ? [fixed('p:users', 'palette.pages', 'nav.users', go('/users'))] : []),
    ...(me?.role === 'root' ? [fixed('p:telegram', 'palette.pages', 'nav.telegram', go('/telegram'))] : []),
    ...(storages.data ?? []).map((s) => ({ id: `s:${s.id}`, group: t('nav.storages'), keywords: tAll('nav.storages'), label: storageName(s), hint: s.description ?? undefined, run: go(folderLink(s.path)) })),
  ]
  const results: Command[] =
    term.length >= 2 && term === query.trim()
      ? [
          ...(found.data?.folders ?? []).map((f) => ({ id: `sf:${f.id}`, group: t('palette.folders'), label: f.name, hint: foundLocation(parentPath(f.path), f, storageList), run: go(folderLink(f.path)) })),
          ...(found.data?.items ?? []).map((f) => ({ id: `sd:${f.uuid}`, group: t('palette.files'), label: f.name, hint: foundLocation(f.folder, f, storageList), run: () => setOpened(f) })),
          { id: 'sa:all', group: t('nav.search'), label: `${t('palette.allResults', { term })}${found.data ? ` · ${found.data.total}` : ''}`, run: go(searchUrl({ ...EMPTY_SEARCH, q: term })) },
        ]
      : []
  const shown = [...filterCommands(commands, query), ...results]
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
    <>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent showCloseButton={false} aria-describedby={undefined} className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">{t('palette.title')}</DialogTitle>
          <div className="flex items-center gap-2 border-b px-4 py-2.5">
            <SearchIcon className="size-4 shrink-0 text-primary" aria-hidden />
            <input
              autoFocus
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={shown[current] ? `${listId}-${current}` : undefined}
              aria-label={t('palette.input')}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setIndex(0)
              }}
              onKeyDown={onKey}
              placeholder={t('palette.placeholder')}
              className="h-9 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
            <button type="button" onClick={() => close(false)} className="fx-chip text-[12px] text-muted-foreground pointer-coarse:h-11 pointer-coarse:px-3" aria-label={t('common.close')}>
              Esc
            </button>
          </div>
          <ul id={listId} role="listbox" aria-label={t('palette.commands')} className="max-h-80 overflow-y-auto p-1.5 text-sm max-sm:max-h-none">
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
                <span className="fx-label w-24 shrink-0 truncate text-[12px] max-sm:hidden">{command.group}</span>
                <span className="min-w-0 flex-1 truncate">{command.label}</span>
                {command.hint && <span className="max-w-40 truncate text-xs text-muted-foreground">{command.hint}</span>}
              </li>
            ))}
            {found.isFetching && <li className="px-3 py-2 text-xs text-muted-foreground">{t('palette.searching')}</li>}
            {shown.length === 0 && !found.isFetching && <li className="px-3 py-4 text-center text-muted-foreground">{t('common.nothingFound')}</li>}
          </ul>
          <p className="border-t px-4 py-2 text-[13px] text-muted-foreground max-sm:hidden">{t('palette.keys')}</p>
        </DialogContent>
      </Dialog>
      <FileDialog file={opened} onClose={() => setOpened(null)} />
    </>
  )
}
