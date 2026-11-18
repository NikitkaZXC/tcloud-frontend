import { useQueryClient } from '@tanstack/react-query'
import { EyeIcon, EyeOffIcon, TriangleAlertIcon } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { StatusLight, StorageIcon, WireCubes } from '@/components/fx'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCountdown } from '@/hooks/use-countdown'
import { api } from '@/lib/api'
import { describeError, retryAfterOf } from '@/lib/auth'
import { formatDuration } from '@/lib/format'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [shown, setShown] = useState(false)
  const [caps, setCaps] = useState(false)
  const [error, setError] = useState('')
  const [until, setUntil] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const wait = useCountdown(until)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setUntil(null)
    try {
      await api.post('/auth/signin', { login, password })
      queryClient.clear()
      navigate((location.state as { from?: string } | null)?.from ?? '/', { replace: true })
    } catch (e) {
      setError(describeError(e))
      const retry = retryAfterOf(e)
      if (retry) setUntil(Date.now() + retry * 1000)
    } finally {
      setBusy(false)
    }
  }

  const onKey = (event: KeyboardEvent) => setCaps(event.getModifierState('CapsLock'))

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="fx-page flex w-full max-w-sm items-end justify-between gap-4">
        <p className="fx-pixel text-[50px] uppercase sm:text-[70px]" aria-hidden>
          tcloud
        </p>
        <StorageIcon scale={3} className="mb-2 text-muted-foreground" />
      </div>
      <WireCubes className="pointer-events-none fixed top-8 right-8 hidden w-72 lg:block" />
      <div className="w-full max-w-sm">
        <Card className="fx-page w-full gap-6 [--card-spacing:--spacing(7)]">
          <CardHeader className="gap-2">
            <CardTitle className="text-base">Вход</CardTitle>
            <p className="text-sm text-muted-foreground">Файловое хранилище в Telegram</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-4" aria-busy={busy}>
              <div className="grid gap-2">
                <Label htmlFor="login">Логин</Label>
                <Input id="login" autoComplete="username" autoFocus value={login} onChange={(e) => setLogin(e.target.value)} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Пароль</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={shown ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={onKey}
                    onKeyUp={onKey}
                    onBlur={() => setCaps(false)}
                    className="pr-9"
                    aria-describedby={caps ? 'caps' : undefined}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute top-1/2 right-1 -translate-y-1/2"
                    onClick={() => setShown(!shown)}
                    aria-label={shown ? 'Скрыть пароль' : 'Показать пароль'}
                    aria-pressed={shown}
                  >
                    {shown ? <EyeOffIcon /> : <EyeIcon />}
                  </Button>
                </div>
                {caps && (
                  <p id="caps" className="flex items-center gap-1.5 text-xs font-semibold text-warning">
                    <TriangleAlertIcon className="size-3.5" /> включён Caps Lock
                  </p>
                )}
              </div>
              {error && (
                <div className="fx-well grid gap-1 px-4 py-3 text-sm" role="alert">
                  <p className="flex items-center gap-2 font-semibold text-destructive">
                    <StatusLight ok={false} /> {error}
                  </p>
                  {wait > 0 && <p className="text-xs text-muted-foreground tabular-nums">повторите через {formatDuration(wait)}</p>}
                </div>
              )}
              <Button type="submit" size="lg" className="mt-1 h-11" disabled={busy || wait > 0}>
                {busy ? 'Вход…' : wait > 0 ? `Подождите ${formatDuration(wait)}` : 'Войти'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
