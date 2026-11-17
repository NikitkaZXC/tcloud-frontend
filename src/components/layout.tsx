import { useQueryClient } from '@tanstack/react-query'
import {
  CloudIcon,
  GaugeIcon,
  HardDriveIcon,
  KeyRoundIcon,
  ListChecksIcon,
  LogOutIcon,
  MenuIcon,
  MoonIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SearchIcon,
  SendIcon,
  SunIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react'
import { type ComponentType, useLayoutEffect, useRef, useState } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router'
import { CommandPalette } from '@/components/command-palette'
import { UploadPulse } from '@/components/fx'
import { TaskWatcher } from '@/components/task-watcher'
import { Button } from '@/components/ui/button'
import { isAdmin, useMe } from '@/hooks/use-me'
import { useStorageActivity, useStorages } from '@/hooks/use-storages'
import { ApiError, api } from '@/lib/api'
import { openPalette } from '@/lib/commands'
import { load, save } from '@/lib/prefs'
import { setTheme, useTheme } from '@/lib/theme'
import type { Me } from '@/lib/types'
import { cn } from '@/lib/utils'

const item =
  'relative z-10 flex h-10 items-center gap-3 rounded-full px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground'

function Item({
  to,
  label,
  icon: Icon,
  collapsed,
  onNavigate,
}: {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
  collapsed: boolean
  onNavigate: () => void
}) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={({ isActive }) => cn(item, collapsed && 'justify-center px-0', isActive && 'text-foreground')}
    >
      <Icon className="size-[1.125rem] shrink-0" />
      <span className={cn('truncate', collapsed && 'sr-only')}>{label}</span>
    </NavLink>
  )
}

