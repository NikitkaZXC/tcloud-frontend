import { useQueryClient } from '@tanstack/react-query'
import {
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
  ShieldIcon,
  SunIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react'
import { type ComponentType, useLayoutEffect, useRef, useState } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router'
import { SearchBar } from '@/components/search-bar'
import { CommandPalette } from '@/components/command-palette'
import { CornerHint, IoTag, StorageIcon, UploadPulse, WRITTEN } from '@/components/fx'
import { Extras, Pet, Tip } from '@/components/extras'
import { PixelBursts } from '@/components/pixel-fx'
import { TaskWatcher } from '@/components/task-watcher'
import { Button } from '@/components/ui/button'
import { isAdmin, useMe } from '@/hooks/use-me'
import { useStorageActivity, useStorageIo, useStorages } from '@/hooks/use-storages'
import { ApiError, api } from '@/lib/api'
import { openPalette } from '@/lib/commands'
import { load, save } from '@/lib/prefs'
import { isUnavailable, storageName } from '@/lib/names'
import { setTheme, useTheme } from '@/lib/theme'
import type { Me } from '@/lib/types'
import { cn } from '@/lib/utils'

const item =
  'relative z-10 flex h-10 items-center gap-3 px-3 text-sm tracking-[0.06em] text-muted-foreground uppercase transition-colors hover:text-foreground pointer-coarse:h-11'

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
  const io = useStorageIo(storages.data ?? [])
  if (!storages.data?.length) return null
  return (
    <ul className="fx-dotted ml-5 grid gap-0.5 border-l pl-2">
      {storages.data.map((storage) => {
        const selected = !!current && (current === storage.path || current.startsWith(`${storage.path}/`))
        return (
          <li key={storage.id}>
            <Link
              to={`/files?path=${encodeURIComponent(storage.path)}`}
              onClick={onNavigate}
              aria-current={selected ? 'page' : undefined}
              className={cn(
                'relative z-10 grid gap-1 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground pointer-coarse:py-3',
                selected && 'text-foreground',
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <StorageIcon id={storage.id} io={io[storage.id]} off={isUnavailable(storage)} scale={1} />
                <span className="truncate" title={storageName(storage)}>{storageName(storage)}</span>
                <IoTag io={io[storage.id]} short />
              </span>
              {(activity[storage.id] || io[storage.id] === 'write' || io[storage.id] === 'both') && <UploadPulse activity={activity[storage.id] ?? WRITTEN} compact />}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export function Brand({ short }: { short?: boolean }) {
  return (
    <span className="fx-pixel text-[20px] uppercase" aria-hidden>
      {short ? 't' : 'tcloud'}
    </span>
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
      className={cn(
        "relative inline-flex h-7 w-13 shrink-0 items-center border p-0.5 after:absolute after:-inset-2 after:content-['']",
        collapsed && 'h-13 w-7 flex-col',
      )}
    >
      <span
        className={cn(
          'flex size-6 items-center justify-center border border-foreground bg-foreground text-background transition-transform duration-300',
          dark ? (collapsed ? 'translate-y-6' : 'translate-x-6') : '',
        )}
      >
        {dark ? <MoonIcon className="size-3.5" /> : <SunIcon className="size-3.5" />}
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
          <Link to="/dashboard" onClick={onNavigate} className="flex h-9 items-center rounded-md px-1" aria-label="tcloud — дашборд">
            <Brand short={collapsed} />
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
          className={cn('text-muted-foreground', collapsed ? 'self-center' : 'h-10 justify-between px-3')}
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
                <SearchIcon /> Поиск
              </span>
              <kbd className="fx-label text-[10px]">Ctrl K</kbd>
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
            <div
              role="group"
              aria-labelledby="nav-admin"
              className={cn('fx-dotted mt-5 grid gap-1 border-2 px-1 pb-1', collapsed && 'mt-2 border-x-0 border-b-0 px-0 pt-2 pb-0')}
            >
              <h2 id="nav-admin" className={cn('fx-group-label -mt-[0.75em] ml-2 justify-self-start bg-card px-1.5', collapsed && 'sr-only')}>
                <ShieldIcon className="size-3.5" aria-hidden /> Администрирование
              </h2>
              {admin.map((link) => (
                <Item key={link.to} {...link} collapsed={collapsed} onNavigate={onNavigate} />
              ))}
            </div>
          )}
        </div>
      </div>
      <Pet />
      <div className={cn('fx-panel flex items-center gap-2 p-2.5', collapsed && 'flex-col')}>
        <NavLink
          to="/account"
          onClick={onNavigate}
          title="Аккаунт"
          className={({ isActive }) =>
            cn('flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 pr-2 transition-colors hover:bg-secondary', collapsed && 'flex-none pr-1', isActive && 'outline outline-1 outline-foreground')
          }
        >
          <span className="flex size-8 shrink-0 items-center justify-center border fx-pixel text-sm uppercase">
            {me.login.slice(0, 1)}
          </span>
          <span className={cn('min-w-0', collapsed && 'sr-only')}>
            <span className="block truncate text-sm font-medium">{me.login}</span>
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
        <header className="fx-panel sticky top-[max(0.5rem,env(safe-area-inset-top))] z-10 mx-[max(0.5rem,env(safe-area-inset-left))] mt-[max(0.5rem,env(safe-area-inset-top))] flex items-center gap-2 px-2 py-1.5 md:hidden">
          <DialogPrimitive.Trigger asChild>
            <Button variant="ghost" size="icon" aria-label="Меню">
              <MenuIcon />
            </Button>
          </DialogPrimitive.Trigger>
          <Link to="/dashboard" className="flex items-center rounded-md px-1 py-2 pointer-coarse:py-3" aria-label="tcloud — дашборд">
            <Brand />
          </Link>
          <Button variant="ghost" size="icon" className="ml-auto" aria-label="Команды и поиск" onClick={openPalette}>
            <SearchIcon />
          </Button>
        </header>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] md:hidden" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[88vw] p-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] outline-none md:hidden data-open:animate-in data-open:slide-in-from-left"
          >
            <DialogPrimitive.Title className="sr-only">Меню</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon-sm" className="absolute top-[max(1.25rem,calc(env(safe-area-inset-top)+0.75rem))] right-5 z-20" aria-label="Закрыть меню">
                <XIcon />
              </Button>
            </DialogPrimitive.Close>
            <Sidebar me={me.data} collapsed={false} onNavigate={close} onLogout={logout} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      <div className="min-w-0 flex-1">
        <TaskWatcher />
        <PixelBursts />
        <Extras />
        <CommandPalette />
        <CornerHint />
        <div className="mx-auto max-w-6xl px-4 pt-4 md:px-12 md:pt-8">
          <SearchBar />
        </div>
        <main key={location.pathname} className="fx-page mx-auto max-w-6xl px-4 pt-0 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-12">
          <Outlet />
          <Tip />
        </main>
      </div>
    </div>
  )
}
