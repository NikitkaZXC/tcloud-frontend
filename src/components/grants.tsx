import { Trash2Icon } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useStorages } from '@/hooks/use-storages'
import { storageName } from '@/lib/names'
import type { Grant } from '@/lib/types'
import { t } from '@/lib/i18n'

export function GrantList({ grants, onRevoke }: { grants: Grant[]; onRevoke?: (grant: Grant) => void }) {
  const storages = useStorages()
  const nameOf = (id: string) => storageName(storages.data?.find((s) => s.id === id))

  if (grants.length === 0) return <p className="text-sm text-muted-foreground">{t('grants.none')}</p>
  return (
    <ul className="grid divide-y">
      {grants.map((grant) => (
        <li key={grant.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
          <Link to={`/files?path=${encodeURIComponent(grant.path)}`} className="min-w-0 flex-1 truncate hover:underline">
            {[nameOf(grant.storage_id), ...grant.folder.split('/').filter(Boolean)].join(' › ')}
          </Link>
          <div className="flex gap-1">
            {grant.recursive && <Badge variant="outline">{t('grants.recursive')}</Badge>}
            {grant.can_read && <Badge variant="secondary">{t('grants.read')}</Badge>}
            {grant.can_upload && <Badge variant="secondary">{t('grants.upload')}</Badge>}
            {grant.can_delete && <Badge variant="secondary">{t('grants.delete')}</Badge>}
          </div>
          {onRevoke && (
            <Button variant="ghost" size="icon-sm" aria-label={t('grants.revoke')} onClick={() => onRevoke(grant)}>
              <Trash2Icon />
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}
