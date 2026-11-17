import { useQuery, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { type FormEvent, useState } from 'react'
import { PageTitle } from '@/components/fx'
import { Confirm } from '@/components/confirm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAction } from '@/hooks/use-action'
import { api } from '@/lib/api'
import { healthChecks } from '@/lib/dashboard'
import { formatBytes, formatDate } from '@/lib/format'
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

  return (
    <div className="grid gap-4">
      <PageTitle text="Telegram" />
      {status.error && <p className="text-destructive">{status.error.message}</p>}
      <div className="grid gap-4 lg:grid-cols-3">
        {status.data?.sessions.map((session) => <SessionCard key={session.session} state={session} />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SystemCard />
        <DevicesCard />
      </div>
    </div>
  )
}

function SessionCard({ state }: { state: TelegramSessionState }) {
  const queryClient = useQueryClient()
  const name = state.session
  const [qr, setQr] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['telegram'] })
    queryClient.invalidateQueries({ queryKey: ['health'] })
  }

  const startQr = useAction(() => api.post<{ url: string }>(`/telegram/${name}/qr`), {
    onSuccess: (r) => {
      setQr(r.url)
      refresh()
    },
  })
  const sendCode = useAction(() => api.post(`/telegram/${name}/code`, { phone }), { onSuccess: refresh })
  const signIn = useAction(() => api.post(`/telegram/${name}/sign-in`, { code }), { onSuccess: refresh })
  const sendPassword = useAction(() => api.post(`/telegram/${name}/password`, { password }), {
    onSuccess: () => {
      setPassword('')
      refresh()
    },
  })
  const logout = useAction(() => api.post(`/telegram/${name}/logout`), { success: 'Сессия завершена', onSuccess: refresh })

  const step = state.authorized ? null : state.login?.step
  const submit = (fn: () => void) => (event: FormEvent) => {
    event.preventDefault()
    fn()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {name}
          <Badge variant={state.authorized ? 'default' : 'outline'}>{state.authorized ? 'вошли' : 'не вошли'}</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{ROLES[name]}</p>
      </CardHeader>
      <CardContent className="grid gap-3">
        {state.authorized ? (
          <Confirm title={`Выйти из сессии ${name}?`} action="Выйти" onConfirm={() => logout.mutate()}>
            <Button variant="outline" className="justify-self-start">
              Выйти
            </Button>
          </Confirm>
        ) : (
          <>
            {state.login?.error && <p className="text-sm text-destructive">{String(state.login.error.message)}</p>}
            {step === 'qr' && qr && (
              <div className="grid justify-items-center gap-2 rounded-lg bg-white p-4">
                <QRCodeSVG value={qr} size={192} />
                <p className="text-center text-xs text-neutral-600">Telegram → Настройки → Устройства → Подключить устройство</p>
              </div>
            )}
            {step === 'code' && (
              <form onSubmit={submit(() => signIn.mutate())} className="flex gap-2">
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Код из Telegram" inputMode="numeric" required />
                <Button type="submit" disabled={signIn.isPending}>Войти</Button>
              </form>
            )}
            {step === 'password' && (
              <form onSubmit={submit(() => sendPassword.mutate())} className="flex gap-2">
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль 2FA" required />
                <Button type="submit" disabled={sendPassword.isPending}>Отправить</Button>
              </form>
            )}
            {step !== 'password' && step !== 'code' && (
              <div className="grid gap-2">
                <Button onClick={() => startQr.mutate()} disabled={startQr.isPending}>
                  {step === 'qr' ? 'Новый QR' : 'Войти по QR'}
                </Button>
                <form onSubmit={submit(() => sendCode.mutate())} className="flex gap-2">
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+79991234567" type="tel" required />
                  <Button type="submit" variant="outline" disabled={sendCode.isPending}>Код</Button>
                </form>
              </div>
            )}
            {(step === 'code' || step === 'password') && (
              <Button variant="link" className="justify-self-start px-0" onClick={() => startQr.mutate()}>
                Начать заново по QR
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
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
