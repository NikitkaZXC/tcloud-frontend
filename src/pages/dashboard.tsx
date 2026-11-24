import { useQuery } from '@tanstack/react-query'
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, GripVerticalIcon, LayoutGridIcon, RotateCcwIcon, Trash2Icon, XIcon } from 'lucide-react'
import { Fragment, type ReactNode, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Link, useBlocker } from 'react-router'
import { Confirm } from '@/components/confirm'
import { HealthRack } from '@/components/health'
import { ActivityMap } from '@/components/meters'
import { StorageCard } from '@/components/storages'
import { ChannelsRing, PageTitle, PixelToggle, Ring, Section, Stat, StatusChip, WireCubes } from '@/components/fx'
import { Button } from '@/components/ui/button'
import { useAction } from '@/hooks/use-action'
import { useHealth } from '@/hooks/use-health'
import { isAdmin, useMe } from '@/hooks/use-me'
import { useAccount, useStorageActivity, useStorageIo, useStorages } from '@/hooks/use-storages'
import { useTaskCounts, useTasks } from '@/hooks/use-tasks'
import { api, ApiError, errorMessage } from '@/lib/api'
import { blockOrder, channelUsage, DASHBOARD_BLOCKS, type DashboardBlock, hiddenBlocks, moveBlock, parseLayout, visibleBlocks, previewTotals, storageTotals, taskCounts, taskRings } from '@/lib/dashboard'
import { formatBytes } from '@/lib/format'
import { fileName, humanPath, taskTitle } from '@/lib/names'
import { checklist, dismiss, isDismissed } from '@/lib/onboarding'
import { stageLabel, taskFraction, useTrackedTasks } from '@/lib/tasks'
import type { Task, TelegramSessionState, User } from '@/lib/types'
import { load, save } from '@/lib/prefs'
import { type Settings, settingsError, updateSettings, useSettings, visibleTasks } from '@/lib/settings'
import { useSending } from '@/lib/upload'
import { type Key, t } from '@/lib/i18n'
import { stepLabel } from '@/lib/steps'
import { cn } from '@/lib/utils'

const MAX_FILE = 4 * 1024 ** 3

const rings = 'flex flex-wrap justify-center gap-x-6 gap-y-5 sm:justify-start'

function useTrackedData(): Task[] {
  return useTasks(useTrackedTasks())
    .map((result) => result.data)
    .filter((task): task is Task => !!task)
}

function SystemSection() {
  const health = useHealth()

  return (
    <Section label={t('dashboard.system')}>
      {health.isPending && <StatusChip status="wait" label={t('dashboard.checking')} />}
      {health.error && <p className="text-sm text-destructive">{errorMessage(health.error)}</p>}
      {health.data && <HealthRack health={health.data} />}
    </Section>
  )
}

function ChannelsSection() {
  const account = useAccount()
  const storages = useStorages().data ?? []
  const usage = channelUsage(account.data, storages.length)

  return (
    <Section label={t('dashboard.channels')}>
      {account.data?.telegram_connected === false && <p className="text-sm text-muted-foreground">{t('dashboard.telegramOff')}</p>}
      {account.error && <p className="text-sm text-destructive">{errorMessage(account.error)}</p>}
      <div className="flex flex-wrap items-center justify-center gap-8 sm:justify-start">
        <ChannelsRing usage={usage} />
        <div className={rings}>
          {usage.accountWide && <Ring value={storages.length / Math.max(usage.used, 1)} center={storages.length} label={t('dashboard.storagesShort')} caption={t('dashboard.ofAccountChannels')} />}
          {account.data?.telegram_connected && (
            <Ring value={account.data.premium ? 1 : 0} center={t(account.data.premium ? 'common.yes' : 'common.no')} label="premium" caption={t('dashboard.channelLimit', { n: usage.limit })} tone={account.data.premium ? 'ok' : 'idle'} />
          )}
          {account.data?.file_limit != null && (
            <Ring value={account.data.file_limit / MAX_FILE} center={formatBytes(account.data.file_limit)} label={t('dashboard.fileLimit')} caption={t('dashboard.fileLimitCaption')} />
          )}
        </div>
      </div>
      <p className="max-w-xl text-xs text-muted-foreground">
        {t('dashboard.limitHint')}{' '}
        <Link to="/files" className="fx-more">
          {t('nav.storages')}
        </Link>
      </p>
    </Section>
  )
}

