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
  SettingsIcon,
  SunIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react'
import { type ComponentType, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { toast } from 'sonner'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router'
import { SearchBar } from '@/components/search-bar'
import { CommandPalette } from '@/components/command-palette'
import { CornerHint, IoTag, Logo, StorageIcon, UploadPulse, WRITTEN } from '@/components/fx'
import { Extras, Pet, Tip } from '@/components/extras'
import { TaskWatcher } from '@/components/task-watcher'
import { Button } from '@/components/ui/button'
import { isAdmin, useMe } from '@/hooks/use-me'
import { useStorageActivity, useStorageIo, useStorages } from '@/hooks/use-storages'
import { ApiError, api, errorMessage } from '@/lib/api'
import { openPalette } from '@/lib/commands'
import { load, save } from '@/lib/prefs'
import { isUnavailable, storageName } from '@/lib/names'
import { migrateLegacy, updateSettings } from '@/lib/settings'
import { setTheme, useTheme } from '@/lib/theme'
import type { Me } from '@/lib/types'
import { cn } from '@/lib/utils'
import { t, useLang } from '@/lib/i18n'

const showError = (error: unknown) => toast.error(errorMessage(error))

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
    <span className="flex items-center gap-2" aria-hidden>
      <Logo />
      {!short && <span className="fx-pixel text-[22px] uppercase">tcloud</span>}
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
      aria-label={t('theme.dark')}
      title={t(dark ? 'theme.dark' : 'theme.light')}
      onClick={() => setTheme(dark ? 'light' : 'dark').catch(showError)}
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

function LangSwitch({ collapsed }: { collapsed: boolean }) {
  const lang = useLang()
  const next = lang === 'ru' ? 'en' : 'ru'
  return (
    <button
      type="button"
      onClick={() => updateSettings({ interface: { language: next } }).catch(showError)}
      aria-label={t('nav.language', { lang: next.toUpperCase() })}
      title={t('nav.language', { lang: next.toUpperCase() })}
      className={cn("fx-label relative inline-flex h-7 w-9 shrink-0 items-center justify-center border text-xs after:absolute after:-inset-2 after:content-['']", collapsed && 'w-7')}
    >
      {lang.toUpperCase()}
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
    { to: '/users', label: t('nav.users'), icon: UsersIcon, show: isAdmin(me) },
    { to: '/telegram', label: 'Telegram', icon: SendIcon, show: me.role === 'root' },
  ].filter((link) => link.show)
  const filesActive = location.pathname === '/files'

  useLayoutEffect(() => {
    const target = list.current?.querySelector<HTMLElement>('[aria-current=page], [data-active=true]')
    if (!pill.current) return
    pill.current.style.opacity = target ? '1' : '0'
    if (!target) return
    pill.current.style.transform = `translate(${target.offsetLeft}px, ${target.offsetTop}px)`
    pill.current.style.height = `${target.offsetHeight}px`
    pill.current.style.width = `${target.offsetWidth}px`
  }, [location.pathname, location.search, collapsed, storages.data?.length])

  return (
    <nav aria-label={t('nav.main')} className="flex h-full flex-col gap-3">
      <div className="fx-panel flex min-h-0 flex-1 flex-col gap-4 p-3">
        <div className={cn('flex items-center gap-2', collapsed ? 'flex-col' : 'justify-between pl-1')}>
          <Link to="/dashboard" onClick={onNavigate} className="flex h-9 items-center rounded-md px-1" aria-label={t('nav.home')}>
            <Brand short={collapsed} />
          </Link>
          {onCollapse && (
            <Button variant="ghost" size="icon-sm" onClick={onCollapse} aria-label={t(collapsed ? 'nav.expand' : 'nav.collapse')} aria-expanded={!collapsed}>
              {collapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
            </Button>
          )}
        </div>
        <Button
          variant="outline"
          size={collapsed ? 'icon' : 'default'}
          className={cn('text-muted-foreground', collapsed ? 'self-center' : 'h-10 justify-between px-3')}
          aria-label={t('nav.paletteKey')}
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
                <SearchIcon /> {t('nav.search')}
              </span>
              <kbd className="fx-label">Ctrl K</kbd>
            </>
          )}
        </Button>
        <div ref={list} className="relative -mx-1 grid min-h-0 flex-1 content-start gap-1 overflow-y-auto px-1">
          <div ref={pill} className="fx-pill opacity-0" data-collapsed={collapsed} aria-hidden />
          <Item to="/dashboard" label={t('nav.dashboard')} icon={GaugeIcon} collapsed={collapsed} onNavigate={onNavigate} />
          <Link
            to="/files"
            onClick={onNavigate}
            title={collapsed ? t('nav.storages') : undefined}
            aria-current={filesActive && !location.search ? 'page' : undefined}
            data-active={filesActive && (collapsed || !storages.data?.length)}
            className={cn(item, collapsed && 'justify-center px-0', filesActive && 'text-foreground')}
          >
            <HardDriveIcon className="size-[1.125rem] shrink-0" />
            <span className={cn('truncate', collapsed && 'sr-only')}>{t('nav.storages')}</span>
          </Link>
          {!collapsed && <StorageLinks onNavigate={onNavigate} />}
          <Item to="/tasks" label={t('nav.tasks')} icon={ListChecksIcon} collapsed={collapsed} onNavigate={onNavigate} />
          <Item to="/settings" label={t('nav.settings')} icon={SettingsIcon} collapsed={collapsed} onNavigate={onNavigate} />
          {admin.length > 0 && (
            <div role="group" aria-labelledby="nav-admin" className="fx-dotted mt-2 grid gap-1 border-t pt-2">
              <h2 id="nav-admin" className={cn('fx-group-label px-3 pt-1 pb-0.5', collapsed && 'sr-only')}>
                {t('nav.admin')}
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
          title={t('nav.account')}
          className={({ isActive }) =>
            cn('flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 pr-2 transition-colors hover:bg-secondary', collapsed && 'flex-none pr-1', isActive && 'outline outline-1 outline-foreground')
          }
        >
          <span className="flex size-8 shrink-0 items-center justify-center border fx-pixel text-[22px] uppercase">
            {me.login.slice(0, 1)}
          </span>
          <span className={cn('min-w-0', collapsed && 'sr-only')}>
            <span className="block truncate text-sm text-foreground">{me.login}</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <KeyRoundIcon className="size-3" /> {me.role}
            </span>
          </span>
        </NavLink>
        <LangSwitch collapsed={collapsed} />
        <ThemeSwitch collapsed={collapsed} />
        <Button variant="ghost" size="icon-sm" onClick={onLogout} aria-label={t('nav.logout')} title={t('nav.logout')}>
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
  const ready = !!me.data

  useEffect(() => {
    if (ready) migrateLegacy()
  }, [ready])

  if (me.error instanceof ApiError && me.error.status === 401) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  if (me.isPending) return <div className="p-8 text-sm text-muted-foreground">{t('common.loading')}</div>
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
            <Button variant="ghost" size="icon" aria-label={t('nav.menu')}>
              <MenuIcon />
            </Button>
          </DialogPrimitive.Trigger>
          <Link to="/dashboard" className="flex items-center rounded-md px-1 py-2 pointer-coarse:py-3" aria-label={t('nav.home')}>
            <Brand />
          </Link>
          <Button variant="ghost" size="icon" className="ml-auto" aria-label={t('nav.palette')} onClick={openPalette}>
            <SearchIcon />
          </Button>
        </header>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] md:hidden" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[88vw] p-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] outline-none md:hidden data-open:animate-in data-open:slide-in-from-left"
          >
            <DialogPrimitive.Title className="sr-only">{t('nav.menu')}</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon-sm" className="absolute top-[max(1.25rem,calc(env(safe-area-inset-top)+0.75rem))] right-5 z-20" aria-label={t('nav.closeMenu')}>
                <XIcon />
              </Button>
            </DialogPrimitive.Close>
            <Sidebar me={me.data} collapsed={false} onNavigate={close} onLogout={logout} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      <div className="min-w-0 flex-1">
        <TaskWatcher />
        <Extras />
        <CommandPalette />
        <CornerHint />
        <div className="mx-auto max-w-6xl px-4 pt-4 md:px-12 md:pt-8">
          <SearchBar />
        </div>
        <main key={location.pathname} className="fx-page mx-auto max-w-6xl px-4 pt-0 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-12">
          <Suspense fallback={<p className="text-sm text-muted-foreground">{t('common.loading')}</p>}>
            <Outlet />
          </Suspense>
          <Tip />
        </main>
      </div>
    </div>
  )
}
