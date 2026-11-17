import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArchiveIcon,
  ArrowDownWideNarrowIcon,
  ArrowUpNarrowWideIcon,
  CopyIcon,
  DownloadIcon,
  FileIcon,
  FileTextIcon,
  FilmIcon,
  FolderIcon,
  FolderPlusIcon,
  FolderUpIcon,
  ImageIcon,
  LayoutGridIcon,
  LinkIcon,
  ListIcon,
  LockIcon,
  MoreHorizontalIcon,
  MusicIcon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from 'lucide-react'
import { type DragEvent, type FormEvent, type MouseEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Confirm } from '@/components/confirm'
import { FileDialog } from '@/components/file-dialog'
import { FolderUploads } from '@/components/folder-uploads'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { UploadDialog, UrlUploadDialog } from '@/components/upload-dialog'
import { useAction } from '@/hooks/use-action'
import { useStorages } from '@/hooks/use-storages'
import { api, errorMessage } from '@/lib/api'
import { absoluteUrl, copy } from '@/lib/clipboard'
import { FOLDER_ACTION, type FolderAction, isTyping } from '@/lib/commands'
import { fromFiles, type Picked, readEntries } from '@/lib/dir-upload'
import { selectRange, SORT_LABELS, type Sort, type SortKey, viewFiles, viewFolders } from '@/lib/files'
import { crumbs, downloadUrl, formatBytes, formatDate, joinPath, parentPath, storageIdOf } from '@/lib/format'
import { load, save } from '@/lib/prefs'
import { trackTask } from '@/lib/tasks'
import type { ArchiveFormat, FolderDeleteResponse, FolderListing, Task, TFile } from '@/lib/types'
import { cn } from '@/lib/utils'

const KIND_ICONS = { photo: ImageIcon, video: FilmIcon, audio: MusicIcon, animation: FilmIcon, document: FileTextIcon }
const ARCHIVE_FORMATS: ArchiveFormat[] = ['zip', '7z', 'tar.gz', 'tar.bz2', 'tar.xz']

const link = (path: string) => `/files?path=${encodeURIComponent(path)}`
const folderKey = (path: string) => `d:${path}`
const fileKey = (uuid: string) => `f:${uuid}`
const directory = { webkitdirectory: '' } as Record<string, string>

