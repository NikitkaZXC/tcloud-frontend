import { useQuery } from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router'
import { PageTitle } from '@/components/fx'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAction } from '@/hooks/use-action'
import { useMe } from '@/hooks/use-me'
import { api, errorMessage } from '@/lib/api'
import { formatDate, formatShortDate } from '@/lib/format'
import type { Role, User } from '@/lib/types'
import { t } from '@/lib/i18n'

export function UsersPage() {
  const users = useQuery({ queryKey: ['users'], queryFn: () => api.get<User[]>('/users') })

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <PageTitle text={t('nav.users')} />
        <CreateUser />
      </div>
      {users.error && <p className="text-destructive">{errorMessage(users.error)}</p>}
      {users.data && (
        <div className="overflow-hidden rounded-xl border">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead>{t('login.login')}</TableHead>
                <TableHead className="w-24">{t('users.role')}</TableHead>
                <TableHead className="hidden w-48 sm:table-cell">{t('users.lastLogin')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link to={`/users/${user.id}`} className="truncate text-foreground hover:underline" title={user.login}>
                        {user.login}
                      </Link>
                      {user.blocked && <Badge variant="destructive">{t('users.blocked')}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.role}</Badge>
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground tabular-nums sm:table-cell" title={formatDate(user.last_login_at)}>{formatShortDate(user.last_login_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function CreateUser() {
  const { data: me } = useMe()
  const [open, setOpen] = useState(false)
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('user')
  const create = useAction(() => api.post<User>('/users', { login, password, role }), {
    invalidate: [['users']],
    success: t('users.created'),
    onSuccess: () => {
      setOpen(false)
      setLogin('')
      setPassword('')
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    create.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon /> {t('common.create')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('users.new')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="new-login">{t('login.login')}</Label>
            <Input id="new-login" value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="off" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="new-user-password">{t('login.password')}</Label>
            <Input id="new-user-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {me?.role === 'root' && (
            <div className="grid gap-1.5">
              <Label>{t('users.role')}</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">user</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {t('common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
