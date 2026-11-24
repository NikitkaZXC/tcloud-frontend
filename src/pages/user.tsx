import { useQuery } from '@tanstack/react-query'
import { ArrowLeftIcon, Trash2Icon, XIcon } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { PageTitle, PixelToggle } from '@/components/fx'
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
import { useAction } from '@/hooks/use-action'
import { useMe } from '@/hooks/use-me'
import { useStorages } from '@/hooks/use-storages'
import { api } from '@/lib/api'
import { humanPath, storageName } from '@/lib/names'
import { formatBytes, formatShortDate } from '@/lib/format'
import type { Grant, Role, UploadSession, User } from '@/lib/types'
import { t } from '@/lib/i18n'

export function UserPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: me } = useMe()
  const user = useQuery({ queryKey: ['user', id], queryFn: () => api.get<User>(`/users/${id}`) })
  const invalidate = [['user', id], ['users']]

  const update = useAction((data: Partial<{ role: Role; blocked: boolean; password: string }>) => api.patch<User>(`/users/${id}`, data), {
    invalidate,
    success: t('user.saved'),
  })
  const remove = useAction(() => api.del(`/users/${id}`), {
    invalidate: [['users']],
    success: t('user.deleted'),
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
          <Link to="/users" aria-label={t('common.back')}>
            <ArrowLeftIcon />
          </Link>
        </Button>
        <PageTitle text={u.login} className="normal-case" />
        <Badge variant="outline">{u.role}</Badge>
        {u.blocked && <Badge variant="destructive">{t('users.blocked')}</Badge>}
        <span className="text-sm text-muted-foreground">{t('user.lastLogin', { date: formatShortDate(u.last_login_at) })}</span>
        {managed && (
          <Confirm title={t('user.deleteQ', { login: u.login })} description={t('user.deleteHint')} onConfirm={() => remove.mutate()}>
            <Button variant="destructive" className="ml-auto">
              <Trash2Icon /> {t('common.delete')}
            </Button>
          </Confirm>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {managed && (
          <Card>
            <CardHeader>
              <CardTitle>{t('user.manage')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex items-center gap-3 text-sm">
                <PixelToggle checked={u.blocked} onChange={(blocked) => update.mutate({ blocked })} labelledBy="user-blocked" />
                <span id="user-blocked">{t('user.blockedToggle')}</span>
              </div>
              {me?.role === 'root' && (
                <div className="grid gap-1.5">
                  <Label>{t('users.role')}</Label>
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
                <Label htmlFor="reset-password">{t('user.newPassword')}</Label>
                <div className="flex gap-2">
                  <Input id="reset-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  <Button type="submit" variant="outline" disabled={update.isPending}>
                    {t('user.reset')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
        {u.role === 'user' && <Grants userId={id} />}
        <ApiKeys userId={id} />
        {managed && (me?.role === 'root' || u.role === 'user') && <UploadSessions userId={id} />}
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
    { invalidate: [key], success: t('user.granted'), onSuccess: () => setFolder('') },
  )
  const revoke = useAction((grant: Grant) => api.del(`/users/${userId}/grants/${grant.id}`), {
    invalidate: [key],
    success: t('user.revoked'),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    put.mutate()
  }

  const labels: [keyof typeof flags, string][] = [
    ['recursive', t('grants.recursive')],
    ['can_read', t('grants.read')],
    ['can_upload', t('grants.upload')],
    ['can_delete', t('grants.delete')],
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('user.folderAccess')}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {grants.error && <p className="text-sm text-destructive">{grants.error.message}</p>}
        {grants.data && <GrantList grants={grants.data} onRevoke={(grant) => revoke.mutate(grant)} />}
        <form onSubmit={submit} className="grid gap-3 border-t pt-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Select value={storageId} onValueChange={setStorageId} required>
              <SelectTrigger className="w-full"><SelectValue placeholder={t('scope.storage')} /></SelectTrigger>
              <SelectContent>
                {storages.data?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {storageName(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder={t('user.folderPlaceholder')} />
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
            {t('user.grant')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function UploadSessions({ userId }: { userId: string }) {
  const key = ['upload-sessions', userId]
  const sessions = useQuery({ queryKey: key, queryFn: () => api.get<UploadSession[]>('/uploads/sessions', { user_id: userId }) })
  const storages = useStorages()
  const cancel = useAction((session: UploadSession) => api.del(`/uploads/sessions/${session.session_id}`), {
    invalidate: [key],
    success: t('user.uploadCancelled'),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('user.uploads')}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {sessions.error && <p className="text-sm text-destructive">{sessions.error.message}</p>}
        {sessions.data?.length === 0 && <p className="text-sm text-muted-foreground">{t('user.uploadsNone')}</p>}
        {sessions.data?.map((session) => (
          <div key={session.session_id} className="flex items-center gap-2 text-sm">
            <div className="grid min-w-0 flex-1">
              <span className="truncate">{humanPath(session.path, storages.data ?? [])}</span>
              <span className="text-xs text-muted-foreground">
                {formatBytes(session.offset)} / {formatBytes(session.size)} · {t('user.uploadExpires', { date: formatShortDate(session.expires_at) })}
              </span>
            </div>
            <Confirm title={t('user.uploadCancelQ')} description={t('user.uploadCancelHint')} onConfirm={() => cancel.mutate(session)}>
              <Button variant="ghost" size="icon-sm" aria-label={t('common.cancel')}>
                <XIcon />
              </Button>
            </Confirm>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
