import { useQuery, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { LogOutIcon } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { PageTitle, TermStatus } from '@/components/fx'
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
import { cn } from '@/lib/utils'
import type { Account, Health, TelegramAuthorization, TelegramSessionName, TelegramSessionState } from '@/lib/types'

const ROLES: Record<TelegramSessionName, string> = {
  api: 'каналы, удаление, события',
  upload: 'отправка файлов воркером',
  download: 'скачивание файлов',
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
              Вход в Telegram
              <span className="font-mono text-xs font-normal text-muted-foreground normal-case">
                {done} / {sessions.length} сессий
              </span>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              tcloud держит три отдельных устройства Telegram, в каждое входят отдельно. Готовые шаги пропускаются, следующий начинается сам.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[16rem_minmax(0,1fr)]">
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
              <LoginStep key={current.session} state={current} index={sessions.indexOf(current)} total={sessions.length} />
            ) : (
              <div className="grid content-center justify-items-start gap-2 font-mono text-sm">
                <TermStatus status="ok" />
                <p>Все сессии авторизованы — можно создавать хранилища и загружать файлы.</p>
                <Link to="/files" className="text-primary hover:underline">&gt; к хранилищам</Link>
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
  const logout = useAction(() => api.post(`/telegram/${state.session}/logout`), { success: 'Сессия завершена', onSuccess: refresh })
  return (
    <li
      aria-current={active ? 'step' : undefined}
      className={cn('flex items-center gap-2 border-l-2 border-transparent px-2 py-1.5', active && 'fx-neon border-primary bg-muted')}
    >
      <span className="font-mono text-xs text-muted-foreground">
        {index + 1} / {total}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-sm">{state.session}</p>
        <p className="truncate text-xs text-muted-foreground">{ROLES[state.session]}</p>
      </div>
      {state.authorized ? (
        <>
          <TermStatus status="ok" />
          <Confirm title={`Выйти из сессии ${state.session}?`} action="Выйти" onConfirm={() => logout.mutate()}>
            <Button variant="ghost" size="icon-sm" aria-label={`Выйти из сессии ${state.session}`}>
              <LogOutIcon />
            </Button>
          </Confirm>
        </>
      ) : active ? (
        <TermStatus status="wait" />
      ) : (
        <Button variant="ghost" size="sm" onClick={onPick}>
          Войти
        </Button>
      )}
    </li>
  )
}

function LoginStep({ state, index, total }: { state: TelegramSessionState; index: number; total: number }) {
  const name = state.session
  const refresh = useRefreshTelegram()
  const step = state.login?.step
  const [mode, setMode] = useState<'qr' | 'phone'>(step === 'code' ? 'phone' : 'qr')
  const [qr, setQr] = useState<{ url: string; expires_at: string } | null>(null)
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
      setQr(r)
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
    mode === 'qr' && step !== 'password' && (step === 'code' || !qr || qrLeft === 0 || qrExpired(state.login, qr.expires_at, now))
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
    <section aria-label={`Шаг ${index + 1} из ${total}: ${name}`} className="grid content-start gap-3">
      <p className="font-mono text-xs text-muted-foreground">
        &gt; шаг {index + 1} / {total} · сессия <span className="text-primary">{name}</span>
      </p>
      {loginError && <p className="text-sm text-destructive" role="alert">{loginError}</p>}
      {wait > 0 && (
        <p className="font-mono text-xs text-neon-yellow" role="status">
          flood_wait: Telegram просит подождать {formatDuration(wait)}
        </p>
      )}
      {step === 'password' ? (
        <form onSubmit={submit(() => sendPassword.mutate())} className="grid gap-2">
          <Label htmlFor="tg-password">Пароль двухэтапной проверки</Label>
          <div className="flex gap-2">
            <Input id="tg-password" type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Button type="submit" disabled={sendPassword.isPending}>Отправить</Button>
          </div>
        </form>
      ) : (
        <>
          <div role="tablist" aria-label="Способ входа" className="flex gap-1">
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
                {value === 'qr' ? 'QR-код' : 'Код по номеру'}
              </Button>
            ))}
          </div>
          {mode === 'qr' ? (
            <div className="grid justify-items-start gap-2">
              {qr && step === 'qr' && qrLeft > 0 ? (
                <div className="grid justify-items-center gap-2 rounded-lg bg-white p-4">
                  <QRCodeSVG value={qr.url} size={192} />
                  <p className="text-center text-xs text-neutral-600">Telegram → Настройки → Устройства → Подключить устройство</p>
                  <p className="font-mono text-xs text-neutral-500">обновится через {qrLeft} с</p>
                </div>
              ) : (
                <p className="fx-cursor font-mono text-xs text-muted-foreground">{stopped ? '> QR не получен' : '> запрашиваю QR'}</p>
              )}
              {stopped && (
                <Button onClick={() => startQr.mutate()} disabled={startQr.isPending || wait > 0}>
                  Новый QR
                </Button>
              )}
            </div>
          ) : step === 'code' ? (
            <form onSubmit={submit(() => signIn.mutate())} className="grid gap-2">
              <Label htmlFor="tg-code">Код из приложения Telegram (чат «Telegram»)</Label>
              <div className="flex gap-2">
                <Input id="tg-code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" autoFocus required />
                <Button type="submit" disabled={signIn.isPending}>Войти</Button>
              </div>
              <Button type="button" variant="link" className="justify-self-start px-0" onClick={() => sendCode.mutate()} disabled={!phone || sendCode.isPending || wait > 0}>
                Прислать код ещё раз
              </Button>
            </form>
          ) : (
            <form onSubmit={submit(() => sendCode.mutate())} className="grid gap-2">
              <Label htmlFor="tg-phone">Номер телефона</Label>
              <div className="flex gap-2">
                <Input id="tg-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+79991234567" type="tel" autoComplete="tel" required />
                <Button type="submit" disabled={sendCode.isPending || wait > 0}>Получить код</Button>
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
          Система {health.data && <Badge variant={health.data.ok ? 'default' : 'destructive'}>{health.data.ok ? 'ok' : 'есть проблемы'}</Badge>}
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
            Premium: {account.data.premium ? 'да' : 'нет'} · лимит файла {formatBytes(account.data.file_limit)}
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
    success: 'Устройство отключено',
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Устройства tcloud в Telegram</CardTitle>
      </CardHeader>
      <CardContent>
        {devices.error && <p className="text-sm text-muted-foreground">{devices.error.message}</p>}
        <ul className="grid divide-y">
          {devices.data?.map((device) => (
            <li key={device.id} className="flex items-center gap-2 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p>
                  {device.session} {device.current && <Badge>текущее</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {device.ip} {device.country} · активность {formatDate(device.active_at)}
                </p>
              </div>
              {!device.current && (
                <Confirm title="Отключить устройство?" action="Отключить" onConfirm={() => revoke.mutate(device.id)}>
                  <Button variant="ghost" size="sm">Отключить</Button>
                </Confirm>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
