import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArchiveIcon,
  ArrowDownWideNarrowIcon,
  ArrowUpNarrowWideIcon,
  CopyIcon,
  DownloadIcon,
  FolderIcon,
  FolderPlusIcon,
  FolderUpIcon,
  LayoutGridIcon,
  LinkIcon,
  ListIcon,
  LockIcon,
  MoreHorizontalIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from 'lucide-react'
import { type DragEvent, type FormEvent, type MouseEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Confirm } from '@/components/confirm'
import { FileDialog } from '@/components/file-dialog'
import { FolderUploads, IoBanner } from '@/components/folder-uploads'
import { StorageIcon } from '@/components/fx'
import { Thumb } from '@/components/thumb'
import { useFeature } from '@/lib/features'
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { UploadDialog, UrlUploadDialog } from '@/components/upload-dialog'
import { useAction } from '@/hooks/use-action'
import { useStorages } from '@/hooks/use-storages'
import { api, errorMessage } from '@/lib/api'
import { absoluteUrl, copy } from '@/lib/clipboard'
import { FOLDER_ACTION, type FolderAction, isTyping } from '@/lib/commands'
import { fromFiles, type Picked, readEntries } from '@/lib/dir-upload'
import { nextSort, parseSort, selectRange, SORT_LABELS, type Sort, type SortKey, typeLabel, viewEntries } from '@/lib/files'
import { crumbs, downloadUrl, filesCount, formatBytes, formatDate, joinPath, parentPath, storageIdOf } from '@/lib/format'
import { load, save } from '@/lib/prefs'
import { markRead } from '@/lib/reads'
import { storageName } from '@/lib/names'
import { trackTask } from '@/lib/tasks'
import { archiveError, selectionPayload } from '@/lib/archive'
import type { ArchiveFormat, Folder, FolderDeleteResponse, FolderListing, Task, TFile } from '@/lib/types'
import { cn } from '@/lib/utils'

const ARCHIVE_FORMATS: ArchiveFormat[] = ['zip', '7z', 'tar.gz', 'tar.bz2', 'tar.xz']
const ARCHIVE_STARTED = 'Архив собирается — когда будет готов, появится кнопка «Скачать»'

const link = (path: string) => `/files?path=${encodeURIComponent(path)}`
const folderKey = (path: string) => `d:${path}`
const fileKey = (uuid: string) => `f:${uuid}`
const directory = { webkitdirectory: '' } as Record<string, string>

