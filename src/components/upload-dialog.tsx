import { LinkIcon, UploadIcon } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { api, errorMessage } from '@/lib/api'
import type { Picked } from '@/lib/dir-upload'
import { formatBytes, joinPath, parseUrlLines } from '@/lib/format'
import { trackTask } from '@/lib/tasks'
import type { BatchResponse, OnConflict, Priority, SendAs, UploadOptions } from '@/lib/types'
import { finishSending, startSending, updateSending, uploadFile } from '@/lib/upload'

type Options = Omit<UploadOptions, 'path'>

const DEFAULTS: Options = {
  send_as: 'file',
  on_conflict: 'error',
  priority: 'normal',
  allow_unscannable: false,
  encrypt: false,
}

function OptionsFields({ options, setOptions }: { options: Options; setOptions: (o: Options) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="grid gap-1.5">
        <Label>Отправить как</Label>
        <Select
          value={options.send_as}
          onValueChange={(v) => setOptions({ ...options, send_as: v as SendAs, encrypt: v === 'media' ? false : options.encrypt })}
        >
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="file">файл (оригинал)</SelectItem>
            <SelectItem value="media">медиа (сжатие)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label>Если файл есть</Label>
        <Select value={options.on_conflict} onValueChange={(v) => setOptions({ ...options, on_conflict: v as OnConflict })}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="error">ошибка</SelectItem>
            <SelectItem value="replace">заменить</SelectItem>
            <SelectItem value="keep_both">оставить оба</SelectItem>
            <SelectItem value="skip">пропустить</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label>Приоритет</Label>
        <Select value={options.priority} onValueChange={(v) => setOptions({ ...options, priority: v as Priority })}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="low">низкий</SelectItem>
            <SelectItem value="normal">обычный</SelectItem>
            <SelectItem value="high">высокий</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-3">
        <Checkbox
          checked={options.encrypt}
          disabled={options.send_as === 'media'}
          onCheckedChange={(v) => setOptions({ ...options, encrypt: v === true })}
        />
        Зашифровать (только «файл»)
      </label>
      <label className="flex items-center gap-2 text-sm sm:col-span-3">
        <Checkbox
          checked={options.allow_unscannable}
          onCheckedChange={(v) => setOptions({ ...options, allow_unscannable: v === true })}
        />
        Принимать файлы, которые антивирус не может проверить
      </label>
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
  const [options, setOptions] = useState(DEFAULTS)
  const total = files.reduce((sum, item) => sum + item.file.size, 0)

  async function start() {
    const queue = files.map(({ file, path }) => ({ file, path: joinPath(folder, path), id: startSending(joinPath(folder, path), file.size) }))
    onClose()
    toast.success(`В очереди на отправку: ${queue.length}`)
    for (const { file, path, id } of queue) {
      try {
        const task = await uploadFile(file, { ...options, path }, (loaded) => updateSending(id, loaded))
        trackTask(task.id)
      } catch (e) {
        toast.error(`${file.name}: ${errorMessage(e)}`)
      } finally {
        finishSending(id)
      }
    }
  }

  return (
    <Dialog open={files.length > 0} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Загрузка в {folder.split('/').slice(2).join('/') || 'корень'}</DialogTitle>
          <p className="font-mono text-xs text-muted-foreground">
            файлов: {files.length} · {formatBytes(total)}
          </p>
        </DialogHeader>
        <ul className="grid max-h-48 gap-2 overflow-y-auto text-sm">
          {files.map(({ file, path }, i) => (
            <li key={i} className="grid gap-1">
              <div className="flex justify-between gap-2">
                <span className="truncate">{path}</span>
                <span className="shrink-0 text-muted-foreground">{formatBytes(file.size)}</span>
              </div>
            </li>
          ))}
        </ul>
        <OptionsFields options={options} setOptions={setOptions} />
        <DialogFooter>
          <Button onClick={start}>
            <UploadIcon /> Загрузить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function UrlUploadDialog({ folder, open, onOpenChange }: { folder: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [options, setOptions] = useState(DEFAULTS)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    let items
    try {
      items = parseUrlLines(text, folder).map((item) => ({ ...item, ...options }))
    } catch {
      toast.error('Неверная ссылка')
      return
    }
    setBusy(true)
    try {
      const result = await api.post<BatchResponse>('/uploads/batch', { items })
      result.items.forEach((item) => {
        if (item.task) trackTask(item.task.id)
        if (item.error) toast.error(`${item.path.split('/').pop()}: ${item.error.message}`)
      })
      const queued = result.items.filter((item) => item.task).length
      if (queued) toast.success(`В очереди: ${queued}`)
      setText('')
      onOpenChange(false)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Загрузка по ссылкам</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="urls">Ссылки, по одной в строке (до 100). Имя: «ссылка | имя»</Label>
            <Textarea
              id="urls"
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'https://example.com/video.mp4\nhttps://example.com/get?id=1 | photo.jpg'}
              required
            />
          </div>
          <OptionsFields options={options} setOptions={setOptions} />
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              <LinkIcon /> Поставить в очередь
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