function ActivitySection() {
  const sending = useSending()
  const filter = useSettings().interface.tasks_filter
  const tasks = visibleTasks(useTrackedData(), filter)
  const storages = useStorages().data ?? []
  const server = useTaskCounts().data
  const { rings: statuses, total } = taskRings(taskCounts(server), sending.length, filter)
  const running = tasks.filter((task) => task.status === 'running' || task.status === 'queued')

  return (
    <Section label={t('dashboard.activity')}>
      <ul className={rings}>
        {statuses.map(({ label, count, tone }) => (
          <li key={label}>
            <Ring value={count / total} center={count} label={t(label)} tone={count ? tone : undefined} />
          </li>
        ))}
      </ul>
      {sending.length + running.length > 0 && (
        <div className="fx-dotted flex flex-wrap items-center justify-center gap-8 border-t pt-5 sm:justify-start">
            <ul className={`fx-stagger ${rings} flex-1`} aria-label={t('dashboard.inProgress')}>
          {sending.slice(0, 8).map((item) => (
            <li key={`s${item.id}`} className="w-28">
              <Ring
                size="sm"
                value={item.loaded / Math.max(item.total, 1)}
                label={t('dashboard.sending')}
                caption={<span className="block max-w-28 truncate" title={humanPath(item.path, storages)}>{fileName(item.path)}</span>}
                tone="busy"
              />
            </li>
          ))}
          {running.slice(0, 8).map((task) => (
            <li key={task.id} className="w-28">
              <Ring
                size="sm"
                value={task.status === 'queued' ? 0 : taskFraction(task)}
                label={task.status === 'queued' ? (task.queue_position != null ? t('dashboard.queueN', { n: task.queue_position }) : t('status.queued')) : task.step ? stepLabel(task.step) : stageLabel(task.stage)}
                caption={<span className="block max-w-28 truncate" title={taskTitle(task, storages).where}>{taskTitle(task, storages).name}</span>}
                tone={task.archive ? 'read' : 'busy'}
              />
            </li>
          ))}
          </ul>
        </div>
      )}
      <Button asChild variant="outline" size="sm" className="justify-self-start">
        <Link to="/tasks">{t('dashboard.allTasks')}</Link>
      </Button>
    </Section>
  )
}

function StoragesSection() {
  const storages = useStorages()
  const activity = useStorageActivity(storages.data ?? [])
  const io = useStorageIo()

  return (
    <Section label={t('nav.storages')}>
      {storages.isPending && <StatusChip status="wait" label={t('dashboard.loading')} />}
      {storages.error && <p className="text-sm text-destructive">{errorMessage(storages.error)}</p>}
      {storages.data?.length === 0 && <p className="text-sm text-muted-foreground">{t('dashboard.noStorages')}</p>}
      <ul className="fx-stagger grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 [&>li]:min-w-0">
        {storages.data?.map((storage) => (
          <li key={storage.id}>
            <StorageCard storage={storage} activity={activity[storage.id]} io={io[storage.id]} />
          </li>
        ))}
      </ul>
    </Section>
  )
}

function UsersSection() {
  const users = useQuery({ queryKey: ['users'], queryFn: () => api.get<User[]>('/users') })
  const list = users.data ?? []
  const total = Math.max(list.length, 1)
  const rows: [string, number][] = [
    ['root', list.filter((u) => u.role === 'root').length],
    ['admin', list.filter((u) => u.role === 'admin').length],
    ['user', list.filter((u) => u.role === 'user').length],
    ['blocked', list.filter((u) => u.blocked).length],
  ]

  return (
    <Section label={t('nav.users')}>
      {users.error && <p className="text-sm text-destructive">{errorMessage(users.error)}</p>}
      <ul className={`fx-stagger ${rings}`}>
        {rows.map(([label, count]) => (
          <li key={label}>
            <Ring size="sm" value={count / total} center={count} label={label === 'blocked' ? t('dashboard.blocked') : label} tone={label === 'blocked' && count ? 'fail' : undefined} />
          </li>
        ))}
      </ul>
    </Section>
  )
}

