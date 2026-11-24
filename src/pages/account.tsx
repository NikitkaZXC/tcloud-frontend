import { useQuery } from '@tanstack/react-query'
import { LogOutIcon } from 'lucide-react'
import { type FormEvent, useState } from 'react'
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
import { isAdmin, logout, useMe, useSignedOut } from '@/hooks/use-me'
import { api, errorMessage } from '@/lib/api'
import { formatShortDate } from '@/lib/format'
import type { UserSession } from '@/lib/types'
import { t } from '@/lib/i18n'

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
              <CardTitle>{t('account.grants')}</CardTitle>
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
    success: t('account.passwordChanged'),
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
        <CardTitle>{t('login.password')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="current-password">{t('account.current')}</Label>
            <Input id="current-password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="new-password">{t('account.new')}</Label>
            <Input id="new-password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
          </div>
          <Button type="submit" className="justify-self-start" disabled={change.isPending}>
            {t('account.change')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function Sessions() {
  const signedOut = useSignedOut()
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => api.get<UserSession[]>('/auth/sessions') })
  const revoke = useAction((session: UserSession) => api.del(`/auth/sessions/${session.id}`), {
    invalidate: [['sessions']],
  })
  const logoutAll = useAction(() => logout('/auth/logout/all'), { onSuccess: signedOut })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t('account.sessions')}</CardTitle>
        <Confirm title={t('account.logoutAllQ')} action={t('nav.logout')} onConfirm={() => logoutAll.mutate()}>
          <Button variant="outline" size="sm">
            <LogOutIcon /> {t('account.everywhere')}
          </Button>
        </Confirm>
      </CardHeader>
      <CardContent>
        {sessions.error && <p className="text-sm text-destructive">{errorMessage(sessions.error)}</p>}
        <ul className="grid divide-y">
          {sessions.data?.map((session) => (
            <li key={session.id} className="flex items-center gap-2 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2">
                  <span className="truncate" title={session.user_agent ?? undefined}>{session.user_agent ?? t('account.unknown')}</span>
                  {session.is_current && <Badge>{t('account.currentSession')}</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {session.ip_address ?? '—'} · {t('account.signedIn', { date: formatShortDate(session.signed_in_at) })} · {t('account.active', { date: formatShortDate(session.last_active_at) })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  revoke.mutate(session, { onSuccess: () => session.is_current && signedOut() })
                }
              >
                {t('account.end')}
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
