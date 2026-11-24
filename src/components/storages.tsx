import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { type FormEvent, type ReactNode, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ChannelsRing, IoTag, PageTitle, Section, Stat, StorageIcon, UploadPulse, WRITTEN } from '@/components/fx'
import { Confirm } from '@/components/confirm'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAction } from '@/hooks/use-action'
import { isAdmin, useMe } from '@/hooks/use-me'
import { useAccount, useStorageActivity, useStorageIo, useStorages } from '@/hooks/use-storages'
import { api, errorMessage, request } from '@/lib/api'
import { type Activity, channelUsage, type Io, storageChangeKeys, storageTotals } from '@/lib/dashboard'
import { filesCount, formatBytes } from '@/lib/format'
import { isUnavailable, storageName } from '@/lib/names'
import type { Storage } from '@/lib/types'
import { t } from '@/lib/i18n'

export function StorageCard({ storage, activity, io, actions }: { storage: Storage; activity?: Activity; io?: Io; actions?: ReactNode }) {
  const to = `/files?path=${encodeURIComponent(storage.path)}`
  return (
    <div className="fx-panel flex h-full gap-4 p-4">
      <StorageIcon id={storage.id} io={io} off={isUnavailable(storage)} className="mt-1" />
      <div className="grid min-w-0 flex-1 gap-1.5">
        <div className="flex items-start gap-2">
          <Link to={to} className="min-w-0 flex-1 truncate text-sm tracking-[0.04em] uppercase hover:underline pointer-coarse:py-2.5">
            {storageName(storage)}
          </Link>
          <IoTag io={io} short />
          {actions}
        </div>
        {storage.description && <p className="truncate text-xs text-muted-foreground">{storage.description}</p>}
        {!isUnavailable(storage) ? (
          <p className="flex flex-wrap items-baseline gap-x-3 text-xs text-muted-foreground tabular-nums">
            <span>
              <span className="fx-pixel text-[22px] text-foreground">{storage.total_size != null ? formatBytes(storage.total_size) : '—'}</span>
            </span>
            <span>{storage.files != null ? filesCount(storage.files) : t('storages.filesNoData')}</span>
          </p>
        ) : (
          <p className="text-xs tracking-[0.08em] text-destructive uppercase">{t('io.off')}</p>
        )}
        {activity || io === 'write' || io === 'both' ? (
          <UploadPulse activity={activity ?? WRITTEN} />
        ) : (
          <Link to={to} className="fx-more justify-self-start" tabIndex={-1} aria-hidden>
            {t('folder.open')}
          </Link>
        )}
      </div>
    </div>
  )
}