function Checklist() {
  const [hidden, setHidden] = useState(isDismissed)
  const telegram = useQuery({ queryKey: ['telegram'], queryFn: () => api.get<{ sessions: TelegramSessionState[] }>('/telegram') })
  const storages = useStorages()
  const tasks = useTrackedData()
  if (hidden || !telegram.data || !storages.data) return null
  const steps = checklist(telegram.data.sessions, storages.data, tasks)
  if (steps.every((step) => step.done)) return null

  return (
    <Section label={t('dashboard.firstRun')}>
      <div className="-mb-3 flex justify-end">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('dashboard.hideChecklist')}
          onClick={() => {
            dismiss()
            setHidden(true)
          }}
        >
          <XIcon />
        </Button>
      </div>
      <ol className="fx-stagger grid gap-2 text-sm">
        {steps.map((step, i) => (
          <li key={step.key} className="flex flex-wrap items-center gap-2">
            <StatusChip status={step.done ? 'ok' : 'wait'} label={t(step.done ? 'status.done' : 'dashboard.todo')} />
            <span className={step.done ? 'text-muted-foreground line-through' : ''}>
              {i + 1}. {step.label}
            </span>
            {!step.done && (
              <Button asChild size="sm" variant="outline" className="ml-auto">
                <Link to={step.to}>{step.action}</Link>
              </Button>
            )}
          </li>
        ))}
      </ol>
    </Section>
  )
}

function PreviewsSection({ count, bytes, root }: { count: number; bytes: number; root: boolean }) {
  const clear = useAction(() => api.del<{ cleared: number; bytes: number }>('/files/previews'), {
    invalidate: [['storages'], ['account']],
    onSuccess: (result) => toast.success(t('dashboard.previewsCleared', { n: result.cleared, size: formatBytes(result.bytes) })),
    describe: (error) => (error instanceof ApiError && (error.status === 404 || error.status === 405) ? t('dashboard.previewsClearMissing') : errorMessage(error)),
  })
  return (
    <section aria-label={t('dashboard.previews')} className="fx-dotted grid grid-cols-2 border-t lg:grid-cols-4 [&>*]:fx-dotted [&>*:nth-child(even)]:border-l">
      <Stat label={t('dashboard.previews')} value={count} />
      <Stat label={t('dashboard.previewsSize')} value={bytes} format={formatBytes} />
      {root && (
        <div className="col-span-2 grid place-items-center px-3 py-5 lg:col-span-1 lg:border-l">
          <Confirm title={t('dashboard.previewsClearQ')} description={t('dashboard.previewsClearHint')} action={t('dashboard.previewsClear')} onConfirm={() => clear.mutate()}>
            <Button size="sm" variant="outline" disabled={clear.isPending || !count}>
              <Trash2Icon />
              {t('dashboard.previewsClear')}
            </Button>
          </Confirm>
        </div>
      )}
    </section>
  )
}

const BLOCK_LABELS: Record<DashboardBlock, Key> = {
  summary: 'dashboard.summary',
  previews: 'dashboard.previews',
  channels: 'dashboard.channels',
  storages: 'nav.storages',
  tasks: 'dashboard.activity',
  activity_map: 'dashboard.map',
  system: 'dashboard.system',
  users: 'nav.users',
}

function moved(id: DashboardBlock, visible: (string | undefined)[]) {
  return t('dashboard.moved', { name: t(BLOCK_LABELS[id]), n: visible.indexOf(id) + 1, total: visible.length })
}

interface Layout {
  order: DashboardBlock[]
  hidden: DashboardBlock[]
}

function savedLayout(ui: Settings['interface']): Layout {
  return {
    order: blockOrder(ui.dashboard_layout ?? parseLayout(load('dashboard.layout'))),
    hidden: hiddenBlocks(ui.dashboard_hidden ?? parseLayout(load('dashboard.hidden')), 'activity_map' in ui ? ui.activity_map : undefined),
  }
}

const sameLayout = (a: Layout, b: Layout) => a.order.join() === b.order.join() && [...a.hidden].sort().join() === [...b.hidden].sort().join()