function ArchiveMenu({ onArchive, children }: { onArchive: (format: ArchiveFormat) => void; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Скачать папку архивом</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onArchive('zip')}>
          <ArchiveIcon /> zip
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Другой формат</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {ARCHIVE_FORMATS.slice(1).map((format) => (
              <DropdownMenuItem key={format} onSelect={() => onArchive(format)}>
                {format}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function FileMenu({ file, onOpen }: { file: TFile; onOpen: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Действия с «${file.name}»`}>
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => copy(file.path, 'путь')}>
          <CopyIcon /> Копировать путь
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => copy(absoluteUrl(downloadUrl(file)), 'ссылка на скачивание')}>
          <LinkIcon /> Копировать ссылку
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onOpen}>Свойства</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Crumbs({ path, name }: { path: string; name: string }) {
  const storageId = storageIdOf(path)
  const isRoot = path.split('/').length <= 2
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/files">Хранилища</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          {isRoot ? (
            <BreadcrumbPage>{name}</BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <Link to={link(`tcloud/${storageId}`)}>{name}</Link>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        {crumbs(path).map((crumb, i, all) => (
          <span key={crumb.path} className="contents">
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {i === all.length - 1 ? (
                <BreadcrumbPage>{crumb.name}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link to={link(crumb.path)}>{crumb.name}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </span>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export function FolderView({ path }: { path: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const storages = useStorages()
  const listing = useQuery({ queryKey: ['folder', path], queryFn: () => api.get<FolderListing>('/folders', { path }) })
  const [opened, setOpened] = useState<TFile | null>(null)
  const [files, setFiles] = useState<Picked[]>([])
  const [urlOpen, setUrlOpen] = useState(false)
  const [folderOpen, setFolderOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>({ key: 'name', desc: false })
  const [view, setView] = useState<'list' | 'grid'>(() => (load('view') === 'grid' ? 'grid' : 'list'))
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const anchor = useRef<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const dirInput = useRef<HTMLInputElement>(null)
  const search = useRef<HTMLInputElement>(null)

  const storageId = storageIdOf(path)
  const storage = storages.data?.find((s) => s.id === storageId)
  const isRoot = path.split('/').length <= 2
  const folders = viewFolders(listing.data?.folders ?? [], query, sort)
  const shownFiles = viewFiles(listing.data?.files ?? [], query, sort)
  const order = [...folders.map((f) => folderKey(f.path)), ...shownFiles.map((f) => fileKey(f.uuid))]
  const picked = order.filter((key) => selected.has(key))
  const empty = !!listing.data && listing.data.folders.length + listing.data.files.length === 0

  useEffect(() => {
    if (listing.isSuccess) save('last-folder', path)
  }, [listing.isSuccess, path])

  const archive = useAction(
    ({ target, format }: { target: string; format: ArchiveFormat }) => api.post<Task>('/folders/archive', undefined, { path: target, format }),
    { success: 'Архив собирается — когда будет готов, появится кнопка «Скачать»', onSuccess: (task) => trackTask(task.id) },
  )
  const removeFolder = useAction((target: string) => api.del<FolderDeleteResponse>('/folders', { path: target }), {
    invalidate: [['folder']],
    onSuccess: (result) => {
      toast.success(`Удалено файлов: ${result.deleted_files}`)
      if (result.path === path) navigate(link(parentPath(path)))
    },
  })
  const removeFile = useAction((file: TFile) => api.del(`/files/${file.uuid}`), {
    invalidate: [['folder'], ['storages']],
    success: 'Файл удалён',
  })

  function choose(list: Picked[]) {
    if (list.length) setFiles(list)
    else toast.info('Файлов не найдено: пустые папки не загружаются')
  }

  function toggle(key: string, event: MouseEvent) {
    setSelected(selectRange(order, selected, anchor.current, key, event.shiftKey))
    anchor.current = key
  }

  async function bulkDelete() {
    let failed = 0
    for (const key of picked) {
      const target = key.slice(2)
      try {
        if (key.startsWith('d:')) await api.del('/folders', { path: target })
        else await api.del(`/files/${target}`)
      } catch (e) {
        failed++
        toast.error(errorMessage(e))
      }
    }
    setSelected(new Set())
    queryClient.invalidateQueries({ queryKey: ['folder'] })
    queryClient.invalidateQueries({ queryKey: ['storages'] })
    toast.success(`Удалено: ${picked.length - failed}`)
  }

  async function bulkDownload() {
    const chosen = shownFiles.filter((f) => selected.has(fileKey(f.uuid)))
    const dirs = folders.filter((f) => selected.has(folderKey(f.path)))
    dirs.forEach((folder) => archive.mutate({ target: folder.path, format: 'zip' }))
    if (chosen.length > 1) toast.info(`Скачивание файлов: ${chosen.length}. Браузер может спросить разрешение на несколько загрузок`)
    for (const file of chosen) {
      const a = document.createElement('a')
      a.href = downloadUrl(file)
      a.download = file.name
      a.click()
      await new Promise((resolve) => setTimeout(resolve, 400))
    }
  }

  const handler = useRef<(action: FolderAction) => void>(() => undefined)
  const keys = useRef<(event: KeyboardEvent) => void>(() => undefined)
  useEffect(() => {
    handler.current = (action) => {
      if (action === 'upload') input.current?.click()
      if (action === 'upload-folder') dirInput.current?.click()
      if (action === 'url') setUrlOpen(true)
      if (action === 'new-folder') setFolderOpen(true)
      if (action === 'archive') archive.mutate({ target: path, format: 'zip' })
      if (action === 'search') search.current?.focus()
    }
    keys.current = (event) => {
      if (document.querySelector('[role=dialog],[role=alertdialog],[role=menu]')) return
      if (event.key === 'Escape' && document.activeElement === search.current) {
        setQuery('')
        search.current?.blur()
        return
      }
      if (isTyping(event.target)) return
      if (event.key === '/') {
        event.preventDefault()
        search.current?.focus()
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        setSelected(new Set(order))
      } else if (event.key === 'Escape' && selected.size) {
        setSelected(new Set())
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && picked.length) {
        event.preventDefault()
        setConfirmBulk(true)
      }
    }
  })

  useEffect(() => {
    const onAction = (event: Event) => handler.current((event as CustomEvent<FolderAction>).detail)
    const onKey = (event: KeyboardEvent) => keys.current(event)
    const onPaste = (event: ClipboardEvent) => {
      if (isTyping(event.target) || document.querySelector('[role=dialog]')) return
      const pasted = [...(event.clipboardData?.files ?? [])]
      if (pasted.length) {
        event.preventDefault()
        setFiles(fromFiles(pasted))
      }
    }
    window.addEventListener(FOLDER_ACTION, onAction)
    window.addEventListener('keydown', onKey)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener(FOLDER_ACTION, onAction)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('paste', onPaste)
    }
  }, [])

  async function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    const entries = [...event.dataTransfer.items].map((item) => item.webkitGetAsEntry?.()).filter((e): e is FileSystemEntry => !!e)
    const dropped = [...event.dataTransfer.files]
    if (!entries.length) {
      if (dropped.length) setFiles(fromFiles(dropped))
      return
    }
    try {
      choose(await readEntries(entries))
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  function changeView(next: 'list' | 'grid') {
    setView(next)
    save('view', next)
  }

  const fileButtons = (file: TFile) => (
    <>
      <Button variant="ghost" size="icon-sm" asChild>
        <a href={downloadUrl(file)} download={file.name} aria-label={`Скачать «${file.name}»`}>
          <DownloadIcon />
        </a>
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Копировать ссылку" onClick={() => copy(absoluteUrl(downloadUrl(file)), 'ссылка на скачивание')}>
        <LinkIcon />
      </Button>
      <FileMenu file={file} onOpen={() => setOpened(file)} />
      <Confirm title={`Удалить «${file.name}»?`} onConfirm={() => removeFile.mutate(file)}>
        <Button variant="ghost" size="icon-sm" aria-label={`Удалить «${file.name}»`}>
          <Trash2Icon />
        </Button>
      </Confirm>
    </>
  )

  const folderButtons = (folder: { name: string; path: string }) => (
    <>
      <ArchiveMenu onArchive={(format) => archive.mutate({ target: folder.path, format })}>
        <Button variant="ghost" size="icon-sm" aria-label={`Скачать папку «${folder.name}»`}>
          <DownloadIcon />
        </Button>
      </ArchiveMenu>
      <Confirm
        title={`Удалить папку «${folder.name}»?`}
        description="Всё содержимое будет удалено из Telegram и базы."
        onConfirm={() => removeFolder.mutate(folder.path)}
      >
        <Button variant="ghost" size="icon-sm" aria-label={`Удалить папку «${folder.name}»`}>
          <Trash2Icon />
        </Button>
      </Confirm>
    </>
  )

  const check = (key: string, label: string) => (
    <Checkbox
      checked={selected.has(key)}
      aria-label={`Выбрать «${label}»`}
      onClick={(e) => {
        e.preventDefault()
        toggle(key, e)
      }}
    />
  )

  return (
    <div
      className="relative grid gap-4"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => e.currentTarget.contains(e.relatedTarget as Node) || setDragging(false)}
      onDrop={onDrop}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-background/60 font-semibold text-primary backdrop-blur-md">
          Отпустите, чтобы загрузить файлы или папки
        </div>
      )}
      <Crumbs path={path} name={storage?.name ?? storageId} />

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => input.current?.click()}>
          <UploadIcon /> Загрузить
        </Button>
        <Button variant="outline" onClick={() => dirInput.current?.click()}>
          <FolderUpIcon /> Загрузить папку
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            setFiles(fromFiles(e.target.files ?? []))
            e.target.value = ''
          }}
        />
        <input
          ref={dirInput}
          type="file"
          multiple
          hidden
          {...directory}
          onChange={(e) => {
            choose(fromFiles(e.target.files ?? []))
            e.target.value = ''
          }}
        />
        <Button variant="outline" onClick={() => setUrlOpen(true)}>
          <LinkIcon /> По ссылке
        </Button>
        <Button variant="outline" onClick={() => setFolderOpen(true)}>
          <FolderPlusIcon /> Папка
        </Button>
        <ArchiveMenu onArchive={(format) => archive.mutate({ target: path, format })}>
          <Button variant="outline" disabled={archive.isPending}>
            <ArchiveIcon /> Скачать папку
          </Button>
        </ArchiveMenu>
        {!isRoot && (
          <Confirm
            title="Удалить папку со всем содержимым?"
            description="Файлы будут удалены из Telegram и базы."
            onConfirm={() => removeFolder.mutate(path)}
          >
            <Button variant="destructive">
              <Trash2Icon /> Удалить папку
            </Button>
          </Confirm>
        )}
      </div>

      <FolderUploads path={path} />

      {!empty && listing.data && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Фильтр по имени — нажмите /"
              aria-label="Фильтр по имени"
              className="pl-8"
            />
          </div>
          <Select value={sort.key} onValueChange={(key) => setSort({ ...sort, key: key as SortKey })}>
            <SelectTrigger className="w-32" aria-label="Сортировка">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SORT_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSort({ ...sort, desc: !sort.desc })}
            aria-label={sort.desc ? 'По убыванию' : 'По возрастанию'}
          >
            {sort.desc ? <ArrowDownWideNarrowIcon /> : <ArrowUpNarrowWideIcon />}
          </Button>
          <div role="group" aria-label="Вид" className="flex">
            <Button variant={view === 'list' ? 'default' : 'outline'} size="icon" onClick={() => changeView('list')} aria-label="Список" aria-pressed={view === 'list'}>
              <ListIcon />
            </Button>
            <Button variant={view === 'grid' ? 'default' : 'outline'} size="icon" onClick={() => changeView('grid')} aria-label="Плитка" aria-pressed={view === 'grid'}>
              <LayoutGridIcon />
            </Button>
          </div>
        </div>
      )}

      {picked.length > 0 && (
        <div role="toolbar" aria-label="Выбранные" className="fx-glass sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-full px-3 py-2 text-xs md:top-3">
          <span className="px-1 font-semibold text-primary tabular-nums">Выбрано: {picked.length}</span>
          <Button size="sm" variant="outline" onClick={bulkDownload}>
            <DownloadIcon /> Скачать
          </Button>
          <Confirm
            title={`Удалить выбранное (${picked.length})?`}
            description="Файлы и папки со всем содержимым будут удалены из Telegram и базы."
            open={confirmBulk}
            onOpenChange={setConfirmBulk}
            onConfirm={bulkDelete}
          >
            <Button size="sm" variant="destructive">
              <Trash2Icon /> Удалить
            </Button>
          </Confirm>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
            <XIcon /> Снять выбор
          </Button>
        </div>
      )}

      {listing.isPending && <p className="text-sm text-muted-foreground">Загрузка…</p>}
      {listing.error && <p className="text-destructive">{listing.error.message}</p>}
      {empty && (
        <div className="fx-panel grid justify-items-center gap-3 p-10 text-center">
          <UploadIcon className="size-8 text-primary drop-shadow-[0_0_8px_var(--violet)]" />
          <p className="text-lg font-bold">Папка пуста</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Перетащите сюда файлы или целые папки, вставьте файл из буфера (Ctrl+V) или выберите на устройстве.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => input.current?.click()}>
              <UploadIcon /> Загрузить файлы
            </Button>
            <Button variant="outline" onClick={() => dirInput.current?.click()}>
              <FolderUpIcon /> Загрузить папку
            </Button>
          </div>
        </div>
      )}
      {!empty && listing.data && order.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">Ничего не найдено по «{query}»</p>
      )}
      {!empty && order.length > 0 && view === 'list' && (
        <div className="fx-panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox
                    checked={picked.length === order.length ? true : picked.length ? 'indeterminate' : false}
                    onCheckedChange={(v) => setSelected(v === true ? new Set(order) : new Set())}
                    aria-label="Выбрать все"
                  />
                </TableHead>
                <TableHead>Имя</TableHead>
                <TableHead className="hidden w-28 text-right sm:table-cell">Размер</TableHead>
                <TableHead className="hidden w-44 md:table-cell">Изменён</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {folders.map((folder) => (
                <TableRow key={folder.id} data-state={selected.has(folderKey(folder.path)) ? 'selected' : undefined}>
                  <TableCell>{check(folderKey(folder.path), folder.name)}</TableCell>
                  <TableCell className="max-w-0">
                    <Link to={link(folder.path)} className="flex items-center gap-2 font-medium hover:underline">
                      <FolderIcon className="size-4 shrink-0 text-primary" />
                      <span className="truncate">{folder.name}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground sm:table-cell">—</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(folder.updated_at)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{folderButtons(folder)}</TableCell>
                </TableRow>
              ))}
              {shownFiles.map((file) => {
                const Icon = KIND_ICONS[file.kind] ?? FileIcon
                return (
                  <TableRow key={file.uuid} data-state={selected.has(fileKey(file.uuid)) ? 'selected' : undefined}>
                    <TableCell>{check(fileKey(file.uuid), file.name)}</TableCell>
                    <TableCell className="max-w-0">
                      <button type="button" onClick={() => setOpened(file)} className="flex w-full items-center gap-2 text-left hover:underline">
                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{file.name}</span>
                        {file.encrypted && <LockIcon className="size-3 shrink-0 text-muted-foreground" aria-label="зашифрован" />}
                      </button>
                    </TableCell>
                    <TableCell className="hidden text-right text-muted-foreground sm:table-cell">{formatBytes(file.size)}</TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(file.updated_at)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{fileButtons(file)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {!empty && order.length > 0 && view === 'grid' && (
        <ul className="fx-stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {folders.map((folder) => (
            <li key={folder.id} className={cn('fx-panel grid gap-2 p-3 transition-shadow hover:shadow-[var(--glow)]', selected.has(folderKey(folder.path)) && 'shadow-[var(--glow)]!')}>
              <div className="absolute top-2 left-2">{check(folderKey(folder.path), folder.name)}</div>
              <Link to={link(folder.path)} className="grid justify-items-center gap-2 pt-3 text-center hover:underline">
                <FolderIcon className="size-10 text-primary" />
                <span className="w-full truncate text-sm font-medium">{folder.name}</span>
              </Link>
              <div className="flex justify-center">{folderButtons(folder)}</div>
            </li>
          ))}
          {shownFiles.map((file) => {
            const Icon = KIND_ICONS[file.kind] ?? FileIcon
            return (
              <li key={file.uuid} className={cn('fx-panel grid gap-2 p-3 transition-shadow hover:shadow-[var(--glow)]', selected.has(fileKey(file.uuid)) && 'shadow-[var(--glow)]!')}>
                <div className="absolute top-2 left-2">{check(fileKey(file.uuid), file.name)}</div>
                {file.encrypted && <LockIcon className="absolute top-2 right-2 size-3 text-muted-foreground" aria-label="зашифрован" />}
                <button type="button" onClick={() => setOpened(file)} className="grid justify-items-center gap-2 pt-3 text-center hover:underline">
                  <Icon className="size-10 text-muted-foreground" />
                  <span className="w-full truncate text-sm">{file.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{formatBytes(file.size)}</span>
                </button>
                <div className="flex justify-center">{fileButtons(file)}</div>
              </li>
            )
          })}
        </ul>
      )}

      <FileDialog file={opened} onClose={() => setOpened(null)} />
      <UploadDialog folder={path} files={files} onClose={() => setFiles([])} />
      <UrlUploadDialog folder={path} open={urlOpen} onOpenChange={setUrlOpen} />
      <NewFolderDialog parent={path} open={folderOpen} onOpenChange={setFolderOpen} />
    </div>
  )
}

function NewFolderDialog({ parent, open, onOpenChange }: { parent: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = useState('')
  const create = useAction(() => api.post('/folders', { path: joinPath(parent, name) }), {
    invalidate: [['folder', parent]],
    success: 'Папка создана',
    onSuccess: () => {
      setName('')
      onOpenChange(false)
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    create.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новая папка</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя или путь: a/b/c" autoFocus required />
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              Создать
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
