import { HardDriveIcon, HistoryIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router'
import { PageTitle } from '@/components/fx'
import { Confirm } from '@/components/confirm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAction } from '@/hooks/use-action'
import { isAdmin, useMe } from '@/hooks/use-me'
import { useStorages } from '@/hooks/use-storages'
import { api, request } from '@/lib/api'
import { formatBytes, storageIdOf } from '@/lib/format'
import { load } from '@/lib/prefs'
import type { Storage } from '@/lib/types'

export function ResumeLink() {
  const storages = useStorages()
  const path = load('last-folder')
  if (!path) return null
  const storage = storages.data?.find((s) => s.id === storageIdOf(path))
  if (!storage) return null
  const rest = path.split('/').slice(2).join('/')
  return (
    <Link to={`/files?path=${encodeURIComponent(path)}`} className="flex min-w-0 items-center gap-2 font-mono text-xs text-primary hover:underline">
      <HistoryIcon className="size-4 shrink-0" />
      <span className="truncate">
        продолжить: {storage.name ?? storage.id}
        {rest && ` / ${rest}`}
      </span>
    </Link>
  )
}

export function StorageList() {
  const storages = useStorages()
  const { data: me } = useMe()
  const admin = isAdmin(me)

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <PageTitle text="Хранилища" />
        {admin && <StorageForm />}
      </div>
      <ResumeLink />
      {storages.isPending && <p className="text-muted-foreground">Загрузка…</p>}
      {storages.error && <p className="text-destructive">{storages.error.message}</p>}
      {storages.data?.length === 0 && <p className="text-muted-foreground">Хранилищ пока нет.</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {storages.data?.map((storage) => (
          <Card key={storage.id} className="py-4">
            <CardContent className="flex items-start gap-3 px-4">
              {storage.has_photo ? (
                <img src={`/api/storages/${storage.id}/photo`} alt="" className="size-12 rounded-full object-cover" />
              ) : (
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted">
                  <HardDriveIcon className="size-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <Link to={`/files?path=${encodeURIComponent(storage.path)}`} className="block truncate font-medium hover:underline">
                  {storage.name ?? storage.id}
                </Link>
                {storage.description && <p className="truncate text-sm text-muted-foreground">{storage.description}</p>}
                <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                  {!storage.available && <Badge variant="destructive">канал недоступен</Badge>}
                  {storage.files != null && <span>{storage.files} файлов</span>}
                  {storage.total_size != null && <span>· {formatBytes(storage.total_size)}</span>}
                </div>
              </div>
              {admin && (
                <div className="flex">
                  <StorageForm storage={storage} />
                  <DeleteStorage storage={storage} />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function StorageForm({ storage }: { storage?: Storage }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(storage?.name ?? '')
  const [description, setDescription] = useState(storage?.description ?? '')
  const [photo, setPhoto] = useState<File | null>(null)

  const save = useAction(
    async () => {
      const body = { name, description: description || null }
      const saved = storage
        ? await api.patch<Storage>(`/storages/${storage.id}`, body)
        : await api.post<Storage>('/storages', body)
      if (photo) await request('PUT', `/storages/${saved.id}/photo`, { body: photo })
    },
    { invalidate: [['storages']], success: storage ? 'Сохранено' : 'Хранилище создано', onSuccess: () => setOpen(false) },
  )
  const removePhoto = useAction(() => api.del(`/storages/${storage!.id}/photo`), {
    invalidate: [['storages']],
    success: 'Фото удалено',
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {storage ? (
          <Button variant="ghost" size="icon-sm" aria-label="Изменить">
            <PencilIcon />
          </Button>
        ) : (
          <Button>
            <PlusIcon /> Создать
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{storage ? 'Хранилище' : 'Новое хранилище'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="storage-name">Название канала</Label>
            <Input id="storage-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="storage-description">Описание</Label>
            <Input id="storage-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="storage-photo">Фото канала</Label>
            <Input id="storage-photo" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
            {storage?.has_photo && (
              <Button type="button" variant="link" className="justify-self-start px-0" onClick={() => removePhoto.mutate()}>
                Удалить текущее фото
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={save.isPending}>
              {storage ? 'Сохранить' : 'Создать канал'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteStorage({ storage }: { storage: Storage }) {
  const [keepChannel, setKeepChannel] = useState(false)
  const remove = useAction(() => api.del(`/storages/${storage.id}`, { keep_channel: keepChannel }), {
    invalidate: [['storages']],
    success: 'Хранилище удалено',
  })

  return (
    <Confirm
      title={`Удалить «${storage.name ?? storage.id}»?`}
      description={
        <span className="grid gap-3">
          <span>Все файлы хранилища будут удалены из базы.</span>
          <span className="flex items-center gap-2">
            <Checkbox id={`keep-${storage.id}`} checked={keepChannel} onCheckedChange={(v) => setKeepChannel(v === true)} />
            <Label htmlFor={`keep-${storage.id}`}>Оставить канал в Telegram</Label>
          </span>
        </span>
      }
      onConfirm={() => remove.mutate()}
    >
      <Button variant="ghost" size="icon-sm" aria-label="Удалить">
        <Trash2Icon />
      </Button>
    </Confirm>
  )
}