export function DashboardPage() {
  const { data: me } = useMe()
  const ui = useSettings().interface
  const storageList = useStorages().data ?? []
  const totals = storageTotals(storageList)
  const previews = previewTotals(storageList)
  const account = useAccount()
  const counts = taskCounts(useTaskCounts().data)
  const active = counts.queued + counts.running + useSending().length
  const [draft, setDraft] = useState<Layout | null>(null)
  const [dragging, setDragging] = useState<DashboardBlock | null>(null)
  const [announce, setAnnounce] = useState('')
  const focus = useRef<[DashboardBlock, 'up' | 'down'] | null>(null)
  const dragOrder = useRef<DashboardBlock[]>([])
  const saved = savedLayout(ui)
  const { order, hidden } = draft ?? saved
  const dirty = !!draft && !sameLayout(draft, saved)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)

  const blocks: Record<DashboardBlock, ReactNode> = {
    summary: (
      <section aria-label={t('dashboard.summary')} className="fx-dotted grid grid-cols-2 border-t lg:grid-cols-4 [&>*]:fx-dotted [&>*:nth-child(even)]:border-l lg:[&>*:not(:first-child)]:border-l [&>*:nth-child(n+3)]:border-t lg:[&>*:nth-child(n+3)]:border-t-0">
        <Stat label={t('dashboard.filesUploaded')} value={totals.files} />
        <Stat label={t('dashboard.totalSize')} value={totals.size} format={formatBytes} />
        <Stat label={t('dashboard.storagesShort')} value={totals.storages} />
        <Stat label={t('dashboard.activeTasks')} value={active} />
      </section>
    ),
    previews: previews && account.data?.previews_enabled !== false && <PreviewsSection count={previews.count} bytes={previews.bytes} root={me?.role === 'root'} />,
    channels: <ChannelsSection />,
    storages: <StoragesSection />,
    tasks: <ActivitySection />,
    activity_map: (
      <Section label={t('dashboard.map')}>
        <ActivityMap />
      </Section>
    ),
    system: <SystemSection />,
    users: isAdmin(me) && <UsersSection />,
  }
  const shown = (draft ? order : visibleBlocks(order, hidden)).filter((id) => blocks[id])

  const step = (id: DashboardBlock, dir: 'up' | 'down') => {
    const to = shown[shown.indexOf(id) + (dir === 'up' ? -1 : 1)]
    if (!to) return
    const next = moveBlock(order, id, to)
    setDraft({ order: next, hidden })
    focus.current = [id, dir]
    setAnnounce(moved(id, next.filter((block) => shown.includes(block))))
  }

  useEffect(() => {
    if (!focus.current) return
    const [id, dir] = focus.current
    focus.current = null
    const buttons = document.querySelectorAll<HTMLButtonElement>(`[data-block="${id}"] [data-move]`)
    const target = [...buttons].find((button) => button.dataset.move === dir && !button.disabled) ?? [...buttons].find((button) => !button.disabled)
    target?.focus()
  })

  useEffect(() => {
    if (!dragging) return
    let latest = dragOrder.current
    const move = (event: PointerEvent) => {
      const y = event.clientY
      if (y < 48) scrollBy(0, -16)
      else if (y > innerHeight - 48) scrollBy(0, 16)
      const el = document.elementFromPoint(event.clientX, y)?.closest<HTMLElement>('[data-block]')
      const to = el?.dataset.block as DashboardBlock | undefined
      if (!el || !to || to === dragging) return
      const rect = el.getBoundingClientRect()
      const middle = rect.top + rect.height / 2
      if (latest.indexOf(to) > latest.indexOf(dragging) ? y < middle : y > middle) return
      latest = moveBlock(latest, dragging, to)
      setDraft((current) => current && { ...current, order: latest })
    }
    const end = () => {
      setAnnounce(moved(dragging, [...document.querySelectorAll<HTMLElement>('[data-block]')].map((el) => el.dataset.block)))
      setDragging(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [dragging])

  useEffect(() => {
    if (!draft || blocker.state === 'blocked') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"], [role="alertdialog"]')) return
      setDraft(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [draft, blocker.state])

  useEffect(() => {
    if (!dirty) return
    const onUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [dirty])

  const done = () => {
    setDraft(null)
    if (!draft || !dirty) return
    const changes: Partial<Settings['interface']>[] = []
    if (draft.order.join() !== saved.order.join()) {
      save('dashboard.layout', JSON.stringify(draft.order))
      changes.push({ dashboard_layout: draft.order })
    }
    if (!sameLayout({ ...draft, order: saved.order }, saved)) {
      save('dashboard.hidden', JSON.stringify(draft.hidden))
      changes.push({ dashboard_hidden: draft.hidden })
    }
    for (const change of changes) updateSettings({ interface: change }).catch((error) => toast.error(settingsError(error)))
  }

  const toggle = (id: DashboardBlock, show: boolean) => setDraft((current) => current && { ...current, hidden: show ? current.hidden.filter((block) => block !== id) : [...current.hidden, id] })

  return (
    <div className={cn('grid', dragging && 'select-none')}>
      <header className="grid items-center gap-6 pb-8 md:grid-cols-[1fr_auto] md:pb-10">
        <div className="grid gap-4">
          <PageTitle text={t('nav.dashboard')} eyebrow={t('dashboard.eyebrow')} className="text-[33px] sm:text-[44px] md:text-[66px]" />
          <div className="flex flex-wrap items-center gap-2">
            {draft ? (
              <>
                <Button size="sm" onClick={done}>
                  <CheckIcon />
                  {t('dashboard.layoutDone')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDraft(null)}>
                  <XIcon />
                  {t('common.cancel')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDraft({ order: [...DASHBOARD_BLOCKS], hidden: [] })}>
                  <RotateCcwIcon />
                  {t('dashboard.layoutReset')}
                </Button>
                <p className="text-xs text-muted-foreground">{t('dashboard.layoutHint')}</p>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setDraft({ order, hidden })}>
                <LayoutGridIcon />
                {t('dashboard.customize')}
              </Button>
            )}
          </div>
        </div>
        <WireCubes className="hidden w-64 md:block" />
      </header>
      <Confirm
        title={t('dashboard.layoutLeaveQ')}
        description={t('dashboard.layoutLeave')}
        action={t('dashboard.layoutDiscard')}
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => !open && blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      />
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      {me?.role === 'root' && <Checklist />}
      {shown.map((id, i) =>
        draft ? (
          <div key={id} data-block={id} className={cn('group relative mt-3 outline-1 -outline-offset-1 outline-border outline-dashed transition-[opacity,transform] duration-200 ease-out', dragging === id && 'z-10 scale-[0.99] opacity-60')}>
            <div className="flex items-center gap-1 bg-muted px-1 py-1">
              <Button
                variant="ghost"
                size="icon-sm"
                tabIndex={-1}
                aria-hidden
                title={t('dashboard.drag')}
                className="cursor-grab touch-none active:cursor-grabbing"
                onPointerDown={(event) => {
                  event.preventDefault()
                  dragOrder.current = order
                  setDragging(id)
                }}
              >
                <GripVerticalIcon />
              </Button>
              <span id={`block-${id}`} className={cn('fx-label min-w-0 flex-1 truncate', hidden.includes(id) && 'line-through')}>
                {t(BLOCK_LABELS[id])}
              </span>
              <span id={`block-${id}-show`} className="hidden text-xs text-muted-foreground uppercase sm:inline">
                {t('dashboard.show')}
              </span>
              <span className="mr-2 flex">
                <PixelToggle checked={!hidden.includes(id)} onChange={(show) => toggle(id, show)} labelledBy={`block-${id}-show block-${id}`} />
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                data-move="up"
                aria-label={t('dashboard.moveUp', { name: t(BLOCK_LABELS[id]) })}
                disabled={i === 0}
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                onClick={() => step(id, 'up')}
              >
                <ArrowUpIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                data-move="down"
                aria-label={t('dashboard.moveDown', { name: t(BLOCK_LABELS[id]) })}
                disabled={i === shown.length - 1}
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                onClick={() => step(id, 'down')}
              >
                <ArrowDownIcon />
              </Button>
            </div>
            <div className={cn('px-3 transition-opacity duration-200', hidden.includes(id) && 'opacity-40')} inert={hidden.includes(id)}>
              {blocks[id]}
            </div>
          </div>
        ) : (
          <Fragment key={id}>{blocks[id]}</Fragment>
        ),
      )}
    </div>
  )
}
