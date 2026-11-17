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
    success: 'Ключ отозван',
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    create.mutate()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API-ключи</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <form onSubmit={submit} className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название ключа" maxLength={100} required />
          <Button type="submit" disabled={create.isPending}>
            <PlusIcon /> Выпустить
          </Button>
        </form>
        {issued && (
          <div className="grid gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
            <span>Ключ показывается один раз — сохраните его. Передавайте в заголовке X-API-Key.</span>
            <div className="flex gap-2">
              <code className="min-w-0 flex-1 break-all rounded bg-background px-2 py-1">{issued}</code>
              <Button
                size="icon-sm"
                variant="outline"
                aria-label="Скопировать"
                onClick={() => navigator.clipboard.writeText(issued).then(() => toast.success('Скопировано'))}
              >
                <CopyIcon />
              </Button>
            </div>
          </div>
        )}
        {keys.error && <p className="text-sm text-destructive">{keys.error.message}</p>}
        {keys.data?.length === 0 && <p className="text-sm text-muted-foreground">Ключей нет.</p>}
        <ul className="grid divide-y">
          {keys.data?.map((k) => (
            <li key={k.id} className="flex items-center gap-2 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium">{k.name}</span>
              <span className="hidden text-muted-foreground sm:inline">использован: {formatDate(k.last_used_at)}</span>
              <Confirm title={`Отозвать ключ «${k.name}»?`} action="Отозвать" onConfirm={() => revoke.mutate(k.id)}>
                <Button variant="ghost" size="icon-sm" aria-label="Отозвать">
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