function ArchiveMenu({ onArchive, label = 'Скачать папку архивом', children }: { onArchive: (format: ArchiveFormat) => void; label?: string; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
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

function FileMenu({ file, onOpen, onDelete }: { file: TFile; onOpen: () => void; onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Действия с «${file.name}»`}>
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <Confirm title={`Удалить «${file.name}»?`} open={confirm} onOpenChange={setConfirm} onConfirm={onDelete}>
        <span hidden />
      </Confirm>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild className="sm:hidden">
          <a href={downloadUrl(file)} download={file.name} onClick={() => markRead(file.path)}>
            <DownloadIcon /> Скачать
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => copy(file.path, 'путь')}>
          <CopyIcon /> Копировать путь
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => copy(absoluteUrl(downloadUrl(file)), 'ссылка на скачивание')}>
          <LinkIcon /> Копировать ссылку
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onOpen}>Свойства</DropdownMenuItem>
        <DropdownMenuSeparator className="sm:hidden" />
        <DropdownMenuItem variant="destructive" className="sm:hidden" onSelect={() => setConfirm(true)}>
          <Trash2Icon /> Удалить…
        </DropdownMenuItem>
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
  const [sort, setSort] = useState<Sort>(() => parseSort(load('sort')))
  const [view, setView] = useState<'list' | 'grid'>(() => (load('view') === 'grid' ? 'grid' : 'list'))
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const anchor = useRef<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const dirInput = useRef<HTMLInputElement>(null)

  const eggs = useFeature('eggs')
  const storageId = storageIdOf(path)
  const storage = storages.data?.find((s) => s.id === storageId)
  const isRoot = path.split('/').length <= 2
  const entries = viewEntries(listing.data?.folders ?? [], listing.data?.files ?? [], '', sort)
  const order = entries.map((e) => (e.type === 'folder' ? folderKey(e.item.path) : fileKey(e.item.uuid)))
  const picked = order.filter((key) => selected.has(key))
  const empty = !!listing.data && listing.data.folders.length + listing.data.files.length === 0

  const archive = useAction(
    ({ target, format }: { target: string; format: ArchiveFormat }) => api.post<Task>('/folders/archive', undefined, { path: target, format }),
    { success: ARCHIVE_STARTED, onSuccess: (task) => trackTask(task.id), describe: archiveError },
  )
  const archiveSelection = useAction((format: ArchiveFormat) => api.post<Task>('/folders/archive/selection', selectionPayload(picked, format)), {
    success: ARCHIVE_STARTED,
    onSuccess: (task) => {
      trackTask(task.id)
      setSelected(new Set())
    },
    describe: archiveError,
  })
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

  const handler = useRef<(action: FolderAction) => void>(() => undefined)
  const keys = useRef<(event: KeyboardEvent) => void>(() => undefined)
  useEffect(() => {
    handler.current = (action) => {
      if (action === 'upload') input.current?.click()
      if (action === 'upload-folder') dirInput.current?.click()
      if (action === 'url') setUrlOpen(true)
      if (action === 'new-folder') setFolderOpen(true)
      if (action === 'archive') archive.mutate({ target: path, format: 'zip' })
    }
    keys.current = (event) => {
      if (document.querySelector('[role=dialog],[role=alertdialog],[role=menu]')) return
      if (isTyping(event.target)) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
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

  function changeSort(next: Sort) {
    setSort(next)
    save('sort', JSON.stringify(next))
  }

  const head = (key: SortKey, className?: string) => (
    <TableHead className={className} aria-sort={sort.key === key ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
      <button type="button" className="fx-sort" onClick={() => changeSort(nextSort(sort, key))}>
        {SORT_LABELS[key]}
        <span aria-hidden className={sort.key === key ? '' : 'invisible'}>
          {sort.desc ? '▼' : '▲'}
        </span>
      </button>
    </TableHead>
  )

  function changeView(next: 'list' | 'grid') {
    setView(next)
    save('view', next)
  }

  const fileButtons = (file: TFile) => (
    <>
      <Button variant="ghost" size="icon-sm" className="max-sm:hidden" asChild>
        <a href={downloadUrl(file)} download={file.name} aria-label={`Скачать «${file.name}»`} onClick={() => markRead(file.path)}>
          <DownloadIcon />
        </a>
      </Button>
      <Button variant="ghost" size="icon-sm" className="max-sm:hidden" aria-label="Копировать ссылку" onClick={() => copy(absoluteUrl(downloadUrl(file)), 'ссылка на скачивание')}>
        <LinkIcon />
      </Button>
      <FileMenu file={file} onOpen={() => setOpened(file)} onDelete={() => removeFile.mutate(file)} />
      <Confirm title={`Удалить «${file.name}»?`} onConfirm={() => removeFile.mutate(file)}>
        <Button variant="ghost" size="icon-sm" className="max-sm:hidden" aria-label={`Удалить «${file.name}»`}>
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

  const folderRow = (folder: Folder) => (
                <TableRow key={folder.id} data-state={selected.has(folderKey(folder.path)) ? 'selected' : undefined}>
                  <TableCell>{check(folderKey(folder.path), folder.name)}</TableCell>
                  <TableCell className="max-w-0">
                    <Link to={link(folder.path)} className="flex items-center gap-2 text-base font-medium hover:underline" title={folder.name}>
                      <span className="fx-mini">
                        <FolderIcon className="size-4 text-primary" />
                      </span>
                      <span className="truncate">{folder.name}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground xl:table-cell">папка</TableCell>
                  <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
                    {formatBytes(folder.size)}
                    <span className="block text-xs">{filesCount(folder.files)}</span>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(folder.updated_at)}</TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">{formatDate(folder.created_at)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{folderButtons(folder)}</TableCell>
                </TableRow>
  )

  const fileRow = (file: TFile) => {
                return (
                  <TableRow key={file.uuid} data-state={selected.has(fileKey(file.uuid)) ? 'selected' : undefined}>
                    <TableCell>{check(fileKey(file.uuid), file.name)}</TableCell>
                    <TableCell className="max-w-0">
                      <button type="button" onClick={() => setOpened(file)} className="flex w-full items-center gap-2 text-left text-base hover:underline" title={file.name}>
                        <span className="fx-mini">
                          <Thumb file={file} iconClassName="size-4" />
                        </span>
                        <span className="truncate">{file.name}</span>
                        {file.encrypted && <LockIcon className="size-3 shrink-0 text-muted-foreground" aria-label="зашифрован" />}
                      </button>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground uppercase xl:table-cell">{typeLabel({ type: 'file', item: file })}</TableCell>
                    <TableCell className="hidden text-right text-muted-foreground sm:table-cell">{formatBytes(file.size)}</TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(file.updated_at)}</TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{formatDate(file.created_at)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{fileButtons(file)}</TableCell>
                  </TableRow>
                )
  }

  const folderTile = (folder: Folder) => (
            <li key={folder.id} className={cn('fx-panel flex gap-3 p-3 transition-colors hover:border-foreground/30', selected.has(folderKey(folder.path)) && 'border-ink')}>
              <div className="relative">
                <span className="fx-thumb">
                  <FolderIcon className="size-6 text-primary" />
                </span>
                <div className="absolute top-1 left-1">{check(folderKey(folder.path), folder.name)}</div>
              </div>
              <div className="grid min-w-0 flex-1 content-between gap-1">
                <Link to={link(folder.path)} className="truncate text-base font-medium hover:underline pointer-coarse:py-2.5" title={folder.name}>
                  {folder.name}
                </Link>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatBytes(folder.size)} · {filesCount(folder.files)}
                </span>
                <div className="flex items-center justify-between gap-2">
                  <Link to={link(folder.path)} className="fx-more" tabIndex={-1} aria-hidden>
                    Открыть
                  </Link>
                  <div className="-mr-1 flex">{folderButtons(folder)}</div>
                </div>
              </div>
            </li>
  )

  const fileTile = (file: TFile) => {
            return (
              <li key={file.uuid} className={cn('fx-panel flex gap-3 p-3 transition-colors hover:border-foreground/30', selected.has(fileKey(file.uuid)) && 'border-ink')}>
                <div className="relative">
                  <span className="fx-thumb">
                    <Thumb file={file} iconClassName="size-6" />
                  </span>
                  <div className="absolute top-1 left-1">{check(fileKey(file.uuid), file.name)}</div>
                </div>
                <div className="grid min-w-0 flex-1 content-between gap-1">
                  <button type="button" onClick={() => setOpened(file)} className="flex min-w-0 items-center gap-1.5 text-left text-base font-medium hover:underline pointer-coarse:py-2.5" title={file.name}>
                    <span className="truncate">{file.name}</span>
                    {file.encrypted && <LockIcon className="size-3 shrink-0 text-muted-foreground" aria-label="зашифрован" />}
                  </button>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatBytes(file.size)} · {formatDate(file.updated_at)}
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <button type="button" onClick={() => setOpened(file)} className="fx-more" tabIndex={-1} aria-hidden>
                      Подробнее
                    </button>
                    <div className="-mr-1 flex">{fileButtons(file)}</div>
                  </div>
                </div>
              </li>
            )
  }

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
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-background/60 font-semibold text-primary backdrop-blur-md">
          Отпустите, чтобы загрузить файлы или папки
        </div>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Crumbs path={path} name={storageName(storage)} />
        {listing.data && (
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatBytes(listing.data.size)} · {filesCount(listing.data.total_files)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => input.current?.click()}>
          <UploadIcon /> Загрузить
        </Button>
        <Button variant="outline" onClick={() => dirInput.current?.click()}>
          <FolderUpIcon /> <span className="max-sm:sr-only">Загрузить папку</span>
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
          <LinkIcon /> <span className="max-sm:sr-only">По ссылке</span>
        </Button>
        <Button variant="outline" onClick={() => setFolderOpen(true)}>
          <FolderPlusIcon /> <span className="max-sm:sr-only">Новая папка</span>
        </Button>
        <ArchiveMenu onArchive={(format) => archive.mutate({ target: path, format })}>
          <Button variant="outline" disabled={archive.isPending}>
            <ArchiveIcon /> <span className="max-sm:sr-only">Скачать папку</span>
          </Button>
        </ArchiveMenu>
        {!isRoot && (
          <Confirm
            title="Удалить папку со всем содержимым?"
            description="Файлы будут удалены из Telegram и базы."
            onConfirm={() => removeFolder.mutate(path)}
          >
            <Button variant="destructive">
              <Trash2Icon /> <span className="max-sm:sr-only">Удалить папку</span>
            </Button>
          </Confirm>
        )}
      </div>

      <IoBanner path={path} />
      <FolderUploads path={path} />

      {!empty && listing.data && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" aria-label={`Сортировка: ${SORT_LABELS[sort.key]}, ${sort.desc ? 'по убыванию' : 'по возрастанию'}`}>
                {sort.desc ? <ArrowDownWideNarrowIcon /> : <ArrowUpNarrowWideIcon />}
                <span className="max-sm:sr-only">
                  {SORT_LABELS[sort.key]} {sort.desc ? '▼' : '▲'}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuLabel>Сортировка</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={sort.key} onValueChange={(key) => changeSort({ ...sort, key: key as SortKey })}>
                {Object.entries(SORT_LABELS).map(([key, label]) => (
                  <DropdownMenuRadioItem key={key} value={key}>
                    {label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={sort.desc ? 'desc' : 'asc'} onValueChange={(v) => changeSort({ ...sort, desc: v === 'desc' })}>
                <DropdownMenuRadioItem value="asc">По возрастанию ▲</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="desc">По убыванию ▼</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={sort.foldersFirst} onCheckedChange={(v) => changeSort({ ...sort, foldersFirst: v === true })}>
                Папки сверху
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
        <div role="toolbar" aria-label="Выбранные" className="fx-glass sticky top-20 z-10 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs md:top-3">
          <span className="px-1 font-semibold text-primary tabular-nums">Выбрано: {picked.length}</span>
          <ArchiveMenu label="Скачать выбранное одним архивом" onArchive={(format) => archiveSelection.mutate(format)}>
            <Button size="sm" variant="outline" disabled={archiveSelection.isPending}>
              <ArchiveIcon /> Скачать архивом
            </Button>
          </ArchiveMenu>
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
          {eggs ? <StorageIcon scale={3} /> : <UploadIcon className="size-8 text-primary" />}
          <p className="fx-pixel text-[20px] uppercase">Папка пуста</p>
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
                {head('name')}
                {head('type', 'hidden w-24 xl:table-cell')}
                {head('size', 'hidden w-28 sm:table-cell')}
                {head('updated', 'hidden w-44 md:table-cell')}
                {head('created', 'hidden w-44 lg:table-cell')}
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (entry.type === 'folder' ? folderRow(entry.item) : fileRow(entry.item)))}
            </TableBody>
          </Table>
        </div>
      )}
      {!empty && order.length > 0 && view === 'grid' && (
        <ul className="fx-stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {entries.map((entry) => (entry.type === 'folder' ? folderTile(entry.item) : fileTile(entry.item)))}
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
