import { useQuery } from '@tanstack/react-query'
import {
  ArchiveIcon,
  DownloadIcon,
  FileIcon,
  FileTextIcon,
  FilmIcon,
  FolderIcon,
  FolderPlusIcon,
  ImageIcon,
  LinkIcon,
  LockIcon,
  MusicIcon,
  Trash2Icon,
  UploadIcon,
} from 'lucide-react'
import { type DragEvent, type FormEvent, useRef, useState } from 'react'
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { UploadDialog, UrlUploadDialog } from '@/components/upload-dialog'
import { useAction } from '@/hooks/use-action'
import { useStorages } from '@/hooks/use-storages'
import { api } from '@/lib/api'
import { crumbs, downloadUrl, formatBytes, formatDate, joinPath, parentPath, storageIdOf } from '@/lib/format'
import { trackTask } from '@/lib/tasks'
import type { ArchiveFormat, FolderDeleteResponse, FolderListing, Task, TFile } from '@/lib/types'

const KIND_ICONS = { photo: ImageIcon, video: FilmIcon, audio: MusicIcon, animation: FilmIcon, document: FileTextIcon }
const ARCHIVE_FORMATS: ArchiveFormat[] = ['zip', '7z', 'tar.gz', 'tar.bz2', 'tar.xz']

const link = (path: string) => `/files?path=${encodeURIComponent(path)}`

export function FolderView({ path }: { path: string }) {
  const navigate = useNavigate()
  const storages = useStorages()
  const listing = useQuery({ queryKey: ['folder', path], queryFn: () => api.get<FolderListing>('/folders', { path }) })
  const [opened, setOpened] = useState<TFile | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [urlOpen, setUrlOpen] = useState(false)
  const [folderOpen, setFolderOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const storageId = storageIdOf(path)
  const storage = storages.data?.find((s) => s.id === storageId)
  const isRoot = path.split('/').length <= 2

  const archive = useAction(
    (format: ArchiveFormat) => api.post<Task>('/folders/archive', undefined, { path, format }),
    { success: 'Архив собирается — скачать на странице «Задачи»', onSuccess: (task) => trackTask(task.id) },
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

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    const dropped = [...event.dataTransfer.files]
    if (dropped.length) setFiles(dropped)
  }

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
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300">
          Отпустите, чтобы загрузить
        </div>
      )}
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
              <BreadcrumbPage>{storage?.name ?? storageId}</BreadcrumbPage>
            ) : (
              <BreadcrumbLink asChild>
                <Link to={link(`tcloud/${storageId}`)}>{storage?.name ?? storageId}</Link>
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

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => input.current?.click()}>
          <UploadIcon /> Загрузить
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            setFiles([...(e.target.files ?? [])])
            e.target.value = ''
          }}
        />
        <Button variant="outline" onClick={() => setUrlOpen(true)}>
          <LinkIcon /> По ссылке
        </Button>
        <Button variant="outline" onClick={() => setFolderOpen(true)}>
          <FolderPlusIcon /> Папка
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={archive.isPending}>
              <ArchiveIcon /> Архив
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Скачать папку архивом</DropdownMenuLabel>
            {ARCHIVE_FORMATS.map((format) => (
              <DropdownMenuItem key={format} onSelect={() => archive.mutate(format)}>
                {format}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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

      {listing.isPending && <p className="text-muted-foreground">Загрузка…</p>}
      {listing.error && <p className="text-destructive">{listing.error.message}</p>}
      {listing.data && (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Имя</TableHead>
                <TableHead className="hidden w-28 text-right sm:table-cell">Размер</TableHead>
                <TableHead className="hidden w-44 md:table-cell">Изменён</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {listing.data.folders.length + listing.data.files.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    Пусто. Перетащите файлы сюда.
                  </TableCell>
                </TableRow>
              )}
              {listing.data.folders.map((folder) => (
                <TableRow key={folder.id}>
                  <TableCell>
                    <Link to={link(folder.path)} className="flex items-center gap-2 font-medium hover:underline">
                      <FolderIcon className="size-4 shrink-0 text-sky-500" />
                      <span className="truncate">{folder.name}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground sm:table-cell">—</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(folder.updated_at)}</TableCell>
                  <TableCell className="text-right">
                    <Confirm
                      title={`Удалить папку «${folder.name}»?`}
                      description="Всё содержимое будет удалено из Telegram и базы."
                      onConfirm={() => removeFolder.mutate(folder.path)}
                    >
                      <Button variant="ghost" size="icon-sm" aria-label="Удалить папку">
                        <Trash2Icon />
                      </Button>
                    </Confirm>
                  </TableCell>
                </TableRow>
              ))}
              {listing.data.files.map((file) => {
                const Icon = KIND_ICONS[file.kind] ?? FileIcon
                return (
                  <TableRow key={file.uuid}>
                    <TableCell className="max-w-0">
                      <button type="button" onClick={() => setOpened(file)} className="flex w-full items-center gap-2 text-left hover:underline">
                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{file.name}</span>
                        {file.encrypted && <LockIcon className="size-3 shrink-0 text-muted-foreground" aria-label="зашифрован" />}
                      </button>
                    </TableCell>
                    <TableCell className="hidden text-right text-muted-foreground sm:table-cell">{formatBytes(file.size)}</TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(file.updated_at)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon-sm" asChild>
                        <a href={downloadUrl(file)} download={file.name} aria-label="Скачать">
                          <DownloadIcon />
                        </a>
                      </Button>
                      <Confirm title={`Удалить «${file.name}»?`} onConfirm={() => removeFile.mutate(file)}>
                        <Button variant="ghost" size="icon-sm" aria-label="Удалить">
                          <Trash2Icon />
                        </Button>
                      </Confirm>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
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
