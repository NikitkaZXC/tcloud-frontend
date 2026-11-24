import { useQueryClient } from '@tanstack/react-query'
import { LinkIcon, UploadIcon } from 'lucide-react'
import { type FormEvent, type ReactNode, useId, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { isAdmin, useMe } from '@/hooks/use-me'
import { api, errorText, showError } from '@/lib/api'
import type { Picked } from '@/lib/dir-upload'
import { filesCount, formatBytes, joinPath, parseUrlLines } from '@/lib/format'
import { trackTask } from '@/lib/tasks'
import type { BatchResponse, OnConflict, Priority, SendAs, Task, UploadOptions } from '@/lib/types'
import { uploadOptions, useSettings } from '@/lib/settings'
import { answerConflict, type Batch, type Conflict, type Resolution, sendTracked, startSending, uploadFile, useConflicts, withSendAs } from '@/lib/upload'
import { fileName } from '@/lib/names'
import { hintTask } from '@/lib/steps'
import { t } from '@/lib/i18n'

type Options = Omit<UploadOptions, 'path'>

function useOptions(): [Options, (options: Options | null) => void] {
  const defaults = uploadOptions(useSettings().uploads)
  const [edited, setEdited] = useState<Options | null>(null)
  return [edited ?? defaults, setEdited]
}

function Field({ label, hint, children }: { label: string; hint: string; children: (ids: { label: string; hint: string }) => ReactNode }) {
  const id = useId()
  const ids = { label: `${id}-label`, hint: `${id}-hint` }
  return (
    <div className="grid min-w-0 content-start gap-1.5">
      <Label id={ids.label}>{label}</Label>
      {children(ids)}
      <p id={ids.hint} className="text-xs text-muted-foreground">
        {hint}
      </p>
    </div>
  )
}

function Check({ label, hint, checked, disabled, onChange }: { label: string; hint: string; checked: boolean; disabled?: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="flex min-w-0 items-start gap-2 has-[:disabled]:opacity-50">
      <Checkbox className="mt-1" checked={checked} disabled={disabled} onCheckedChange={(v) => onChange(v === true)} />
      <span className="grid min-w-0 gap-0.5">
        <span className="text-sm">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  )
}

const SEND_AS_HINTS = { file: 'upload.sendAsFileHint', media: 'upload.sendAsMediaHint' } as const
const CONFLICT_HINTS = { error: 'upload.conflictErrorHint', replace: 'upload.conflictReplaceHint', keep_both: 'upload.conflictKeepBothHint', skip: 'upload.conflictSkipHint' } as const

function OptionsFields({ options, setOptions }: { options: Options; setOptions: (o: Options) => void }) {
  const admin = isAdmin(useMe().data)
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t('upload.sendAs')} hint={t(SEND_AS_HINTS[options.send_as])}>
        {(ids) => (
          <Select value={options.send_as} onValueChange={(v) => setOptions(withSendAs(options, v as SendAs))}>
            <SelectTrigger className="w-full" aria-labelledby={ids.label} aria-describedby={ids.hint}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="file">{t('sendAs.file')}</SelectItem>
              <SelectItem value="media">{t('sendAs.media')}</SelectItem>
            </SelectContent>
          </Select>
        )}
      </Field>
      <Field label={t('upload.onConflict')} hint={t(CONFLICT_HINTS[options.on_conflict])}>
        {(ids) => (
          <Select value={options.on_conflict} onValueChange={(v) => setOptions({ ...options, on_conflict: v as OnConflict })}>
            <SelectTrigger className="w-full" aria-labelledby={ids.label} aria-describedby={ids.hint}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="error">{t('conflict.error')}</SelectItem>
              <SelectItem value="replace">{t('conflict.replace')}</SelectItem>
              <SelectItem value="keep_both">{t('conflict.keepBoth')}</SelectItem>
              <SelectItem value="skip">{t('conflict.skip')}</SelectItem>
            </SelectContent>
          </Select>
        )}
      </Field>
      <Field label={t('upload.priority')} hint={t('upload.priorityHint')}>
        {(ids) => (
          <Select value={options.priority} onValueChange={(v) => setOptions({ ...options, priority: v as Priority })}>
            <SelectTrigger className="w-full" aria-labelledby={ids.label} aria-describedby={ids.hint}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">{t('priority.low')}</SelectItem>
              <SelectItem value="normal">{t('priority.normal')}</SelectItem>
              <SelectItem value="high" disabled={!admin}>{t(admin ? 'priority.high' : 'priority.highAdmin')}</SelectItem>
            </SelectContent>
          </Select>
        )}
      </Field>
      <div className="grid content-start gap-3 sm:col-span-2 sm:grid-cols-2">
        <Check label={t('upload.encrypt')} hint={t('upload.encryptHint')} checked={options.encrypt} disabled={options.send_as !== 'file'} onChange={(encrypt) => setOptions({ ...options, encrypt })} />
        <Check label={t('upload.unscannable')} hint={t('upload.unscannableHint')} checked={options.allow_unscannable} onChange={(allow_unscannable) => setOptions({ ...options, allow_unscannable })} />
      </div>
    </div>
  )
}

