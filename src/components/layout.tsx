import { useQueryClient } from '@tanstack/react-query'
import { CloudIcon, FolderIcon, KeyRoundIcon, ListChecksIcon, LogOutIcon, SendIcon, UsersIcon } from 'lucide-react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { TaskWatcher } from '@/components/task-watcher'
import { Button } from '@/components/ui/button'
import { isAdmin, useMe } from '@/hooks/use-me'
import { ApiError, api } from '@/lib/api'
import { cn } from '@/lib/utils'

export function Layout() {
  const me = useMe()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  if (me.error instanceof ApiError && me.error.status === 401) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  if (me.isPending) return <div className="p-8 text-muted-foreground">Загрузка…</div>
  if (me.error) return <div className="p-8 text-destructive">{me.error.message}</div>

  const links = [
    { to: '/files', label: 'Файлы', icon: FolderIcon, show: true },
    { to: '/tasks', label: 'Задачи', icon: ListChecksIcon, show: true },
    { to: '/users', label: 'Пользователи', icon: UsersIcon, show: isAdmin(me.data) },
    { to: '/telegram', label: 'Telegram', icon: SendIcon, show: me.data.role === 'root' },
    { to: '/account', label: 'Аккаунт', icon: KeyRoundIcon, show: true },
  ]

  async function logout() {
    await api.post('/auth/logout').catch(() => undefined)
    queryClient.clear()
    navigate('/login')
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-2">
          <CloudIcon className="mr-2 size-5 shrink-0 text-sky-500" />
          <span className="mr-4 font-semibold">tcloud</span>
          {links
            .filter((link) => link.show)
            .map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted',
                    isActive && 'bg-muted text-foreground',
                  )
                }
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className="hidden text-sm text-muted-foreground md:inline">
              {me.data.login} · {me.data.role}
            </span>
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Выйти">
              <LogOutIcon />
            </Button>
          </div>
        </div>
      </header>
      <TaskWatcher />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
