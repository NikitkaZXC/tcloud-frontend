import { useQuery } from '@tanstack/react-query'
import { LogOutIcon } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router'
import { PageTitle } from '@/components/fx'
import { ApiKeys } from '@/components/api-keys'
import { Confirm } from '@/components/confirm'
import { GrantList } from '@/components/grants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAction } from '@/hooks/use-action'
import { isAdmin, useMe } from '@/hooks/use-me'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/format'
import type { UserSession } from '@/lib/types'

export function AccountPage() {
  const { data: me } = useMe()
  if (!me) return null

  return (
    <div className="grid gap-4">
      <PageTitle text={me.login} className="normal-case">
        <Badge variant="outline">{me.role}</Badge>
      </PageTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        <PasswordCard />
        <ApiKeys userId={me.id} />
        <Sessions />
        {!isAdmin(me) && (
          <Card>
            <CardHeader>
              <CardTitle>Мои доступы</CardTitle>
            </CardHeader>
            <CardContent>
              <GrantList grants={me.grants} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function PasswordCard() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const change = useAction(() => api.post('/auth/password', { current_password: current, new_password: next }), {
    success: 'Пароль изменён, другие сессии завершены',
    invalidate: [['sessions']],
    onSuccess: () => {
      setCurrent('')
      setNext('')
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    change.mutate()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Пароль</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="current-password">Текущий</Label>
            <Input id="current-password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="new-password">Новый</Label>
            <Input id="new-password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
          </div>
          <Button type="submit" className="justify-self-start" disabled={change.isPending}>
            Сменить
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function Sessions() {
  const navigate = useNavigate()
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => api.get<UserSession[]>('/auth/sessions') })
  const revoke = useAction((session: UserSession) => api.del(`/auth/sessions/${session.id}`), {
    invalidate: [['sessions']],
  })
  const logoutAll = useAction(() => api.post('/auth/logout/all'), { onSuccess: () => navigate('/login') })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Сессии</CardTitle>
        <Confirm title="Выйти на всех устройствах?" action="Выйти" onConfirm={() => logoutAll.mutate()}>
          <Button variant="outline" size="sm">
            <LogOutIcon /> Везде
          </Button>
        </Confirm>
      </CardHeader>
      <CardContent>
        {sessions.error && <p className="text-sm text-destructive">{sessions.error.message}</p>}
        <ul className="grid divide-y">
          {sessions.data?.map((session) => (
            <li key={session.id} className="flex items-center gap-2 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  {session.user_agent ?? 'неизвестно'} {session.is_current && <Badge>текущая</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {session.ip_address ?? '—'} · вход {formatDate(session.signed_in_at)} · активность {formatDate(session.last_active_at)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  revoke.mutate(session, { onSuccess: () => session.is_current && navigate('/login') })
                }
              >
                Завершить
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