export function StorageList() {
  const storages = useStorages()
  const activity = useStorageActivity(storages.data ?? [])
  const io = useStorageIo()
  const account = useAccount()
  const { data: me } = useMe()
  const admin = isAdmin(me)
  const totals = storageTotals(storages.data ?? [])
  const usage = channelUsage(account.data, totals.storages)

  return (
    <div className="grid">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <PageTitle text={t('nav.storages')} eyebrow={t('storages.eyebrow')} />
        {admin && <StorageForm />}
      </div>
      <section aria-label={t('storages.totals')} className="fx-dotted mt-4 grid grid-cols-2 border-t sm:grid-cols-3 [&>*:not(:first-child)]:fx-dotted [&>*:not(:first-child)]:border-l max-sm:[&>*:nth-child(3)]:col-span-2 max-sm:[&>*:nth-child(3)]:border-t max-sm:[&>*:nth-child(3)]:border-l-0">
        <Stat label={t('storages.files')} value={totals.files} />
        <Stat label={t('storages.size')} value={totals.size} format={formatBytes} />
        <Stat label={t('dashboard.storagesShort')} value={totals.storages} />
      </section>
      <Section label={t('storages.limit')}>
        <div className="flex flex-wrap items-center gap-8 max-sm:justify-center">
          <ChannelsRing usage={usage} />
          <div className="grid max-w-md gap-3 text-sm text-muted-foreground">
            <p>
              {account.data?.telegram_connected === false ? t('dashboard.telegramOff') : t(account.data?.premium ? 'storages.limitPremium' : 'storages.limitFree', { n: usage.limit })}
            </p>
            <p className="fx-dotted border-l-4 pl-3 text-foreground">
              {t('storages.needMore')}
            </p>
            {!usage.accountWide && account.data?.telegram_connected !== false && <p className="text-xs">{t('storages.noTelegram')}</p>}
          </div>
        </div>
      </Section>
      <Section label={t('storages.list')}>
        {storages.isPending && <p className="text-muted-foreground">{t('common.loading')}</p>}
        {storages.error && <p className="text-destructive">{errorMessage(storages.error)}</p>}
        {storages.data?.length === 0 && <p className="text-muted-foreground">{t('storages.none')}</p>}
        <ul className="fx-stagger grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 [&>li]:min-w-0">
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

const PHOTO_TYPES = 'image/jpeg,image/png,image/webp,image/heic,image/heif,image/gif'
const PHOTO_MAX = 10 * 1024 * 1024

export function StorageForm({ storage }: { storage?: Storage }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)

  function openChange(next: boolean) {
    if (next) {
      setName(storage?.name ?? '')
      setDescription(storage?.description ?? '')
      setPhoto(null)
    }
    setOpen(next)
  }

  const uploadPhoto = useAction(({ id, file }: { id: string; file: File }) => request('PUT', `/storages/${id}/photo`, { body: file }), {
    invalidate: [['storages']],
    describe: (error) => t('storages.photoFailed', { error: errorMessage(error) }),
  })
  const save = useAction(
    () => {
      const body = { name, description }
      return storage ? api.patch<Storage>(`/storages/${storage.id}`, body) : api.post<Storage>('/storages', body)
    },
    {
      invalidate: storageChangeKeys(storage ? 'updated' : 'created'),
      success: t(storage ? 'common.saved' : 'storages.created'),
      onSuccess: (saved) => {
        setOpen(false)
        if (photo) uploadPhoto.mutate({ id: saved.id, file: photo })
      },
    },
  )

  function pick(input: HTMLInputElement) {
    const file = input.files?.[0] ?? null
    if (file && file.size > PHOTO_MAX) {
      toast.error(t('storages.photoTooBig', { limit: formatBytes(PHOTO_MAX) }))
      input.value = ''
      setPhoto(null)
    } else setPhoto(file)
  }
  const removePhoto = useAction(() => api.del(`/storages/${storage!.id}/photo`), {
    invalidate: [['storages']],
    success: t('storages.photoDeleted'),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={openChange}>
      <DialogTrigger asChild>
        {storage ? (
          <Button variant="ghost" size="icon-sm" aria-label={t('common.edit')}>
            <PencilIcon />
          </Button>
        ) : (
          <Button>
            <PlusIcon /> {t('common.create')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(storage ? 'scope.storage' : 'storages.new')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="storage-name">{t('storages.name')}</Label>
            <Input id="storage-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="storage-description">{t('storages.description')}</Label>
            <Input id="storage-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="storage-photo">{t('storages.photo')}</Label>
            <Input id="storage-photo" type="file" accept={PHOTO_TYPES} onChange={(e) => pick(e.target)} />
            {storage?.has_photo && (
              <Button type="button" variant="link" className="justify-self-start px-0" onClick={() => removePhoto.mutate()}>
                {t('storages.deletePhoto')}
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={save.isPending}>
              {t(storage ? 'common.save' : 'storages.createChannel')}
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
    invalidate: storageChangeKeys('deleted'),
    success: t('storages.deleted'),
  })

  return (
    <Confirm
      title={t('folder.deleteFileQ', { name: storageName(storage) })}
      description={
        <span className="grid gap-3">
          <span>{t('storages.deleteHint')}</span>
          <span className="flex items-center gap-2">
            <Checkbox id={`keep-${storage.id}`} checked={keepChannel} onCheckedChange={(v) => setKeepChannel(v === true)} />
            <Label htmlFor={`keep-${storage.id}`} className="text-sm tracking-normal text-foreground normal-case">{t('storages.keepChannel')}</Label>
          </span>
        </span>
      }
      onConfirm={() => remove.mutate()}
    >
      <Button variant="ghost" size="icon-sm" aria-label={t('common.delete')}>
        <Trash2Icon />
      </Button>
    </Confirm>
  )
}
