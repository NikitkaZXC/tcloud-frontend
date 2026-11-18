import { useQuery, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowUpRightIcon, LogOutIcon } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { PageTitle, StatusChip } from '@/components/fx'
import { Confirm } from '@/components/confirm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAction } from '@/hooks/use-action'
import { useCountdown, useNow } from '@/hooks/use-countdown'
import { api } from '@/lib/api'
import { activeSession, describeError, qrExpired, retryAfterOf, SESSION_ORDER } from '@/lib/auth'
import { healthChecks } from '@/lib/dashboard'
import { formatBytes, formatDate, formatDuration } from '@/lib/format'
import { t, type Key } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { Account, Health, TelegramAuthorization, TelegramSessionName, TelegramSessionState } from '@/lib/types'

const ROLES: Record<TelegramSessionName, Key> = {
  api: 'telegram.roleApi',
  upload: 'telegram.roleUpload',
  download: 'telegram.roleDownload',
}

export function TelegramPage() {
  const status = useQuery({
    queryKey: ['telegram'],
    queryFn: () => api.get<{ sessions: TelegramSessionState[] }>('/telegram'),
    refetchInterval: (query) =>
      query.state.data?.sessions.some((s) => !s.authorized && s.login && ['qr', 'starting'].includes(s.login.step)) ? 2000 : false,
  })
  const [picked, setPicked] = useState<TelegramSessionName | null>(null)
  const sessions = SESSION_ORDER.map((name) => status.data?.sessions.find((s) => s.session === name)).filter((s): s is TelegramSessionState => !!s)
  const active = activeSession(sessions, picked)
  const current = sessions.find((s) => s.session === active)
  const done = sessions.filter((s) => s.authorized).length

  return (
    <div className="grid gap-4">
      <PageTitle text="Telegram" />
      {status.error && <p className="text-destructive">{status.error.message}</p>}
      {status.data && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2">
              {t('telegram.title')}
              <span className="fx-chip text-muted-foreground tabular-nums">
                {t('telegram.sessionsDone', { done, n: sessions.length })}
              </span>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t('telegram.hint')}
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
            <ol className="grid content-start gap-1">
              {sessions.map((session, i) => (
                <StepRow
                  key={session.session}
                  state={session}
                  index={i}
                  total={sessions.length}
                  active={session.session === active}
                  onPick={() => setPicked(session.session)}
                />
              ))}
            </ol>
            {current ? (
              <LoginStep key={current.session} state={current} updatedAt={status.dataUpdatedAt} index={sessions.indexOf(current)} total={sessions.length} />
            ) : (
              <div className="grid content-center justify-items-start gap-3 text-sm">
                <StatusChip status="ok" label={t('telegram.allReady')} />
                <p>{t('telegram.allReadyHint')}</p>
                <Button asChild variant="outline" size="sm">
                  <Link to="/files">
                    {t('telegram.toStorages')} <ArrowUpRightIcon />
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <SystemCard />
        <DevicesCard />
      </div>
    </div>
  )
}

function useRefreshTelegram() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['telegram'] })
    queryClient.invalidateQueries({ queryKey: ['health'] })
  }
}

function StepRow({ state, index, total, active, onPick }: { state: TelegramSessionState; index: number; total: number; active: boolean; onPick: () => void }) {
  const refresh = useRefreshTelegram()
  const logout = useAction(() => api.post(`/telegram/${state.session}/logout`), { success: t('telegram.sessionEnded'), onSuccess: refresh })
  return (
    <li
      aria-current={active ? 'step' : undefined}
      className={cn('flex items-center gap-3 border border-transparent px-3 py-2 transition-colors', active && 'border-foreground')}
    >
      <span className="text-xs font-semibold text-muted-foreground tabular-nums">
        {index + 1} / {total}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{state.session}</p>
        <p className="truncate text-xs text-muted-foreground">{t(ROLES[state.session])}</p>
      </div>
      {state.authorized ? (
        <>
          <StatusChip status="ok" label={t('telegram.signedIn')} />
          <Confirm title={t('telegram.logoutQ', { session: state.session })} action={t('nav.logout')} onConfirm={() => logout.mutate()}>
            <Button variant="ghost" size="icon-sm" aria-label={t('telegram.logout', { session: state.session })}>
              <LogOutIcon />
            </Button>
          </Confirm>
        </>
      ) : active ? (
        <StatusChip status="wait" label={t('telegram.now')} />
      ) : (
        <Button variant="ghost" size="sm" onClick={onPick}>
          {t('onboarding.signIn')}
        </Button>
      )}
    </li>
  )
}

