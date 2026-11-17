import { useQueryClient } from '@tanstack/react-query'
import {
  CloudIcon,
  GaugeIcon,
  HardDriveIcon,
  KeyRoundIcon,
  ListChecksIcon,
  LogOutIcon,
  MenuIcon,
  SendIcon,
  TerminalIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react'
import { type ComponentType, useState } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router'
import { CommandPalette } from '@/components/command-palette'
import { TaskWatcher } from '@/components/task-watcher'
import { Button } from '@/components/ui/button'
import { isAdmin, useMe } from '@/hooks/use-me'
import { useStorages } from '@/hooks/use-storages'
import { ApiError, api } from '@/lib/api'
import { openPalette } from '@/lib/commands'
import type { Me } from '@/lib/types'
import { cn } from '@/lib/utils'

const item =
  'flex items-center gap-2 rounded-sm border-l-2 border-transparent px-2.5 py-1.5 font-mono text-xs tracking-tight text-muted-foreground uppercase transition-colors hover:bg-muted hover:text-primary'
const active = 'fx-neon border-primary bg-muted text-primary'

function Item({ to, label, icon: Icon, onNavigate }: { to: string; label: string; icon: ComponentType<{ className?: string }>; onNavigate: () => void }) {
  return (
    <NavLink to={to} onClick={onNavigate} className={({ isActive }) => cn(item, isActive && active)}>
      <Icon className="size-4 shrink-0" />
      {label}
    </NavLink>
  )
}

function StorageLinks({ onNavigate }: { onNavigate: () => void }) {
  const storages = useStorages()
  const [params] = useSearchParams()
  const { pathname } = useLocation()
  const current = pathname === '/files' ? params.get('path') : null
  if (!storages.data?.length) return null
  return (
    <ul className="ml-4 grid gap-0.5 border-l border-border/60 pl-1">
      {storages.data.map((storage) => {
        const selected = !!current && (current === storage.path || current.startsWith(`${storage.path}/`))
        return (
          <li key={storage.id}>
            <Link
              to={`/files?path=${encodeURIComponent(storage.path)}`}
              onClick={onNavigate}
              aria-current={selected ? 'page' : undefined}
              className={cn(
                'block truncate rounded-sm px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-primary',
                selected && 'bg-muted text-primary',
              )}
            >
              {storage.available ? '' : '! '}
              {storage.name ?? storage.id}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function Sidebar({ me, onNavigate, onLogout }: { me: Me; onNavigate: () => void; onLogout: () => void }) {
  const { pathname, search } = useLocation()
  const admin = [
    { to: '/users', label: 'Пользователи', icon: UsersIcon, show: isAdmin(me) },
    { to: '/telegram', label: 'Telegram', icon: SendIcon, show: me.role === 'root' },
  ].filter((link) => link.show)

  return (
    <nav aria-label="Основная навигация" className="flex h-full flex-col gap-4 p-3">
      <Link to="/dashboard" onClick={onNavigate} className="flex items-center gap-2 px-2 py-1">
        <CloudIcon className="size-5 shrink-0 text-primary drop-shadow-[0_0_6px_var(--primary)]" />
        <span className="fx-glitch fx-cursor font-heading text-lg font-bold tracking-widest uppercase">tcloud</span>
      </Link>
      <Button variant="outline" size="sm" className="justify-between text-muted-foreground" onClick={() => {
          onNavigate()
          openPalette()
        }}>
        <span className="flex items-center gap-2">
          <TerminalIcon /> Команды
        </span>
        <kbd className="text-[10px]">Ctrl K</kbd>
      </Button>
      <div className="grid gap-1">
        <Item to="/dashboard" label="Дашборд" icon={GaugeIcon} onNavigate={onNavigate} />
        <Link to="/files" onClick={onNavigate} aria-current={pathname === '/files' && !search ? 'page' : undefined} className={cn(item, pathname === '/files' && active)}>
          <HardDriveIcon className="size-4 shrink-0" />
          Хранилища
        </Link>
        <StorageLinks onNavigate={onNavigate} />
        <Item to="/tasks" label="Задачи" icon={ListChecksIcon} onNavigate={onNavigate} />
      </div>
      {admin.length > 0 && (
        <div className="grid gap-1">
          <p className="px-2.5 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">// Администрирование</p>
          {admin.map((link) => (
            <Item key={link.to} {...link} onNavigate={onNavigate} />
          ))}
        </div>
      )}
      <div className="mt-auto grid gap-2 border-t pt-3">
        <div className="flex items-center gap-2 px-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-xs">{me.login}</p>
            <p className="font-mono text-[10px] text-muted-foreground uppercase">{me.role}</p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onLogout} aria-label="Выйти">
            <LogOutIcon />
          </Button>
        </div>
        <Item to="/account" label="Аккаунт" icon={KeyRoundIcon} onNavigate={onNavigate} />
      </div>
    </nav>
  )
}

export function Layout() {
  const me = useMe()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  if (me.error instanceof ApiError && me.error.status === 401) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  if (me.isPending) return <div className="fx-cursor p-8 font-mono text-sm text-muted-foreground">[ ... ] загрузка</div>
  if (me.error) return <div className="p-8 text-destructive">{me.error.message}</div>

  async function logout() {
    await api.post('/auth/logout').catch(() => undefined)
    queryClient.clear()
    navigate('/login')
  }

  const close = () => setOpen(false)

  return (
    <div className="min-h-svh md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-svh overflow-y-auto border-r bg-background/95 md:block">
        <Sidebar me={me.data} onNavigate={close} onLogout={logout} />
      </aside>
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur md:hidden">
          <DialogPrimitive.Trigger asChild>
            <Button variant="ghost" size="icon" aria-label="Меню">
              <MenuIcon />
            </Button>
          </DialogPrimitive.Trigger>
          <CloudIcon className="size-5 text-primary drop-shadow-[0_0_6px_var(--primary)]" />
          <span className="font-heading text-lg font-bold tracking-widest uppercase">tcloud</span>
        </header>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 md:hidden" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] overflow-y-auto border-r bg-background shadow-[var(--glow)] outline-none md:hidden data-open:animate-in data-open:slide-in-from-left"
          >
            <DialogPrimitive.Title className="sr-only">Меню</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon-sm" className="absolute top-3 right-3" aria-label="Закрыть меню">
                <XIcon />
              </Button>
            </DialogPrimitive.Close>
            <Sidebar me={me.data} onNavigate={close} onLogout={logout} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      <div className="min-w-0">
        <TaskWatcher />
        <CommandPalette />
        <main key={location.pathname} className="fx-page mx-auto max-w-6xl px-4 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
