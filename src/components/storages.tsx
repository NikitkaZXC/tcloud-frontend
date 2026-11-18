import { useQuery } from '@tanstack/react-query'
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { type FormEvent, type ReactNode, useState } from 'react'
import { Link } from 'react-router'
import { ChannelsRing, PageTitle, Section, Stat, StorageIcon, UploadPulse, WRITTEN } from '@/components/fx'
import { Confirm } from '@/components/confirm'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAction } from '@/hooks/use-action'
import { isAdmin, useMe } from '@/hooks/use-me'
import { useStorageActivity, useStorageIo, useStorages } from '@/hooks/use-storages'
import { api, request } from '@/lib/api'
import { type Activity, channelUsage, type Io, storageTotals } from '@/lib/dashboard'
import { formatBytes } from '@/lib/format'
import type { Account, Storage } from '@/lib/types'

export function StorageCard({ storage, activity, io, actions }: { storage: Storage; activity?: Activity; io?: Io; actions?: ReactNode }) {
  const to = `/files?path=${encodeURIComponent(storage.path)}`
  return (
    <div className="fx-panel flex gap-4 p-4">
      <StorageIcon io={io} off={!storage.available} className="mt-1" />
      <div className="grid min-w-0 flex-1 gap-1.5">
        <div className="flex items-start gap-2">
          <Link to={to} className="min-w-0 flex-1 truncate font-pixel text-[15px] tracking-[0.06em] uppercase hover:underline pointer-coarse:py-2.5">
            {storage.name ?? storage.id}
          </Link>
          {actions}
        </div>
        {storage.description && <p className="truncate text-xs text-muted-foreground">{storage.description}</p>}
        {storage.available ? (
          <p className="flex flex-wrap items-baseline gap-x-3 text-xs text-muted-foreground tabular-nums">
            <span>
              <span className="fx-pixel text-[20px] text-foreground">{storage.total_size != null ? formatBytes(storage.total_size) : '—'}</span>
            </span>
            <span>{storage.files != null ? `${storage.files} файлов` : 'файлов — нет данных'}</span>
          </p>
        ) : (
          <p className="text-xs font-medium tracking-[0.08em] text-destructive uppercase">канал недоступен</p>
        )}
        {activity || io === 'write' || io === 'both' ? (
          <UploadPulse activity={activity ?? WRITTEN} />
        ) : (
          <Link to={to} className="fx-more justify-self-start" tabIndex={-1} aria-hidden>
            Открыть
          </Link>
        )}
      </div>
    </div>
  )
}

export function StorageList() {
  const storages = useStorages()
  const activity = useStorageActivity(storages.data ?? [])
  const io = useStorageIo(storages.data ?? [])
  const account = useQuery({ queryKey: ['account'], queryFn: () => api.get<Account>('/account'), retry: false })
  const { data: me } = useMe()
  const admin = isAdmin(me)
  const totals = storageTotals(storages.data ?? [])
  const usage = channelUsage(account.data, totals.storages)

  return (
    <div className="grid">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <PageTitle text="Хранилища" eyebrow="Каналы Telegram, где лежат файлы. Объём и число файлов — по данным API." />
        {admin && <StorageForm />}
      </div>
      <section aria-label="Итоги" className="fx-dotted mt-4 grid grid-cols-2 border-t sm:grid-cols-3 [&>*:not(:first-child)]:fx-dotted [&>*:not(:first-child)]:border-l max-sm:[&>*:nth-child(3)]:col-span-2 max-sm:[&>*:nth-child(3)]:border-t max-sm:[&>*:nth-child(3)]:border-l-0">
        <Stat label="файлов во всех хранилищах" value={totals.files} />
        <Stat label="объём" value={totals.size} format={formatBytes} />
        <Stat label="хранилищ" value={totals.storages} />
      </section>
      <Section label="Лимит каналов">
        <div className="flex flex-wrap items-center gap-8 max-sm:justify-center">
          <ChannelsRing usage={usage} />
          <div className="grid max-w-md gap-3 text-sm text-muted-foreground">
            <p>
              Telegram ограничивает число каналов и групп у аккаунта: {usage.limit}
              {account.data?.premium ? ' (Premium)' : ', с Premium — 1000'}. Каждое хранилище — отдельный канал.
            </p>
            <p className="fx-dotted border-l-4 pl-3 text-foreground">
              Нужно больше хранилищ — удалите ненужные каналы и группы в Telegram (они тоже занимают лимит) или ненужные хранилища здесь.
            </p>
            {!usage.accountWide && <p className="text-xs">API пока не отдаёт число всех каналов аккаунта — показано число хранилищ.</p>}
          </div>
        </div>
      </Section>
      <Section label="Список">
        {storages.isPending && <p className="text-muted-foreground">Загрузка…</p>}
        {storages.error && <p className="text-destructive">{storages.error.message}</p>}
        {storages.data?.length === 0 && <p className="text-muted-foreground">Хранилищ пока нет.</p>}
        <ul className="fx-stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {storages.data?.map((storage) => (
            <li key={storage.id}>
              <StorageCard
                storage={storage}
                activity={activity[storage.id]}
                io={io[storage.id]}
                actions={
                  admin && (
                    <div className="-mt-1 -mr-2 flex">
                      <StorageForm storage={storage} />
                      <DeleteStorage storage={storage} />
                    </div>
                  )
                }
              />
            </li>
          ))}
        </ul>
      </Section>
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
