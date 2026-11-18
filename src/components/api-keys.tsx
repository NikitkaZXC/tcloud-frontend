import { useQuery } from '@tanstack/react-query'
import { CopyIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { Confirm } from '@/components/confirm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAction } from '@/hooks/use-action'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/format'
import type { ApiKey } from '@/lib/types'
import { t } from '@/lib/i18n'

export function ApiKeys({ userId }: { userId: string }) {
  const key = ['api-keys', userId]
  const keys = useQuery({ queryKey: key, queryFn: () => api.get<ApiKey[]>(`/users/${userId}/api-keys`) })
  const [name, setName] = useState('')
  const [issued, setIssued] = useState<string | null>(null)

  const create = useAction(() => api.post<ApiKey>(`/users/${userId}/api-keys`, { name }), {
    invalidate: [key],
    onSuccess: (created) => {
      setIssued(created.key)
      setName('')
    },
  })
  const revoke = useAction((id: string) => api.del(`/users/${userId}/api-keys/${id}`), {
    invalidate: [key],
    success: t('keys.revoked'),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    create.mutate()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('keys.title')}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <form onSubmit={submit} className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('keys.name')} maxLength={100} required />
          <Button type="submit" disabled={create.isPending}>
            <PlusIcon /> {t('keys.issue')}
          </Button>
        </form>
        {issued && (
          <div className="grid gap-2 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">
            <span>{t('keys.once')}</span>
            <div className="flex gap-2">
              <code className="min-w-0 flex-1 break-all rounded bg-background px-2 py-1">{issued}</code>
              <Button
                size="icon-sm"
                variant="outline"
                aria-label={t('common.copy')}
                onClick={() => navigator.clipboard.writeText(issued).then(() => toast.success(t('common.copied')))}
              >
                <CopyIcon />
              </Button>
            </div>
          </div>
        )}
        {keys.error && <p className="text-sm text-destructive">{keys.error.message}</p>}
        {keys.data?.length === 0 && <p className="text-sm text-muted-foreground">{t('keys.none')}</p>}
        <ul className="grid divide-y">
          {keys.data?.map((k) => (
            <li key={k.id} className="flex items-center gap-2 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate text-foreground">{k.name}</span>
              <span className="hidden text-muted-foreground sm:inline">{t('keys.used', { date: formatDate(k.last_used_at) })}</span>
              <Confirm title={t('keys.revokeQ', { name: k.name })} action={t('keys.revoke')} onConfirm={() => revoke.mutate(k.id)}>
                <Button variant="ghost" size="icon-sm" aria-label={t('keys.revoke')}>
                  <Trash2Icon />
                </Button>
              </Confirm>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
