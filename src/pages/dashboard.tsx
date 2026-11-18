import { useQuery } from '@tanstack/react-query'
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, CpuIcon, GripVerticalIcon, LayoutGridIcon, RotateCcwIcon, SendIcon, ServerIcon, ShieldCheckIcon, XIcon } from 'lucide-react'
import { Fragment, type ReactNode, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Link, useBlocker } from 'react-router'
import { Confirm } from '@/components/confirm'
import { Achievements } from '@/components/extras'
import { ActivityMap, Speedometer } from '@/components/meters'
import { StorageCard } from '@/components/storages'
import { ChannelsRing, PageTitle, Ring, Section, Stat, StatusChip, StatusLight, WireCubes } from '@/components/fx'
import { Button } from '@/components/ui/button'
import { isAdmin, useMe } from '@/hooks/use-me'
import { useStorageActivity, useStorageIo, useStorages } from '@/hooks/use-storages'
import { useTaskCounts, useTasks } from '@/hooks/use-tasks'
import { api } from '@/lib/api'
import { blockOrder, channelUsage, DASHBOARD_BLOCKS, type DashboardBlock, HEALTH_LABELS, moveBlock, parseLayout, healthGroups, previewTotals, storageTotals, taskCounts, transferStats } from '@/lib/dashboard'
import { formatBytes } from '@/lib/format'
import { fileName, humanPath, taskTitle } from '@/lib/names'
import { checklist, dismiss, isDismissed } from '@/lib/onboarding'
import { stageLabel, taskFraction, useTrackedTasks } from '@/lib/tasks'
import type { Account, Health, Task, TelegramSessionState, User } from '@/lib/types'
import { load, save } from '@/lib/prefs'
import { settingsError, updateSettings, useSettings, visibleTasks } from '@/lib/settings'
import { useSending } from '@/lib/upload'
import { type Key, t } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const MAX_FILE = 4 * 1024 ** 3

const rings = 'flex flex-wrap justify-center gap-x-6 gap-y-5 sm:justify-start'

function useAccount() {
  return useQuery({ queryKey: ['account'], queryFn: () => api.get<Account>('/account') })
}

function useTrackedData(): Task[] {
  return useTasks(useTrackedTasks())
    .map((result) => result.data)
    .filter((task): task is Task => !!task)
}

const GROUP_ICONS = { telegram: SendIcon, workers: CpuIcon, infra: ServerIcon, antivirus: ShieldCheckIcon }

