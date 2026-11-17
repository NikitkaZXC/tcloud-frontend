import { useQueryClient } from '@tanstack/react-query'
import { CloudIcon } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, errorMessage } from '@/lib/api'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.post('/auth/signin', { login, password })
      queryClient.clear()
      navigate((location.state as { from?: string } | null)?.from ?? '/', { replace: true })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="fx-page w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CloudIcon className="size-5 text-primary drop-shadow-[0_0_6px_var(--primary)]" />
            <span className="fx-glitch fx-cursor font-bold tracking-widest">tcloud</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="login">Логин</Label>
              <Input id="login" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button type="submit" disabled={busy}>
              Войти
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