function StorageLinks({ onNavigate }: { onNavigate: () => void }) {
  const storages = useStorages()
  const [params] = useSearchParams()
  const { pathname } = useLocation()
  const current = pathname === '/files' ? params.get('path') : null
  const activity = useStorageActivity(storages.data ?? [])
  if (!storages.data?.length) return null
  return (
    <ul className="ml-5 grid gap-0.5 border-l border-dashed pl-2">
      {storages.data.map((storage) => {
        const selected = !!current && (current === storage.path || current.startsWith(`${storage.path}/`))
        return (
          <li key={storage.id}>
            <Link
              to={`/files?path=${encodeURIComponent(storage.path)}`}
              onClick={onNavigate}
              aria-current={selected ? 'page' : undefined}
              className={cn(
                'relative z-10 grid gap-1 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground',
                selected && 'text-foreground',
              )}
            >
              <span className="flex items-center gap-1.5 truncate">
                {!storage.available && <span className="fx-light" data-ok={false} aria-label="канал недоступен" />}
                <span className="truncate">{storage.name ?? storage.id}</span>
              </span>
              {activity[storage.id] && <UploadPulse activity={activity[storage.id]} compact />}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function ThemeSwitch({ collapsed }: { collapsed: boolean }) {
  const theme = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Тёмная тема"
      title={dark ? 'Тёмная тема' : 'Светлая тема'}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      className={cn('fx-well relative inline-flex h-7 w-13 shrink-0 items-center rounded-full p-0.5', collapsed && 'h-13 w-7 flex-col')}
    >
      <span
        className={cn(
          'flex size-6 items-center justify-center rounded-full bg-gradient-to-b from-secondary to-card text-primary shadow-[inset_0_1px_0_var(--edge),0_2px_6px_var(--drop)] transition-transform duration-300',
          dark ? (collapsed ? 'translate-y-6' : 'translate-x-6') : '',
        )}
      >
        {dark ? <MoonIcon className="size-3.5 drop-shadow-[0_0_4px_var(--violet)]" /> : <SunIcon className="size-3.5 text-warning" />}
      </span>
    </button>
  )
}

function Sidebar({
  me,
  collapsed,
  onCollapse,
  onNavigate,
  onLogout,
}: {
  me: Me
  collapsed: boolean
  onCollapse?: () => void
  onNavigate: () => void
  onLogout: () => void
}) {
  const location = useLocation()
  const list = useRef<HTMLDivElement>(null)
  const pill = useRef<HTMLDivElement>(null)
  const storages = useStorages()
  const admin = [
    { to: '/users', label: 'Пользователи', icon: UsersIcon, show: isAdmin(me) },
    { to: '/telegram', label: 'Telegram', icon: SendIcon, show: me.role === 'root' },
  ].filter((link) => link.show)
  const filesActive = location.pathname === '/files'

  useLayoutEffect(() => {
    const target = list.current?.querySelector<HTMLElement>('[aria-current=page], [data-active=true]')
    if (!pill.current) return
    pill.current.style.opacity = target ? '1' : '0'
    if (!target) return
    pill.current.style.top = `${target.offsetTop}px`
    pill.current.style.height = `${target.offsetHeight}px`
    pill.current.style.left = `${target.offsetLeft}px`
    pill.current.style.width = `${target.offsetWidth}px`
  }, [location.pathname, location.search, collapsed, storages.data?.length])

  return (
    <nav aria-label="Основная навигация" className="flex h-full flex-col gap-3">
      <div className="fx-panel flex min-h-0 flex-1 flex-col gap-4 p-3">
        <div className={cn('flex items-center gap-2', collapsed ? 'flex-col' : 'justify-between pl-1')}>
          <Link to="/dashboard" onClick={onNavigate} className="flex items-center gap-2 rounded-full" aria-label="tcloud — дашборд">
            <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-[var(--violet)] to-[var(--pink)] text-white shadow-[0_0_18px_-4px_var(--violet)]">
              <CloudIcon className="size-[1.125rem]" />
            </span>
            {!collapsed && <span className="text-lg font-extrabold tracking-tight">tcloud</span>}
          </Link>
          {onCollapse && (
            <Button variant="ghost" size="icon-sm" onClick={onCollapse} aria-label={collapsed ? 'Развернуть панель' : 'Свернуть панель'} aria-expanded={!collapsed}>
              {collapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
            </Button>
          )}
        </div>
        <Button
          variant="outline"
          size={collapsed ? 'icon' : 'default'}
          className={cn('text-muted-foreground', collapsed ? 'self-center' : 'h-10 justify-between px-4')}
          aria-label="Команды и поиск (Ctrl+K)"
          onClick={() => {
            onNavigate()
            openPalette()
          }}
        >
          {collapsed ? (
            <SearchIcon />
          ) : (
            <>
              <span className="flex items-center gap-2">
                <SearchIcon /> Поиск и команды
              </span>
              <kbd className="fx-chip h-5 px-1.5 text-[10px] text-muted-foreground">Ctrl K</kbd>
            </>
          )}
        </Button>
        <div ref={list} className="relative -mx-1 grid min-h-0 flex-1 content-start gap-1 overflow-y-auto px-1">
          <div ref={pill} className="fx-pill opacity-0" data-collapsed={collapsed} aria-hidden />
          <Item to="/dashboard" label="Дашборд" icon={GaugeIcon} collapsed={collapsed} onNavigate={onNavigate} />
          <Link
            to="/files"
            onClick={onNavigate}
            title={collapsed ? 'Хранилища' : undefined}
            aria-current={filesActive && !location.search ? 'page' : undefined}
            data-active={filesActive && (collapsed || !storages.data?.length)}
            className={cn(item, collapsed && 'justify-center px-0', filesActive && 'text-foreground')}
          >
            <HardDriveIcon className="size-[1.125rem] shrink-0" />
            <span className={cn('truncate', collapsed && 'sr-only')}>Хранилища</span>
          </Link>
          {!collapsed && <StorageLinks onNavigate={onNavigate} />}
          <Item to="/tasks" label="Задачи" icon={ListChecksIcon} collapsed={collapsed} onNavigate={onNavigate} />
          {admin.length > 0 && (
            <>
              <p className={cn('px-3 pt-3 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase', collapsed && 'sr-only')}>
                Администрирование
              </p>
              {collapsed && <hr className="fx-dotted mx-2 my-1 border-t" />}
              {admin.map((link) => (
                <Item key={link.to} {...link} collapsed={collapsed} onNavigate={onNavigate} />
              ))}
            </>
          )}
        </div>
      </div>
      <div className={cn('fx-panel flex items-center gap-2 p-2.5', collapsed && 'flex-col')}>
        <NavLink
          to="/account"
          onClick={onNavigate}
          title="Аккаунт"
          className={({ isActive }) =>
            cn('flex min-w-0 flex-1 items-center gap-2.5 rounded-full p-0.5 pr-2 transition-colors hover:bg-secondary', collapsed && 'flex-none pr-0.5', isActive && 'bg-secondary')
          }
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-primary uppercase shadow-[inset_0_1px_0_var(--edge)]">
            {me.login.slice(0, 1)}
          </span>
          <span className={cn('min-w-0', collapsed && 'sr-only')}>
            <span className="block truncate text-sm font-semibold">{me.login}</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <KeyRoundIcon className="size-3" /> {me.role}
            </span>
          </span>
        </NavLink>
        <ThemeSwitch collapsed={collapsed} />
        <Button variant="ghost" size="icon-sm" onClick={onLogout} aria-label="Выйти" title="Выйти">
          <LogOutIcon />
        </Button>
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
  const [collapsed, setCollapsed] = useState(() => load('sidebar') === 'collapsed')

  if (me.error instanceof ApiError && me.error.status === 401) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  if (me.isPending) return <div className="p-8 text-sm text-muted-foreground">Загрузка…</div>
  if (me.error) return <div className="p-8 text-destructive">{me.error.message}</div>

  async function logout() {
    await api.post('/auth/logout').catch(() => undefined)
    queryClient.clear()
    navigate('/login')
  }

  const close = () => setOpen(false)
  const toggle = () => {
    save('sidebar', collapsed ? 'expanded' : 'collapsed')
    setCollapsed(!collapsed)
  }

  return (
    <div className="min-h-svh md:flex">
      <aside className={cn('sticky top-0 hidden h-svh shrink-0 p-3 pr-0 transition-[width] duration-300 md:block', collapsed ? 'w-[5.25rem]' : 'w-[17rem]')}>
        <Sidebar me={me.data} collapsed={collapsed} onCollapse={toggle} onNavigate={close} onLogout={logout} />
      </aside>
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <header className="fx-panel sticky top-2 z-10 mx-2 mt-2 flex items-center gap-2 px-3 py-2 md:hidden">
          <DialogPrimitive.Trigger asChild>
            <Button variant="ghost" size="icon" aria-label="Меню">
              <MenuIcon />
            </Button>
          </DialogPrimitive.Trigger>
          <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-[var(--violet)] to-[var(--pink)] text-white">
            <CloudIcon className="size-4" />
          </span>
          <span className="text-lg font-extrabold tracking-tight">tcloud</span>
        </header>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] md:hidden" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[88vw] p-2 outline-none md:hidden data-open:animate-in data-open:slide-in-from-left"
          >
            <DialogPrimitive.Title className="sr-only">Меню</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon-sm" className="absolute top-5 right-5 z-20" aria-label="Закрыть меню">
                <XIcon />
              </Button>
            </DialogPrimitive.Close>
            <Sidebar me={me.data} collapsed={false} onNavigate={close} onLogout={logout} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      <div className="min-w-0 flex-1">
        <TaskWatcher />
        <CommandPalette />
        <main key={location.pathname} className="fx-page mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