function LoginStep({ state, updatedAt, index, total }: { state: TelegramSessionState; updatedAt: number; index: number; total: number }) {
  const name = state.session
  const refresh = useRefreshTelegram()
  const step = state.login?.step
  const [mode, setMode] = useState<'qr' | 'phone'>(step === 'code' ? 'phone' : 'qr')
  const [qr, setQr] = useState<{ url: string; expires_at: string; at: number } | null>(null)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [floodUntil, setFloodUntil] = useState<number | null>(null)
  const [stopped, setStopped] = useState(false)
  const requesting = useRef(false)
  const wait = useCountdown(floodUntil)
  const now = useNow(true)
  const qrLeft = qr ? Math.max(Math.ceil((Date.parse(qr.expires_at) - now) / 1000), 0) : 0

  const guard =
    <T,>(fn: () => Promise<T>) =>
    () =>
      fn().catch((error) => {
        const retry = retryAfterOf(error)
        if (retry) setFloodUntil(Date.now() + retry * 1000)
        throw error
      })

  const startQr = useAction(guard(() => api.post<{ url: string; expires_at: string }>(`/telegram/${name}/qr`)), {
    onSuccess: (r) => {
      setQr({ ...r, at: Date.now() })
      setStopped(false)
      refresh()
    },
  })
  const sendCode = useAction(guard(() => api.post(`/telegram/${name}/code`, { phone })), { onSuccess: refresh })
  const signIn = useAction(() => api.post(`/telegram/${name}/sign-in`, { code }), { onSuccess: refresh })
  const sendPassword = useAction(() => api.post(`/telegram/${name}/password`, { password }), {
    onSuccess: () => {
      setPassword('')
      refresh()
    },
  })

  const needQr =
    mode === 'qr' &&
    step !== 'password' &&
    (!qr || qrLeft === 0 || (updatedAt > qr.at && (step === 'code' || qrExpired(state.login, qr.expires_at, now))))
  const auto = needQr && !stopped && wait === 0

  useEffect(() => {
    if (!auto || requesting.current) return
    requesting.current = true
    startQr.mutate(undefined, {
      onError: () => setStopped(true),
      onSettled: () => {
        requesting.current = false
      },
    })
  }, [auto, startQr])

  const submit = (fn: () => void) => (event: FormEvent) => {
    event.preventDefault()
    fn()
  }
  const loginError = state.login?.error && state.login.error.code !== 'login_expired' ? describeError(state.login.error) : ''

  return (
    <section aria-label={t('telegram.stepAria', { step: index + 1, total, name })} className="grid content-start gap-3">
      <p className="text-xs text-muted-foreground">
        {t('telegram.step', { step: index + 1, total })} <span className="font-semibold text-primary">{name}</span>
      </p>
      {loginError && <p className="text-sm text-destructive" role="alert">{loginError}</p>}
      {wait > 0 && (
        <p className="text-xs font-semibold text-warning" role="status">
          {t('telegram.flood', { time: formatDuration(wait) })}
        </p>
      )}
      {step === 'password' ? (
        <form onSubmit={submit(() => sendPassword.mutate())} className="grid gap-2">
          <Label htmlFor="tg-password">{t('telegram.password')}</Label>
          <div className="flex gap-2">
            <Input id="tg-password" type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Button type="submit" disabled={sendPassword.isPending}>{t('telegram.send')}</Button>
          </div>
        </form>
      ) : (
        <>
          <div role="tablist" aria-label={t('telegram.method')} className="flex gap-1">
            {(['qr', 'phone'] as const).map((value) => (
              <Button
                key={value}
                role="tab"
                aria-selected={mode === value}
                variant={mode === value ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setMode(value)
                  setStopped(false)
                }}
              >
                {t(value === 'qr' ? 'telegram.qr' : 'telegram.code')}
              </Button>
            ))}
          </div>
          {mode === 'qr' ? (
            <div className="grid justify-items-start gap-2">
              {qr && qrLeft > 0 && !needQr ? (
                <div className="grid justify-items-center gap-2 bg-white p-4">
                  <QRCodeSVG value={qr.url} size={192} />
                  <p className="text-center text-xs text-neutral-600">{t('telegram.qrPath')}</p>
                  <p className="text-xs text-neutral-600 tabular-nums">{t('telegram.qrRefresh', { n: qrLeft })}</p>
                </div>
              ) : (
                <StatusChip status={stopped ? 'fail' : 'wait'} label={t(stopped ? 'telegram.qrFailed' : 'telegram.qrLoading')} />
              )}
              {stopped && (
                <Button onClick={() => startQr.mutate()} disabled={startQr.isPending || wait > 0}>
                  {t('telegram.newQr')}
                </Button>
              )}
            </div>
          ) : step === 'code' ? (
            <form onSubmit={submit(() => signIn.mutate())} className="grid gap-2">
              <Label htmlFor="tg-code">{t('telegram.codeLabel')}</Label>
              <div className="flex gap-2">
                <Input id="tg-code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" autoFocus required />
                <Button type="submit" disabled={signIn.isPending}>{t('onboarding.signIn')}</Button>
              </div>
              <Button type="button" variant="link" className="justify-self-start px-0" onClick={() => sendCode.mutate()} disabled={!phone || sendCode.isPending || wait > 0}>
                {t('telegram.resend')}
              </Button>
            </form>
          ) : (
            <form onSubmit={submit(() => sendCode.mutate())} className="grid gap-2">
              <Label htmlFor="tg-phone">{t('telegram.phone')}</Label>
              <div className="flex gap-2">
                <Input id="tg-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+79991234567" type="tel" autoComplete="tel" required />
                <Button type="submit" disabled={sendCode.isPending || wait > 0}>{t('telegram.getCode')}</Button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  )
}

function SystemCard() {
  const health = useQuery({ queryKey: ['health'], queryFn: () => api.get<Health>('/health'), refetchInterval: 15000 })
  const account = useQuery({ queryKey: ['account'], queryFn: () => api.get<Account>('/account'), retry: false })
  const checks = health.data ? healthChecks(health.data) : []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {t('dashboard.system')} {health.data && <Badge variant={health.data.ok ? 'default' : 'destructive'}>{health.data.ok ? 'ok' : t('telegram.problems')}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <div className="flex flex-wrap gap-1.5">
          {checks.map(([name, ok]) => (
            <Badge key={name} variant={ok ? 'secondary' : 'destructive'}>
              {name}
            </Badge>
          ))}
        </div>
        {account.data && (
          <p className="text-muted-foreground">
            Premium: {t(account.data.premium ? 'common.yes' : 'common.no')} · {t('dashboard.fileLimit')} {formatBytes(account.data.file_limit)}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function DevicesCard() {
  const devices = useQuery({ queryKey: ['telegram-devices'], queryFn: () => api.get<TelegramAuthorization[]>('/telegram/sessions'), retry: false })
  const revoke = useAction((id: string) => api.del(`/telegram/sessions/${id}`), {
    invalidate: [['telegram-devices']],
    success: t('telegram.deviceRevoked'),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('telegram.devices')}</CardTitle>
      </CardHeader>
      <CardContent>
        {devices.error && <p className="text-sm text-muted-foreground">{devices.error.message}</p>}
        <ul className="grid divide-y">
          {devices.data?.map((device) => (
            <li key={device.id} className="flex items-center gap-2 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p>
                  {device.session} {device.current && <Badge>{t('telegram.currentDevice')}</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {device.ip} {device.country} · {t('account.active', { date: formatDate(device.active_at) })}
                </p>
              </div>
              {!device.current && (
                <Confirm title={t('telegram.revokeQ')} action={t('telegram.revoke')} onConfirm={() => revoke.mutate(device.id)}>
                  <Button variant="ghost" size="sm">{t('telegram.revoke')}</Button>
                </Confirm>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
