import { CopyIcon, DownloadIcon, ExternalLinkIcon, LinkIcon, LockIcon } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { absoluteUrl, copy } from '@/lib/clipboard'
import { downloadUrl, formatBytes, formatDate, formatDuration } from '@/lib/format'
import { markRead } from '@/lib/reads'
import { useStorages } from '@/hooks/use-storages'
import { humanPath } from '@/lib/names'
import { thumbUrl } from '@/lib/thumbs'
import type { TFile } from '@/lib/types'
import { t } from '@/lib/i18n'

const PREVIEW = ['photo', 'animation', 'video', 'audio']

function Preview({ file }: { file: TFile }) {
  const src = downloadUrl(file)
  useEffect(() => {
    if (PREVIEW.includes(file.kind)) markRead(file.path)
  }, [file])
  if (file.kind === 'photo' || file.kind === 'animation') {
    if (file.mime.startsWith('video/')) return <video src={src} autoPlay loop muted className="max-h-96 w-full rounded-md" />
    return <img src={src} alt={file.name} className="max-h-96 w-full rounded-md object-contain" />
  }
  if (file.kind === 'video') return <video src={src} poster={thumbUrl(file) ?? undefined} controls preload="metadata" className="max-h-96 w-full rounded-md" />
  if (file.kind === 'audio') return <audio src={src} controls className="w-full" />
  return null
}

export function FileDialog({ file, onClose }: { file: TFile | null; onClose: () => void }) {
  const storages = useStorages().data ?? []
  const rows: [string, string][] = file
    ? [
        [t('file.location'), humanPath(file.path.split('/').slice(0, -1).join('/'), storages)],
        [t('sort.size'), formatBytes(file.size)],
        [t('sort.type'), `${file.kind} · ${file.mime} · ${file.sent_as}`],
        ...(file.width ? [[t('file.dimensions'), `${file.width}×${file.height}`] as [string, string]] : []),
        ...(file.duration ? [[t('file.duration'), formatDuration(file.duration)] as [string, string]] : []),
        [t('file.encryption'), t(file.encrypted ? 'common.yes' : 'common.no')],
        ['SHA-256', file.sha256],
        [t('file.telegramSearch'), file.telegram.search],
        [t('sort.uploaded'), formatDate(file.created_at)],
        [t('sort.modified'), formatDate(file.updated_at)],
      ]
    : []

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        {file && (
          <>
            <DialogHeader>
              <DialogTitle className="break-all pr-6">
                {file.encrypted && <LockIcon className="mr-2 inline size-4 align-[-2px] text-muted-foreground" aria-label={t('folder.encrypted')} />}
                {file.name}
              </DialogTitle>
            </DialogHeader>
            <Preview file={file} />
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {rows.map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="text-muted-foreground">{key}</dt>
                  <dd className="break-all text-xs leading-5 tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <a href={downloadUrl(file)} download={file.name} onClick={() => markRead(file.path)}>
                  <DownloadIcon /> {t('common.download')}
                </a>
              </Button>
              <Button variant="outline" onClick={() => copy(file.path, t('folder.copiedPath'))}>
                <CopyIcon /> {t('file.path')}
              </Button>
              <Button variant="outline" onClick={() => copy(absoluteUrl(downloadUrl(file)), t('folder.copiedLink'))}>
                <LinkIcon /> {t('file.link')}
              </Button>
              <Button variant="outline" asChild>
                <a href={file.telegram.link} target="_blank" rel="noreferrer">
                  <ExternalLinkIcon /> {t('file.openTelegram')}
                </a>
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
