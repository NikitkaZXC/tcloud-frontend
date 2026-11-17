import { Trash2Icon } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useStorages } from '@/hooks/use-storages'
import type { Grant } from '@/lib/types'

export function GrantList({ grants, onRevoke }: { grants: Grant[]; onRevoke?: (grant: Grant) => void }) {
  const storages = useStorages()
  const storageName = (id: string) => storages.data?.find((s) => s.id === id)?.name ?? id

  if (grants.length === 0) return <p className="text-sm text-muted-foreground">Доступов нет.</p>
  return (
    <ul className="grid divide-y">
      {grants.map((grant) => (
        <li key={grant.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
          <Link to={`/files?path=${encodeURIComponent(grant.path)}`} className="min-w-0 flex-1 truncate hover:underline">
            {storageName(grant.storage_id)}/{grant.folder}
          </Link>
          <div className="flex gap-1">
            {grant.recursive && <Badge variant="outline">с подпапками</Badge>}
            {grant.can_read && <Badge variant="secondary">чтение</Badge>}
            {grant.can_upload && <Badge variant="secondary">загрузка</Badge>}
            {grant.can_delete && <Badge variant="secondary">удаление</Badge>}
          </div>
          {onRevoke && (
            <Button variant="ghost" size="icon-sm" aria-label="Забрать доступ" onClick={() => onRevoke(grant)}>
              <Trash2Icon />
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}