function SystemSection() {
  const health = useQuery({ queryKey: ['health'], queryFn: () => api.get<Health>('/health'), refetchInterval: 15000 })
  const groups = health.data ? healthGroups(health.data) : []
  const checks = groups.flatMap((group) => group.checks)
  const ok = checks.filter(([, value]) => value).length

  return (
    <Section label={t('dashboard.system')}>
      {health.isPending && <StatusChip status="wait" label={t('dashboard.checking')} />}
      {health.error && <p className="text-sm text-destructive">{health.error.message}</p>}
      {checks.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-8 sm:justify-start">
          <Ring
            size="lg"
            value={ok / checks.length}
            label={t(health.data?.ok ? 'dashboard.healthy' : 'dashboard.unhealthy')}
            caption={t('dashboard.components', { ok, n: checks.length })}
            tone={health.data?.ok ? 'ok' : 'fail'}
          />
          <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2">
            {groups.map(({ id, checks: rows }) => {
              const Icon = GROUP_ICONS[id]
              return (
                <div key={id} className="fx-panel grid content-start gap-4 p-4">
                  <h3 className="fx-group-label">
                    <Icon className="size-4 shrink-0" />
                    <span className="flex-1">{t(`health.group.${id}`)}</span>
                    <StatusLight ok={rows.every(([, value]) => value)} />
                  </h3>
                  <ul className={`fx-stagger ${rings}`}>
                    {rows.map(([key, value]) => (
                      <li key={key}>
                        <Ring size="sm" value={value ? 1 : 0} center={value ? 'OK' : '×'} label={HEALTH_LABELS[key] ? t(HEALTH_LABELS[key]) : key} tone={value ? 'ok' : 'fail'} />
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      )}
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
      {account.error && <p className="text-sm text-destructive">{account.error.message}</p>}
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
  const counts = taskCounts(server)
  const total = Math.max((server?.total ?? 0) + sending.length, 1)
  const running = tasks.filter((task) => task.status === 'running' || task.status === 'queued')
  const statuses: [string, number, 'busy' | 'idle' | 'ok' | 'fail'][] = [
    [t('dashboard.running'), counts.running + sending.length, 'busy'],
    [t('status.queued'), counts.queued, 'idle'],
    [t('status.done'), counts.done, 'ok'],
    [t('dashboard.errors'), counts.failed + counts.cancelled, 'fail'],
  ].filter(([, , tone]) => filter === 'all' || tone !== 'ok') as [string, number, 'busy' | 'idle' | 'ok' | 'fail'][]

  return (
    <Section label={t('dashboard.activity')}>
      <ul className={rings}>
        {statuses.map(([label, count, tone]) => (
          <li key={label}>
            <Ring value={count / total} center={count} label={label} tone={count ? tone : undefined} />
          </li>
        ))}
      </ul>
      {sending.length + running.length > 0 && (
        <div className="fx-dotted flex flex-wrap items-center justify-center gap-8 border-t pt-5 sm:justify-start">
          <Speedometer transfer={transferStats(sending, tasks)} />
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
                label={task.status === 'queued' ? (task.queue_position != null ? t('dashboard.queueN', { n: task.queue_position }) : t('status.queued')) : stageLabel(task.stage)}
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
  const io = useStorageIo(storages.data ?? [])

  return (
    <Section label={t('nav.storages')}>
      {storages.isPending && <StatusChip status="wait" label={t('dashboard.loading')} />}
      {storages.error && <p className="text-sm text-destructive">{storages.error.message}</p>}
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
      {users.error && <p className="text-sm text-destructive">{users.error.message}</p>}
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
  if (steps.every((step) => step.done)) return <Achievements files={0} size={0} checklist />

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

function savedLayout(stored: string[] | undefined): DashboardBlock[] {
  return blockOrder(stored ?? parseLayout(load('dashboard.layout')))
}

export function DashboardPage() {
  const { data: me } = useMe()
  const ui = useSettings().interface
  const storageList = useStorages().data ?? []
  const totals = storageTotals(storageList)
  const previews = previewTotals(storageList)
  const counts = taskCounts(useTaskCounts().data)
  const active = counts.queued + counts.running + useSending().length
  const [draft, setDraft] = useState<DashboardBlock[] | null>(null)
  const [dragging, setDragging] = useState<DashboardBlock | null>(null)
  const [announce, setAnnounce] = useState('')
  const focus = useRef<[DashboardBlock, 'up' | 'down'] | null>(null)
  const dragOrder = useRef<DashboardBlock[]>([])
  const saved = savedLayout(ui.dashboard_layout)
  const order = draft ?? saved
  const dirty = !!draft && draft.join() !== saved.join()
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
    previews: previews && (
      <section aria-label={t('dashboard.previews')} className="fx-dotted grid grid-cols-2 border-t lg:grid-cols-4 [&>*]:fx-dotted [&>*:nth-child(even)]:border-l">
        <Stat label={t('dashboard.previews')} value={previews.count} />
        <Stat label={t('dashboard.previewsSize')} value={previews.bytes} format={formatBytes} />
      </section>
    ),
    channels: <ChannelsSection />,
    storages: <StoragesSection />,
    tasks: <ActivitySection />,
    activity_map: ui.activity_map && (
      <Section label={t('dashboard.map')}>
        <ActivityMap />
      </Section>
    ),
    system: <SystemSection />,
    users: isAdmin(me) && <UsersSection />,
  }
  const shown = order.filter((id) => blocks[id])

  const step = (id: DashboardBlock, dir: 'up' | 'down') => {
    const to = shown[shown.indexOf(id) + (dir === 'up' ? -1 : 1)]
    if (!to) return
    const next = moveBlock(order, id, to)
    setDraft(next)
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
      setDraft(latest)
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
      if (event.key === 'Escape' && !event.defaultPrevented) setDraft(null)
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
    if (!dirty) return
    save('dashboard.layout', JSON.stringify(draft))
    updateSettings({ interface: { dashboard_layout: draft } }).catch((error) => toast.error(settingsError(error)))
  }

  return (
    <div className={cn('grid', dragging && 'select-none')}>
      <header className="grid items-center gap-6 pb-8 md:grid-cols-[1fr_auto] md:pb-10">
        <div className="grid gap-4">
          <PageTitle text={t('nav.dashboard')} eyebrow={t('dashboard.eyebrow')} className="text-[40px] sm:text-[50px] md:text-[80px]" />
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
                <Button size="sm" variant="outline" onClick={() => setDraft([...DASHBOARD_BLOCKS])}>
                  <RotateCcwIcon />
                  {t('dashboard.layoutReset')}
                </Button>
                <p className="text-xs text-muted-foreground">{t('dashboard.layoutHint')}</p>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setDraft(order)}>
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
      <Achievements files={totals.files} size={totals.size} checklist={false} />
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
              <span className="fx-label min-w-0 flex-1 truncate">{t(BLOCK_LABELS[id])}</span>
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
            {blocks[id]}
          </div>
        ) : (
          <Fragment key={id}>{blocks[id]}</Fragment>
        ),
      )}
    </div>
  )
}
