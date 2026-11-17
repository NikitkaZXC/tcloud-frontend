import { useQuery } from '@tanstack/react-query'
import { ArrowLeftIcon, Trash2Icon } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { PageTitle } from '@/components/fx'
import { ApiKeys } from '@/components/api-keys'
import { Confirm } from '@/components/confirm'
import { GrantList } from '@/components/grants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useAction } from '@/hooks/use-action'
import { useMe } from '@/hooks/use-me'
import { useStorages } from '@/hooks/use-storages'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/format'
import type { Grant, Role, User } from '@/lib/types'

export function UserPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: me } = useMe()
  const user = useQuery({ queryKey: ['user', id], queryFn: () => api.get<User>(`/users/${id}`) })
  const invalidate = [['user', id], ['users']]

  const update = useAction((data: Partial<{ role: Role; blocked: boolean; password: string }>) => api.patch<User>(`/users/${id}`, data), {
    invalidate,
    success: 'Сохранено, сессии пользователя завершены',
  })
  const remove = useAction(() => api.del(`/users/${id}`), {
    invalidate: [['users']],
    success: 'Пользователь удалён',
    onSuccess: () => navigate('/users'),
  })
  const [password, setPassword] = useState('')

  if (user.error) return <p className="text-destructive">{user.error.message}</p>
  if (!user.data) return null
  const u = user.data
  const managed = u.role !== 'root'

  function resetPassword(event: FormEvent) {
    event.preventDefault()
    update.mutate({ password }, { onSuccess: () => setPassword('') })
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/users" aria-label="Назад">
            <ArrowLeftIcon />
          </Link>
        </Button>
        <PageTitle text={u.login} className="normal-case" />
        <Badge variant="outline">{u.role}</Badge>
        {u.blocked && <Badge variant="destructive">заблокирован</Badge>}
        <span className="text-sm text-muted-foreground">последний вход: {formatDate(u.last_login_at)}</span>
        {managed && (
          <Confirm title={`Удалить ${u.login}?`} description="Доступы, ключи и сессии тоже будут удалены." onConfirm={() => remove.mutate()}>
            <Button variant="destructive" className="ml-auto">
              <Trash2Icon /> Удалить
            </Button>
          </Confirm>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {managed && (
          <Card>
            <CardHeader>
              <CardTitle>Управление</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={u.blocked} onCheckedChange={(blocked) => update.mutate({ blocked })} />
                Заблокирован
              </label>
              {me?.role === 'root' && (
                <div className="grid gap-1.5">
                  <Label>Роль</Label>
                  <Select value={u.role} onValueChange={(role) => update.mutate({ role: role as Role })}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">user</SelectItem>
                      <SelectItem value="admin">admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <form onSubmit={resetPassword} className="grid gap-1.5">
                <Label htmlFor="reset-password">Новый пароль</Label>
                <div className="flex gap-2">
                  <Input id="reset-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  <Button type="submit" variant="outline" disabled={update.isPending}>
                    Сбросить
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
        {u.role === 'user' && <Grants userId={id} />}
        <ApiKeys userId={id} />
      </div>
    </div>
  )
}

function Grants({ userId }: { userId: string }) {
  const key = ['grants', userId]
  const grants = useQuery({ queryKey: key, queryFn: () => api.get<Grant[]>(`/users/${userId}/grants`) })
  const storages = useStorages()
  const [storageId, setStorageId] = useState('')
  const [folder, setFolder] = useState('')
  const [flags, setFlags] = useState({ recursive: true, can_read: true, can_upload: false, can_delete: false })

  const put = useAction(
    () => api.put<Grant>(`/users/${userId}/grants`, { path: ['tcloud', storageId, folder.replace(/^\/+|\/+$/g, '')].filter(Boolean).join('/'), ...flags }),
    { invalidate: [key], success: 'Доступ выдан', onSuccess: () => setFolder('') },
  )
  const revoke = useAction((grant: Grant) => api.del(`/users/${userId}/grants/${grant.id}`), {
    invalidate: [key],
    success: 'Доступ забран',
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    put.mutate()
  }

  const labels: [keyof typeof flags, string][] = [
    ['recursive', 'с подпапками'],
    ['can_read', 'чтение'],
    ['can_upload', 'загрузка'],
    ['can_delete', 'удаление'],
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Доступ к папкам</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {grants.error && <p className="text-sm text-destructive">{grants.error.message}</p>}
        {grants.data && <GrantList grants={grants.data} onRevoke={(grant) => revoke.mutate(grant)} />}
        <form onSubmit={submit} className="grid gap-3 border-t pt-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Select value={storageId} onValueChange={setStorageId} required>
              <SelectTrigger className="w-full"><SelectValue placeholder="Хранилище" /></SelectTrigger>
              <SelectContent>
                {storages.data?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name ?? s.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Папка (пусто — всё хранилище)" />
          </div>
          <div className="flex flex-wrap gap-4">
            {labels.map(([flag, label]) => (
              <label key={flag} className="flex items-center gap-2 text-sm">
                <Checkbox checked={flags[flag]} onCheckedChange={(v) => setFlags({ ...flags, [flag]: v === true })} />
                {label}
              </label>
            ))}
          </div>
          <Button type="submit" className="justify-self-start" disabled={!storageId || put.isPending}>
            Выдать доступ
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