export function UploadDialog({
  folder,
  files,
  onClose,
}: {
  folder: string
  files: Picked[]
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [options, setOptions] = useOptions()
  const total = files.reduce((sum, item) => sum + item.file.size, 0)

  async function start() {
    const queue = files.map(({ file, path }) => ({ file, path: joinPath(folder, path), id: startSending(joinPath(folder, path), file.size, options.encrypt) }))
    onClose()
    setOptions(null)
    toast.success(t('upload.queuedSend', { n: queue.length }))
    const batch: Batch = { size: queue.length }
    for (const { file, path, id } of queue) {
      await sendTracked(queryClient, id, file.name, options.encrypt, (onProgress, signal, onConflict) => uploadFile(file, { ...options, path, on_conflict: onConflict ?? options.on_conflict }, onProgress, signal), batch)
    }
  }

  return (
    <Dialog
      open={files.length > 0}
      onOpenChange={(open) => {
        if (open) return
        onClose()
        setOptions(null)
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('upload.title', { folder: folder.split('/').slice(2).join('/') || t('upload.root') })}</DialogTitle>
        </DialogHeader>
        <ul className="grid max-h-60 grid-cols-1 content-start overflow-y-auto border-y border-border py-1">
          {files.map(({ file, path }, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3 py-1">
              <span className="min-w-0 truncate text-sm" title={path}>{path}</span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatBytes(file.size)}</span>
            </li>
          ))}
        </ul>
        <OptionsFields options={options} setOptions={setOptions} />
        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {filesCount(files.length)} · {formatBytes(total)}
          </p>
          <Button onClick={start}>
            <UploadIcon /> {t('folder.upload')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ConflictDialog() {
  const conflict = useConflicts()[0]
  return conflict ? <ConflictPrompt key={conflict.id} conflict={conflict} /> : null
}

function ConflictPrompt({ conflict }: { conflict: Conflict }) {
  const [all, setAll] = useState(false)
  const answer = (choice: Resolution | null) => answerConflict(conflict, choice, all)
  return (
    <Dialog open onOpenChange={(open) => !open && answer(null)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('uploads.conflictTitle')}</DialogTitle>
          <DialogDescription>{t('uploads.conflictText', { name: fileName(conflict.path) })}</DialogDescription>
        </DialogHeader>
        {conflict.suggested && <p className="text-xs text-muted-foreground">{t('uploads.conflictKeepBothHint', { name: conflict.suggested })}</p>}
        {conflict.batch.size > 1 && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={all} onCheckedChange={(v) => setAll(v === true)} />
            {t('uploads.conflictAll')}
          </label>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => answer(null)}>{t('common.cancel')}</Button>
          <Button variant="outline" onClick={() => answer('keep_both')}>{t('uploads.conflictKeepBoth')}</Button>
          <Button variant="destructive" onClick={() => answer('replace')}>{t('uploads.conflictReplace')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function UrlUploadDialog({ folder, open, onOpenChange }: { folder: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient()
  const [options, setOptions] = useOptions()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    let items
    try {
      items = parseUrlLines(text, folder).map((item) => ({ ...item, ...options }))
    } catch {
      toast.error(t('upload.badLink'))
      return
    }
    setBusy(true)
    try {
      const result = await api.post<BatchResponse>('/uploads/batch', { items })
      result.items.forEach((item) => {
        if (item.task) {
          hintTask(item.task.id, { encrypt: options.encrypt })
          queryClient.setQueryData<Task>(['task', item.task.id], item.task)
          trackTask(item.task.id)
        }
        if (item.error) toast.error(`${item.path.split('/').pop()}: ${errorText(item.error)}`)
      })
      const queued = result.items.filter((item) => item.task).length
      if (queued) toast.success(t('upload.queued', { n: queued }))
      setText('')
      setOptions(null)
      onOpenChange(false)
    } catch (e) {
      showError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setOptions(null)
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('upload.urlTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="urls">{t('upload.urlLabel')}</Label>
            <Textarea
              aria-describedby="urls-hint"
              id="urls"
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'https://example.com/video.mp4\nhttps://example.com/get?id=1 | photo.jpg'}
              required
            />
            <p id="urls-hint" className="text-xs text-muted-foreground">
              {t('upload.urlHint')}
            </p>
          </div>
          <OptionsFields options={options} setOptions={setOptions} />
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              <LinkIcon /> {t('upload.enqueue')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
