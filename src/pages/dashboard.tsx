import { useQuery } from '@tanstack/react-query'
import { XIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Achievements } from '@/components/extras'
import { ActivityMap, Speedometer } from '@/components/meters'
import { StorageCard } from '@/components/storages'
import { ChannelsRing, PageTitle, Ring, Section, Stat, StatusChip, WireCubes } from '@/components/fx'
import { Button } from '@/components/ui/button'
import { isAdmin, useMe } from '@/hooks/use-me'
import { useStorageActivity, useStorageIo, useStorages } from '@/hooks/use-storages'
import { useTasks } from '@/hooks/use-tasks'
import { api, ApiError } from '@/lib/api'
import { channelUsage, HEALTH_LABELS, healthChecks, storageTotals, taskCounts, transferStats } from '@/lib/dashboard'
import { formatBytes } from '@/lib/format'
import { fileName, humanPath, taskTitle } from '@/lib/names'
import { checklist, dismiss, isDismissed } from '@/lib/onboarding'
import { stageLabel, taskFraction, useTrackedTasks } from '@/lib/tasks'
import type { Account, Health, Task, TelegramSessionState, User } from '@/lib/types'
import { useSettings, visibleTasks } from '@/lib/settings'
import { useSending } from '@/lib/upload'
import { t } from '@/lib/i18n'

const MAX_FILE = 4 * 1024 ** 3

const rings = 'flex flex-wrap justify-center gap-x-6 gap-y-5 sm:justify-start'

function useAccount() {
  return useQuery({ queryKey: ['account'], queryFn: () => api.get<Account>('/account'), retry: false })
}

function useTrackedData(): Task[] {
  return useTasks(useTrackedTasks())
    .map((result) => result.data)
    .filter((task): task is Task => !!task)
}

function SystemSection() {
  const health = useQuery({ queryKey: ['health'], queryFn: () => api.get<Health>('/health'), refetchInterval: 15000 })
  const checks = health.data ? healthChecks(health.data) : []
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
          <ul className={`fx-stagger ${rings} flex-1`}>
            {checks.map(([key, value]) => (
              <li key={key}>
                <Ring size="sm" value={value ? 1 : 0} center={value ? 'OK' : '×'} label={HEALTH_LABELS[key] ? t(HEALTH_LABELS[key]) : key} tone={value ? 'ok' : 'fail'} />
              </li>
            ))}
          </ul>
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
      {account.error instanceof ApiError && account.error.code === 'telegram_unauthorized' ? (
        <p className="text-sm text-muted-foreground">{t('dashboard.telegramOff')}</p>
      ) : (
        account.error && <p className="text-sm text-destructive">{account.error.message}</p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-8 sm:justify-start">
        <ChannelsRing usage={usage} />
        <div className={rings}>
          {usage.accountWide && <Ring value={storages.length / Math.max(usage.used, 1)} center={storages.length} label={t('dashboard.storagesShort')} caption={t('dashboard.ofAccountChannels')} />}
          {account.data && (
            <Ring value={account.data.premium ? 1 : 0} center={t(account.data.premium ? 'common.yes' : 'common.no')} label="premium" caption={t('dashboard.channelLimit', { n: usage.limit })} tone={account.data.premium ? 'ok' : 'idle'} />
          )}
          {account.data && (
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
  const counts = taskCounts(tasks)
  const total = Math.max(tasks.length + sending.length, 1)
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

export function DashboardPage() {
  const { data: me } = useMe()
  const showMap = useSettings().interface.activity_map
  const totals = storageTotals(useStorages().data ?? [])
  const tasks = useTrackedData()
  const active = tasks.filter((t) => t.status === 'queued' || t.status === 'running').length + useSending().length

  return (
    <div className="grid">
      <header className="grid items-center gap-6 pb-8 md:grid-cols-[1fr_auto] md:pb-10">
        <div className="grid gap-4">
          <PageTitle text={t('nav.dashboard')} eyebrow={t('dashboard.eyebrow')} className="text-[40px] sm:text-[50px] md:text-[80px]" />
        </div>
        <WireCubes className="hidden w-64 md:block" />
      </header>
      <Achievements files={totals.files} size={totals.size} checklist={false} />
      {me?.role === 'root' && <Checklist />}
      <section aria-label={t('dashboard.summary')} className="fx-dotted grid grid-cols-2 border-t lg:grid-cols-4 [&>*]:fx-dotted [&>*:nth-child(even)]:border-l lg:[&>*:not(:first-child)]:border-l [&>*:nth-child(n+3)]:border-t lg:[&>*:nth-child(n+3)]:border-t-0">
        <Stat label={t('dashboard.filesUploaded')} value={totals.files} />
        <Stat label={t('dashboard.totalSize')} value={totals.size} format={formatBytes} />
        <Stat label={t('dashboard.storagesShort')} value={totals.storages} />
        <Stat label={t('dashboard.activeTasks')} value={active} />
      </section>
      <ChannelsSection />
      <StoragesSection />
      <ActivitySection />
      {showMap && (
        <Section label={t('dashboard.map')}>
          <ActivityMap />
        </Section>
      )}
      <SystemSection />
      {isAdmin(me) && <UsersSection />}
    </div>
  )
}
