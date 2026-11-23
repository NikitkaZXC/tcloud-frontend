import { keepPreviousData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
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
import { type DragEvent, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
import { useMedia } from '@/hooks/use-media'
import { cn } from '@/lib/utils'
import { useStorages } from '@/hooks/use-storages'
import { api, showError } from '@/lib/api'
import { absoluteUrl, copy } from '@/lib/clipboard'
import { FOLDER_ACTION, type FolderAction, isTyping } from '@/lib/commands'
import { fromFiles, type Picked, readEntries } from '@/lib/dir-upload'
import { listingEntries, listingKey, listingParams, nextSort, PAGE_SIZE, selectRange, SORT_LABELS, type Sort, type SortKey, typeLabel } from '@/lib/files'
import { crumbs, downloadUrl, filesCount, formatBytes, formatDate, formatShortDate, joinPath, parentPath, storageIdOf } from '@/lib/format'
import { settingsError, sortOf, sortPatch, updateSettings, useSettings } from '@/lib/settings'
import { clampWidth, type Column, type ColumnWidths, COLUMN_STEP, COLUMN_STEP_BIG, COLUMNS, DEFAULT_WIDTHS, fitColumns, fitWidth, MAX_WIDTH, minWidth, parseColumns, tableMinWidth } from '@/lib/columns'
import { load, save } from '@/lib/prefs'
import { markRead } from '@/lib/reads'
import { fileName, storageName } from '@/lib/names'
import { trackTask } from '@/lib/tasks'
import { archiveError, archiveName, selectionPayload } from '@/lib/archive'
import type { ArchiveFormat, Folder, FolderDeleteResponse, FolderListing, Task, TFile } from '@/lib/types'
import { getLang, t } from '@/lib/i18n'

const ARCHIVE_FORMATS: ArchiveFormat[] = ['zip', '7z', 'tar.gz', 'tar.bz2', 'tar.xz']
const DELETED = [['folder'], ['storages'], ['account'], ['activity'], ['search'], ['mimes']]

const link = (path: string) => `/files?path=${encodeURIComponent(path)}`
const folderKey = (path: string) => `d:${path}`
const fileKey = (uuid: string) => `f:${uuid}`
const directory = { webkitdirectory: '' } as Record<string, string>

function saveColumns(next: ColumnWidths) {
  save('file_columns', JSON.stringify(next))
  updateSettings({ interface: { file_columns: next } }).catch((error) => toast.error(settingsError(error)))
}

function contentWidths(cells: HTMLElement[], host: HTMLElement): number[] {
  const box = document.createElement('div')
  box.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;width:max-content'
  const clones = cells.map((cell) => {
    const clone = cell.cloneNode(true) as HTMLElement
    clone.style.width = ''
    const row = document.createElement('div')
    row.appendChild(clone)
    box.appendChild(row)
    return clone
  })
  host.appendChild(box)
  const widths = clones.map((clone) => clone.getBoundingClientRect().width)
  box.remove()
  return widths
}

function ArchiveMenu({ onArchive, label = t('folder.archiveFolder'), children }: { onArchive: (format: ArchiveFormat) => void; label?: string; children: ReactNode }) {
  const preferred = useSettings().archives.format
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onArchive(preferred)}>
          <ArchiveIcon /> {preferred}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{t('folder.otherFormat')}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {ARCHIVE_FORMATS.filter((format) => format !== preferred).map((format) => (
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

function FileMenu({ file, onOpen, onDelete, skip }: { file: TFile; onOpen: () => void; onDelete: () => void; skip: boolean }) {
  const [confirm, setConfirm] = useState(false)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t('folder.actionsWith', { name: file.name })}>
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <Confirm title={t('folder.deleteFileQ', { name: file.name })} open={confirm} onOpenChange={setConfirm} onConfirm={onDelete}>
        <span hidden />
      </Confirm>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild className="sm:hidden">
          <a href={downloadUrl(file)} download={file.name} onClick={() => markRead(file.path)}>
            <DownloadIcon /> {t('common.download')}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => copy(file.path, t('folder.copiedPath'))}>
          <CopyIcon /> {t('folder.copyPath')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => copy(absoluteUrl(downloadUrl(file)), t('folder.copiedLink'))}>
          <LinkIcon /> {t('folder.copyLink')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onOpen}>{t('folder.properties')}</DropdownMenuItem>
        <DropdownMenuSeparator className="sm:hidden" />
        <DropdownMenuItem variant="destructive" className="sm:hidden" onSelect={() => (skip ? onDelete() : setConfirm(true))}>
          <Trash2Icon /> {t('common.deleteEllipsis')}
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
            <Link to="/files">{t('nav.storages')}</Link>
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
  const [opened, setOpened] = useState<TFile | null>(null)
  const [files, setFiles] = useState<Picked[]>([])
  const [urlOpen, setUrlOpen] = useState(false)
  const [folderOpen, setFolderOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const settings = useSettings()
  const sort = sortOf(settings.interface)
  const listing = useInfiniteQuery({
    queryKey: listingKey(path, sort, getLang()),
    queryFn: ({ pageParam }) => api.get<FolderListing>('/folders', { path, ...listingParams(sort, getLang()), limit: PAGE_SIZE, cursor: pageParam || undefined }),
    initialPageParam: '',
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    placeholderData: keepPreviousData,
  })
  const head0 = listing.data?.pages[0]
  const total = head0 ? head0.total_folders + head0.direct_files : 0
  const view = settings.interface.folder_view
  const skipConfirm = !settings.interface.confirm_delete
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const anchor = useRef<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const dirInput = useRef<HTMLInputElement>(null)

  const eggs = useFeature('eggs')
  const storageId = storageIdOf(path)
  const storage = storages.data?.find((s) => s.id === storageId)
  const isRoot = path.split('/').length <= 2
  const entries = listingEntries(listing.data?.pages ?? [])
  const order = entries.map((e) => (e.type === 'folder' ? folderKey(e.item.path) : fileKey(e.item.uuid)))
  const picked = order.filter((key) => selected.has(key))
  const empty = !!head0 && head0.items.length === 0
  const storedColumns = settings.interface.file_columns ?? parseColumns(load('file_columns'))
  const [draftColumns, setDraftColumns] = useState<ColumnWidths | null>(null)
  const [autoName, setAutoName] = useState(0)
  const draftRef = useRef<ColumnWidths | null>(null)
  const saveTimer = useRef(0)
  const sm = useMedia('(width >= 40rem)')
  const columns = sm ? (draftColumns ?? storedColumns) : {}
  const actionsWidth = sm ? 128 : head0?.total_folders ? 72 : 44
  const panel = useRef<HTMLDivElement>(null)
  const [available, setAvailable] = useState(0)
  const shown = fitColumns(sm ? available : 0, {}, 32 + actionsWidth)
  const listed = !empty && order.length > 0 && view === 'list'
  useLayoutEffect(() => {
    const element = panel.current
    if (!element) return
    const name = element.querySelector('th[data-col=name]')
    const measure = () => {
      setAvailable(element.clientWidth)
      if (name) setAutoName(name.getBoundingClientRect().width)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    if (name) observer.observe(name)
    return () => observer.disconnect()
  }, [listed, sm])
  const tableWidth = tableMinWidth(columns, COLUMNS.filter((column) => shown[column]), 32 + actionsWidth)

  const archive = useAction(
    ({ target, format }: { target: string; format: ArchiveFormat }) => api.post<Task>('/folders/archive', undefined, { path: target, format, priority: settings.archives.priority }),
    { success: t('folder.archiveStarted'), onSuccess: (task) => trackTask(task.id), describe: archiveError },
  )
  const archiveSelection = useAction((format: ArchiveFormat) => api.post<Task>('/folders/archive/selection', selectionPayload(picked, format, settings.archives.priority, isRoot ? archiveName(storage?.name) : undefined)), {
    success: t('folder.archiveStarted'),
    onSuccess: (task) => {
      trackTask(task.id)
      setSelected(new Set())
    },
    describe: archiveError,
  })
  const removeFolder = useAction((target: string) => api.del<FolderDeleteResponse>('/folders', { path: target }), {
    invalidate: DELETED,
    onSuccess: (result) => {
      toast.success(t('folder.deletedFiles', { n: result.deleted_files }))
      if (result.path === path) navigate(link(parentPath(path)))
    },
  })
  const removeFile = useAction((file: TFile) => api.del(`/files/${file.uuid}`), {
    invalidate: DELETED,
    success: t('folder.fileDeleted'),
  })

  function choose(list: Picked[]) {
    if (list.length) setFiles(list)
    else toast.info(t('folder.noFiles'))
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
        showError(e)
      }
    }
    setSelected(new Set())
    DELETED.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }))
    toast.success(t('folder.deletedItems', { n: picked.length - failed }))
  }

  const handler = useRef<(action: FolderAction) => void>(() => undefined)
  const keys = useRef<(event: KeyboardEvent) => void>(() => undefined)
  useEffect(() => {
    handler.current = (action) => {
      if (action === 'upload') input.current?.click()
      if (action === 'upload-folder') dirInput.current?.click()
      if (action === 'url') setUrlOpen(true)
      if (action === 'new-folder') setFolderOpen(true)
      if (action === 'archive') archive.mutate({ target: path, format: settings.archives.format })
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
        if (skipConfirm && picked.length === 1) bulkDelete()
        else setConfirmBulk(true)
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
      showError(e)
    }
  }

  function changeSort(next: Sort) {
    updateSettings(sortPatch(next)).catch((e) => showError(e))
  }

  const head = (key: SortKey, className?: string) => {
    const width = key === 'name' ? columns.name : (columns[key] ?? DEFAULT_WIDTHS[key])
    return (
      <TableHead data-col={key} className={`relative ${className ?? ''}`} style={{ width }} aria-sort={sort.key === key ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
        <button type="button" className="fx-sort max-w-full overflow-hidden" onClick={() => changeSort(nextSort(sort, key))}>
          {t(SORT_LABELS[key])}
          <span aria-hidden className={sort.key === key ? '' : 'invisible'}>
            {sort.desc ? '▼' : '▲'}
          </span>
        </button>
        {sm && (
          <span
            role="separator"
            tabIndex={0}
            aria-orientation="vertical"
            aria-label={t('folder.resizeColumn', { name: t(SORT_LABELS[key]) })}
            aria-valuemin={minWidth(key)}
            aria-valuemax={MAX_WIDTH}
            aria-valuenow={Math.round(width ?? autoName)}
            className="fx-col-handle"
            onPointerDown={(e) => startResize(key, e)}
            onDoubleClick={(e) => autoFit(key, e.currentTarget)}
            onKeyDown={(e) => resizeByKey(key, e)}
          />
        )}
      </TableHead>
    )
  }

  useEffect(
    () => () => {
      window.clearTimeout(saveTimer.current)
      if (draftRef.current) saveColumns(draftRef.current)
    },
    [],
  )

  function resize(column: Column, width: number) {
    const next = { ...(draftRef.current ?? storedColumns), [column]: clampWidth(column, width) }
    draftRef.current = next
    setDraftColumns(next)
  }

  function persistColumns() {
    window.clearTimeout(saveTimer.current)
    const next = draftRef.current
    draftRef.current = null
    setDraftColumns(null)
    if (next) saveColumns(next)
  }

  function resetColumns() {
    window.clearTimeout(saveTimer.current)
    draftRef.current = null
    setDraftColumns(null)
    saveColumns({})
  }

  function startResize(column: Column, event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    const handle = event.currentTarget
    const startX = event.clientX
    const start = handle.parentElement!.getBoundingClientRect().width
    handle.setPointerCapture(event.pointerId)
    const move = (e: PointerEvent) => resize(column, start + e.clientX - startX)
    const end = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', end)
      handle.removeEventListener('pointercancel', end)
      persistColumns()
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', end)
    handle.addEventListener('pointercancel', end)
  }

  function resizeByKey(column: Column, event: ReactKeyboardEvent<HTMLElement>) {
    const sign = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!sign) return
    event.preventDefault()
    const start = columns[column] ?? event.currentTarget.parentElement!.getBoundingClientRect().width
    resize(column, start + sign * (event.shiftKey ? COLUMN_STEP_BIG : COLUMN_STEP))
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(persistColumns, 500)
  }

  function autoFit(column: Column, handle: HTMLElement) {
    const table = handle.closest('table')
    if (!table?.parentElement) return
    const cells = [...table.querySelectorAll<HTMLElement>(`[data-col="${column}"]`)]
    resize(column, fitWidth(column, contentWidths(cells, table.parentElement)))
    persistColumns()
  }

  function changeView(next: 'list' | 'grid') {
    updateSettings({ interface: { folder_view: next } }).catch((e) => showError(e))
  }

  const fileButtons = (file: TFile) => (
    <>
      <Button variant="ghost" size="icon-sm" className="max-sm:hidden" asChild>
        <a href={downloadUrl(file)} download={file.name} aria-label={t('folder.downloadName', { name: file.name })} onClick={() => markRead(file.path)}>
          <DownloadIcon />
        </a>
      </Button>
      <Button variant="ghost" size="icon-sm" className="max-sm:hidden" aria-label={t('folder.copyLink')} onClick={() => copy(absoluteUrl(downloadUrl(file)), t('folder.copiedLink'))}>
        <LinkIcon />
      </Button>
      <FileMenu file={file} skip={skipConfirm} onOpen={() => setOpened(file)} onDelete={() => removeFile.mutate(file)} />
      <Confirm skip={skipConfirm} title={t('folder.deleteFileQ', { name: file.name })} onConfirm={() => removeFile.mutate(file)}>
        <Button variant="ghost" size="icon-sm" className="max-sm:hidden" aria-label={t('folder.deleteName', { name: file.name })}>
          <Trash2Icon />
        </Button>
      </Confirm>
    </>
  )

  const folderButtons = (folder: { name: string; path: string }) => (
    <>
      <ArchiveMenu onArchive={(format) => archive.mutate({ target: folder.path, format })}>
        <Button variant="ghost" size="icon-sm" aria-label={t('folder.downloadFolderName', { name: folder.name })}>
          <DownloadIcon />
        </Button>
      </ArchiveMenu>
      <Confirm
        skip={skipConfirm}
        title={t('folder.deleteFolderQ', { name: folder.name })}
        description={t('folder.deleteFolderHint')}
        onConfirm={() => removeFolder.mutate(folder.path)}
      >
        <Button variant="ghost" size="icon-sm" aria-label={t('folder.deleteFolderName', { name: folder.name })}>
          <Trash2Icon />
        </Button>
      </Confirm>
    </>
  )

  const folderRow = (folder: Folder) => (
                <TableRow key={folder.id} data-state={selected.has(folderKey(folder.path)) ? 'selected' : undefined}>
                  <TableCell>{check(folderKey(folder.path), folder.name)}</TableCell>
                  <TableCell data-col="name">
                    <Link to={link(folder.path)} className="flex items-center gap-2 text-base hover:underline" title={folder.name}>
                      <span className="fx-mini">
                        <FolderIcon className="size-4 text-primary" />
                      </span>
                      <span className="truncate">{folder.name}</span>
                    </Link>
                  </TableCell>
                  <TableCell data-col="type" className="overflow-hidden text-ellipsis text-xs text-muted-foreground">{t('files.folderType')}</TableCell>
                  <TableCell data-col="size" className="overflow-hidden text-ellipsis text-right text-xs text-muted-foreground tabular-nums">
                    {formatBytes(folder.size)}
                    <span className="block text-xs">{filesCount(folder.files)}</span>
                  </TableCell>
                  <TableCell data-col="modified" className="overflow-hidden text-ellipsis text-xs text-muted-foreground tabular-nums" title={formatDate(folder.updated_at)}>{formatShortDate(folder.updated_at)}</TableCell>
                  <TableCell data-col="uploaded" className="overflow-hidden text-ellipsis text-xs text-muted-foreground tabular-nums" title={formatDate(folder.created_at)}>{formatShortDate(folder.created_at)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{folderButtons(folder)}</TableCell>
                </TableRow>
  )

  const fileRow = (file: TFile) => {
                return (
                  <TableRow key={file.uuid} data-state={selected.has(fileKey(file.uuid)) ? 'selected' : undefined}>
                    <TableCell>{check(fileKey(file.uuid), file.name)}</TableCell>
                    <TableCell data-col="name">
                      <button type="button" onClick={() => setOpened(file)} className="flex w-full items-center gap-2 text-left text-base hover:underline" title={file.name}>
                        <span className="fx-mini">
                          <Thumb file={file} iconClassName="size-4" />
                        </span>
                        <span className="truncate">{file.name}</span>
                        {file.encrypted && <LockIcon className="size-3 shrink-0 text-muted-foreground" aria-label={t('folder.encrypted')} />}
                      </button>
                    </TableCell>
                    <TableCell data-col="type" className="overflow-hidden text-ellipsis text-xs text-muted-foreground uppercase">{typeLabel({ type: 'file', item: file })}</TableCell>
                    <TableCell data-col="size" className="overflow-hidden text-ellipsis text-right text-xs text-muted-foreground">{formatBytes(file.size)}</TableCell>
                    <TableCell data-col="modified" className="overflow-hidden text-ellipsis text-xs text-muted-foreground tabular-nums" title={formatDate(file.updated_at)}>{formatShortDate(file.updated_at)}</TableCell>
                    <TableCell data-col="uploaded" className="overflow-hidden text-ellipsis text-xs text-muted-foreground tabular-nums" title={formatDate(file.created_at)}>{formatShortDate(file.created_at)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{fileButtons(file)}</TableCell>
                  </TableRow>
                )
  }

  const folderTile = (folder: Folder) => (
            <li key={folder.id} data-selected={selected.has(folderKey(folder.path)) || undefined} className="fx-panel fx-tile flex gap-3 p-3 transition-colors hover:border-foreground/30">
              <div className="relative">
                <span className="fx-thumb">
                  <FolderIcon className="size-6 text-primary" />
                </span>
                <div className="fx-tile-check">{check(folderKey(folder.path), folder.name)}</div>
              </div>
              <div className="grid min-w-0 flex-1 content-between gap-1">
                <Link to={link(folder.path)} className="truncate text-base hover:underline pointer-coarse:py-2.5" title={folder.name}>
                  {folder.name}
                </Link>
                <span className="truncate text-xs text-muted-foreground tabular-nums">
                  {formatBytes(folder.size)} · {filesCount(folder.files)}
                </span>
                <div className="flex items-center justify-between gap-2">
                  <Link to={link(folder.path)} className="fx-more" tabIndex={-1} aria-hidden>
                    {t('folder.open')}
                  </Link>
                  <div className="-mr-1 flex">{folderButtons(folder)}</div>
                </div>
              </div>
            </li>
  )

  const fileTile = (file: TFile) => {
            return (
              <li key={file.uuid} data-selected={selected.has(fileKey(file.uuid)) || undefined} className="fx-panel fx-tile flex gap-3 p-3 transition-colors hover:border-foreground/30">
                <div className="relative">
                  <span className="fx-thumb">
                    <Thumb file={file} iconClassName="size-6" />
                  </span>
                  <div className="fx-tile-check">{check(fileKey(file.uuid), file.name)}</div>
                </div>
                <div className="grid min-w-0 flex-1 content-between gap-1">
                  <button type="button" onClick={() => setOpened(file)} className="flex min-w-0 items-center gap-1.5 text-left text-base hover:underline pointer-coarse:py-2.5" title={file.name}>
                    <span className="truncate">{file.name}</span>
                    {file.encrypted && <LockIcon className="size-3 shrink-0 text-muted-foreground" aria-label={t('folder.encrypted')} />}
                  </button>
                  <span className="truncate text-xs text-muted-foreground tabular-nums" title={formatDate(file.updated_at)}>
                    {formatBytes(file.size)} · {formatShortDate(file.updated_at)}
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <button type="button" onClick={() => setOpened(file)} className="fx-more" tabIndex={-1} aria-hidden>
                      {t('folder.details')}
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
      aria-label={t('folder.selectName', { name: label })}
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
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-background/60 text-lg uppercase text-primary backdrop-blur-md">
          {t('folder.dropHint')}
        </div>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Crumbs path={path} name={storageName(storage)} />
        {head0 && (
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatBytes(head0.size)} · {filesCount(head0.total_files)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => input.current?.click()}>
          <UploadIcon /> {t('folder.upload')}
        </Button>
        <Button variant="outline" onClick={() => dirInput.current?.click()}>
          <FolderUpIcon /> <span className="max-sm:sr-only">{t('folder.uploadFolder')}</span>
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
          <LinkIcon /> <span className="max-sm:sr-only">{t('folder.byLink')}</span>
        </Button>
        <Button variant="outline" onClick={() => setFolderOpen(true)}>
          <FolderPlusIcon /> <span className="max-sm:sr-only">{t('folder.newFolder')}</span>
        </Button>
        <ArchiveMenu onArchive={(format) => archive.mutate({ target: path, format })}>
          <Button variant="outline" disabled={archive.isPending}>
            <ArchiveIcon /> <span className="max-sm:sr-only">{t('folder.downloadFolder')}</span>
          </Button>
        </ArchiveMenu>
        {!isRoot && (
          <Confirm
            skip={skipConfirm}
            title={t('folder.deleteFolderQ', { name: fileName(path) })}
            description={t('folder.deleteFolderHint')}
            onConfirm={() => removeFolder.mutate(path)}
          >
            <Button variant="destructive">
              <Trash2Icon /> <span className="max-sm:sr-only">{t('folder.deleteFolder')}</span>
            </Button>
          </Confirm>
        )}
      </div>

      <IoBanner path={path} />
      <FolderUploads path={path} />

      {!empty && head0 && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" aria-label={t('folder.sortAria', { key: t(SORT_LABELS[sort.key]), order: t(sort.desc ? 'folder.desc' : 'folder.asc') })}>
                {sort.desc ? <ArrowDownWideNarrowIcon /> : <ArrowUpNarrowWideIcon />}
                <span className="max-sm:sr-only">
                  {t(SORT_LABELS[sort.key])} {sort.desc ? '▼' : '▲'}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuLabel>{t('folder.sort')}</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={sort.key} onValueChange={(key) => changeSort({ ...sort, key: key as SortKey })}>
                {Object.entries(SORT_LABELS).map(([key, label]) => (
                  <DropdownMenuRadioItem key={key} value={key}>
                    {t(label)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={sort.desc ? 'desc' : 'asc'} onValueChange={(v) => changeSort({ ...sort, desc: v === 'desc' })}>
                <DropdownMenuRadioItem value="asc">{t('folder.ascArrow')}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="desc">{t('folder.descArrow')}</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={sort.foldersFirst} onCheckedChange={(v) => changeSort({ ...sort, foldersFirst: v === true })}>
                {t('folder.foldersFirst')}
              </DropdownMenuCheckboxItem>
              {view === 'list' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled={!Object.keys(columns).length} onSelect={resetColumns}>
                    {t('folder.resetColumns')}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <div role="group" aria-label={t('folder.view')} className="flex">
            <Button variant={view === 'list' ? 'default' : 'outline'} size="icon" onClick={() => changeView('list')} aria-label={t('folder.list')} aria-pressed={view === 'list'}>
              <ListIcon />
            </Button>
            <Button variant={view === 'grid' ? 'default' : 'outline'} size="icon" onClick={() => changeView('grid')} aria-label={t('folder.grid')} aria-pressed={view === 'grid'}>
              <LayoutGridIcon />
            </Button>
          </div>
        </div>
      )}

      {picked.length > 0 && (
        <div role="toolbar" aria-label={t('folder.selectedToolbar')} className="fx-glass sticky top-[calc(max(0.5rem,env(safe-area-inset-top))+4rem)] z-10 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs md:top-3">
          <span className="px-1 tracking-[0.04em] text-primary uppercase tabular-nums">{t('folder.selectedOf', { n: picked.length, total })}</span>
          <ArchiveMenu label={t('folder.archiveSelection')} onArchive={(format) => archiveSelection.mutate(format)}>
            <Button size="sm" variant="outline" disabled={archiveSelection.isPending}>
              <ArchiveIcon /> {t('folder.downloadArchive')}
            </Button>
          </ArchiveMenu>
          <Confirm
            skip={skipConfirm && picked.length === 1}
            title={t('folder.deleteSelectedQ', { n: picked.length })}
            description={t('folder.deleteSelectedHint')}
            open={confirmBulk}
            onOpenChange={setConfirmBulk}
            onConfirm={bulkDelete}
          >
            <Button size="sm" variant="destructive">
              <Trash2Icon /> {t('common.delete')}
            </Button>
          </Confirm>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
            <XIcon /> {t('folder.clearSelection')}
          </Button>
        </div>
      )}

      {listing.isPending && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
      {listing.error && <p className="text-destructive">{listing.error.message}</p>}
      {empty && (
        <div className="fx-panel grid justify-items-center gap-3 p-10 text-center">
          {eggs ? <StorageIcon scale={3} /> : <UploadIcon className="size-8 text-primary" />}
          <p className="fx-pixel text-[22px] uppercase">{t('folder.empty')}</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {t('folder.emptyHint')}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => input.current?.click()}>
              <UploadIcon /> {t('folder.uploadFiles')}
            </Button>
            <Button variant="outline" onClick={() => dirInput.current?.click()}>
              <FolderUpIcon /> {t('folder.uploadFolder')}
            </Button>
          </div>
        </div>
      )}
      {listed && (
        <div ref={panel} className="fx-panel overflow-hidden">
          <Table
            className={cn('table-fixed', !shown.type && '[&_[data-col=type]]:hidden', !shown.size && '[&_[data-col=size]]:hidden', !shown.modified && '[&_[data-col=modified]]:hidden', !shown.uploaded && '[&_[data-col=uploaded]]:hidden')}
            style={{ minWidth: tableWidth }}
          >
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox
                    checked={picked.length === order.length ? true : picked.length ? 'indeterminate' : false}
                    onCheckedChange={(v) => setSelected(v === true ? new Set(order) : new Set())}
                    aria-label={t('folder.selectAll')}
                  />
                </TableHead>
                {head('name')}
                {head('type')}
                {head('size')}
                {head('modified')}
                {head('uploaded')}
                <TableHead style={{ width: columns.name === undefined ? actionsWidth : undefined }} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (entry.type === 'folder' ? folderRow(entry.item) : fileRow(entry.item)))}
            </TableBody>
          </Table>
        </div>
      )}
      {!empty && order.length > 0 && view === 'grid' && (
        <ul data-selecting={picked.length > 0 || undefined} className="fx-stagger grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-3">
          {entries.map((entry) => (entry.type === 'folder' ? folderTile(entry.item) : fileTile(entry.item)))}
        </ul>
      )}
      {!empty && listing.hasNextPage && !listing.isPlaceholderData && <LoadMore loading={listing.isFetchingNextPage} onMore={() => listing.fetchNextPage()} left={total - order.length} />}

      <FileDialog file={opened} onClose={() => setOpened(null)} />
      <UploadDialog folder={path} files={files} onClose={() => setFiles([])} />
      <UrlUploadDialog folder={path} open={urlOpen} onOpenChange={setUrlOpen} />
      <NewFolderDialog parent={path} open={folderOpen} onOpenChange={setFolderOpen} />
    </div>
  )
}

function LoadMore({ loading, onMore, left }: { loading: boolean; onMore: () => void; left: number }) {
  const sentinel = useRef<HTMLDivElement>(null)
  const more = useRef(onMore)
  useEffect(() => {
    more.current = onMore
  })
  useEffect(() => {
    const element = sentinel.current
    if (loading || !element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((seen) => seen.some((e) => e.isIntersecting) && more.current(), { rootMargin: '0px 0px 600px 0px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [loading])
  return (
    <div ref={sentinel} className="flex justify-center py-2" aria-live="polite">
      {loading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : (
        <Button variant="outline" onClick={onMore}>
          {t('folder.showMore', { n: left })}
        </Button>
      )}
    </div>
  )
}

function NewFolderDialog({ parent, open, onOpenChange }: { parent: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = useState('')
  const create = useAction(() => api.post('/folders', { path: joinPath(parent, name) }), {
    invalidate: [['folder', parent]],
    success: t('folder.created'),
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
          <DialogTitle>{t('folder.newFolder')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('folder.newFolderPlaceholder')} autoFocus required />
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {t('common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
