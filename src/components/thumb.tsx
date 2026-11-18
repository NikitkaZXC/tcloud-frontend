import { FileIcon, FileTextIcon, FilmIcon, ImageIcon, MusicIcon } from 'lucide-react'
import { useState } from 'react'
import { thumbUrl } from '@/lib/thumbs'
import type { TFile } from '@/lib/types'
import { cn } from '@/lib/utils'

const KIND_ICONS = { photo: ImageIcon, video: FilmIcon, audio: MusicIcon, animation: FilmIcon, document: FileTextIcon }
const failed = new Set<string>()

export function Thumb({ file, className, iconClassName }: { file: TFile; className?: string; iconClassName?: string }) {
  const url = thumbUrl(file)
  const [broken, setBroken] = useState(false)
  if (!url || broken || failed.has(url)) {
    const Icon = KIND_ICONS[file.kind] ?? FileIcon
    return <Icon className={iconClassName} aria-hidden />
  }
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn('fx-thumb-img', className)}
      onError={() => {
        failed.add(url)
        setBroken(true)
      }}
    />
  )
}
