import { useQuery } from '@tanstack/react-query'
import { ArrowUpRightIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { ResumeLink } from '@/components/storages'
import { CountUp, PageTitle, StatusChip, StatusLight, UploadPulse } from '@/components/fx'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useProgress } from '@/hooks/use-fx'
import { isAdmin, useMe } from '@/hooks/use-me'
import { useStorageActivity, useStorages } from '@/hooks/use-storages'
import { useTasks } from '@/hooks/use-tasks'
import { api } from '@/lib/api'
import { HEALTH_LABELS, healthChecks, storageTotals, taskCounts } from '@/lib/dashboard'
import { formatBytes } from '@/lib/format'
import { checklist, dismiss, isDismissed } from '@/lib/onboarding'
import { easeOut } from '@/lib/fx'
import { TASK_STAGE, TASK_STATUS, useTrackedTasks } from '@/lib/tasks'
import type { Account, Health, Task, TelegramSessionState, User } from '@/lib/types'
import { useSending } from '@/lib/upload'

function Stat({ label, value, format }: { label: string; value: number; format?: (value: number) => string }) {
  return (
    <div className="grid content-center gap-1 px-5 py-4 text-center">
      <span className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        <CountUp value={value} format={format} />
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function Gauge({ ratio }: { ratio: number }) {
  const progress = useProgress(1200, ratio)
  const length = 2 * Math.PI * 40
  return (
    <svg viewBox="0 0 100 100" className="size-28 shrink-0 -rotate-90" role="img" aria-label={`${Math.round(ratio * 100)}% в норме`}>
      <circle cx="50" cy="50" r="40" fill="none" stroke="var(--well)" strokeWidth="8" />
      <circle
        cx="50"
        cy="50"
        r="40"
        fill="none"
        stroke={ratio === 1 ? 'var(--success)' : 'var(--destructive)'}
        strokeLinecap="round"
        strokeWidth="8"
        strokeDasharray={length}
        strokeDashoffset={length * (1 - ratio * easeOut(progress))}
        style={{ filter: 'drop-shadow(0 0 4px currentColor)' }}
      />
      <text x="50" y="50" className="rotate-90 fill-foreground text-base font-bold tabular-nums" style={{ transformOrigin: '50px 50px' }} textAnchor="middle" dominantBaseline="central">
        {Math.round(ratio * 100)}%
      </text>
    </svg>
  )
}

function SystemPanel() {
  const health = useQuery({ queryKey: ['health'], queryFn: () => api.get<Health>('/health'), refetchInterval: 15000 })
  const checks = health.data ? healthChecks(health.data) : []
  const ok = checks.filter(([, value]) => value).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          Система {health.data && <StatusChip status={health.data.ok ? 'ok' : 'fail'} label={health.data.ok ? 'в норме' : 'сбой'} />}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {health.isPending && <StatusChip status="wait" label="проверка" />}
        {health.error && <p className="text-sm text-destructive">{health.error.message}</p>}
        {checks.length > 0 && (
          <div className="flex items-center gap-4">
            <Gauge ratio={ok / checks.length} />
            <ul className="fx-stagger grid min-w-0 flex-1 gap-2 text-sm">
              {checks.map(([key, value]) => (
                <li key={key} className="flex items-center gap-2">
                  <StatusLight ok={value} />
                  <span className="truncate">{HEALTH_LABELS[key] ?? key}</span>
                  <span className={value ? 'ml-auto text-xs text-muted-foreground' : 'ml-auto text-xs font-semibold text-destructive'}>{value ? 'в сети' : 'недоступен'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StorageUsage() {
  const storages = useStorages()
  const activity = useStorageActivity(storages.data ?? [])

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Хранилища</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {storages.isPending && <StatusChip status="wait" label="загрузка" />}
        {storages.error && <p className="text-sm text-destructive">{storages.error.message}</p>}
        {storages.data?.length === 0 && <p className="text-sm text-muted-foreground">Хранилищ пока нет</p>}
        <ul className="fx-stagger grid gap-3">
          {storages.data?.map((storage) => (
            <li key={storage.id} className="grid gap-1">
              <div className="flex items-center gap-2 text-sm">
                <StatusLight ok={storage.available} />
                <Link to={`/files?path=${encodeURIComponent(storage.path)}`} className="min-w-0 flex-1 truncate font-semibold hover:underline">
                  {storage.name ?? storage.id}
                </Link>
              </div>
              {activity[storage.id] && <UploadPulse activity={activity[storage.id]} />}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function AccountPanel() {
  const account = useQuery({ queryKey: ['account'], queryFn: () => api.get<Account>('/account'), retry: false })
  const totals = storageTotals(useStorages().data ?? [])
  const limit = account.data?.premium ? 1000 : 500

  return (
    <Card>
      <CardHeader>
        <CardTitle>Аккаунт Telegram</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-1">
          <span className="text-4xl font-extrabold tracking-tight">
            <CountUp value={totals.size} format={formatBytes} />
          </span>
          <span className="text-xs text-muted-foreground">хранится во всех хранилищах</span>
        </div>
        {account.error && <p className="text-sm text-destructive">{account.error.message}</p>}
        <ul className="grid text-sm">
          {account.data && (
            <li className="fx-dotted flex justify-between gap-2 border-b py-1.5">
              <span className="text-muted-foreground">Premium</span>
              <span className="font-semibold">{account.data.premium ? 'да' : 'нет'}</span>
            </li>
          )}
          {account.data && (
            <li className="fx-dotted flex justify-between gap-2 border-b py-1.5">
              <span className="text-muted-foreground">лимит файла</span>
              <span className="font-semibold tabular-nums">{formatBytes(account.data.file_limit)}</span>
            </li>
          )}
          <li className="fx-dotted flex justify-between gap-2 border-b py-1.5 last:border-b-0">
            <span className="text-muted-foreground">хранилищ</span>
            <span className="font-semibold tabular-nums">{totals.storages}</span>
          </li>
          {account.data?.channels_used != null && (
            <li className="fx-dotted flex justify-between gap-2 border-b py-1.5 last:border-b-0">
              <span className="text-muted-foreground">каналов у аккаунта</span>
              <span className="font-semibold tabular-nums">{account.data.channels_used}</span>
            </li>
          )}
          {account.data && (
            <li className="fx-dotted flex justify-between gap-2 border-b py-1.5 last:border-b-0">
              <span className="text-muted-foreground">лимит каналов аккаунта</span>
              <span className="font-semibold tabular-nums">{limit}</span>
            </li>
          )}
        </ul>
        <p className="text-xs text-muted-foreground">Лимит считает все каналы и группы аккаунта, не только хранилища.</p>
      </CardContent>
    </Card>
  )
}

function line(task: Task): { status: 'ok' | 'fail' | 'wait'; text: string } {
  if (task.status === 'done') return { status: 'ok', text: TASK_STATUS.done.label }
  if (task.status === 'failed' || task.status === 'cancelled') return { status: 'fail', text: task.error?.message ?? TASK_STATUS[task.status].label }
  if (task.status === 'queued') return { status: 'wait', text: task.queue_position != null ? `в очереди #${task.queue_position}` : TASK_STATUS.queued.label }
  return { status: 'wait', text: TASK_STAGE[task.stage] ?? task.stage }
}

function Feed() {
  const sending = useSending()
  const tasks = useTasks(useTrackedTasks())
    .map((result) => result.data)
    .filter((task): task is Task => !!task)
  const counts = taskCounts(tasks)

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          Активность
          <span className="flex flex-wrap gap-1.5 text-xs font-semibold tabular-nums">
            <span className="fx-chip text-warning">в работе {counts.running + sending.length}</span>
            <span className="fx-chip text-muted-foreground">в очереди {counts.queued}</span>
            <span className="fx-chip text-success">готово {counts.done}</span>
            <span className="fx-chip text-destructive">ошибки {counts.failed + counts.cancelled}</span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="fx-stagger fx-well grid max-h-96 gap-3 overflow-y-auto rounded-2xl p-3 text-sm">
          {sending.map((item) => (
            <li key={`s${item.id}`} className="grid gap-1">
              <div className="flex items-center gap-2">
                <StatusChip status="wait" label="отправка" />
                <span className="min-w-0 flex-1 truncate">{item.path.split('/').pop()}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {formatBytes(item.loaded)} / {formatBytes(item.total)}
                </span>
              </div>
              <Progress value={(item.loaded / Math.max(item.total, 1)) * 100} />
            </li>
          ))}
          {tasks.slice(0, 20).map((task) => {
            const { status, text } = line(task)
            return (
              <li key={task.id} className="grid gap-1">
                <div className="flex items-center gap-2">
                  <StatusChip status={status} />
                  <span className="min-w-0 flex-1 truncate">{task.archive?.name ?? task.path.split('/').pop()}</span>
                  <span className={status === 'fail' ? 'shrink-0 text-xs text-destructive' : 'shrink-0 text-xs text-muted-foreground tabular-nums'}>
                    {text}
                    {task.status === 'running' && task.progress != null && ` · ${(task.progress * 100).toFixed(0)}%`}
                  </span>
                </div>
                {task.status === 'running' && <Progress value={task.progress != null ? task.progress * 100 : null} />}
              </li>
            )
          })}
          {sending.length + tasks.length === 0 && <li className="py-2 text-center text-muted-foreground">Задач нет</li>}
        </ul>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link to="/tasks">
            Все задачи <ArrowUpRightIcon />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function UsersPanel() {
  const users = useQuery({ queryKey: ['users'], queryFn: () => api.get<User[]>('/users') })
  const list = users.data ?? []
  const rows: [string, number][] = [
    ['root', list.filter((u) => u.role === 'root').length],
    ['admin', list.filter((u) => u.role === 'admin').length],
    ['user', list.filter((u) => u.role === 'user').length],
    ['blocked', list.filter((u) => u.blocked).length],
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Пользователи
          <span className="text-3xl font-extrabold text-primary">
            <CountUp value={list.length} />
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {users.error && <p className="text-sm text-destructive">{users.error.message}</p>}
        <ul className="fx-stagger grid text-sm">
          {rows.map(([label, count]) => (
            <li key={label} className="fx-dotted flex justify-between gap-2 border-b py-1.5 last:border-b-0">
              <span className="text-muted-foreground">{label}</span>
              <span className={label === 'blocked' && count ? 'font-semibold text-destructive tabular-nums' : 'font-semibold tabular-nums'}>{count}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function Checklist() {
  const [hidden, setHidden] = useState(isDismissed)
  const telegram = useQuery({ queryKey: ['telegram'], queryFn: () => api.get<{ sessions: TelegramSessionState[] }>('/telegram') })
  const storages = useStorages()
  if (hidden || !telegram.data || !storages.data) return null
  const steps = checklist(telegram.data.sessions, storages.data)
  if (steps.every((step) => step.done)) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          Первый запуск
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Скрыть чек-лист"
            onClick={() => {
              dismiss()
              setHidden(true)
            }}
          >
            <XIcon />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="fx-stagger grid gap-2 text-sm">
          {steps.map((step, i) => (
            <li key={step.key} className="flex flex-wrap items-center gap-2">
              <StatusChip status={step.done ? 'ok' : 'wait'} label={step.done ? 'готово' : 'нужно'} />
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
      </CardContent>
    </Card>
  )
}

export function DashboardPage() {
  const { data: me } = useMe()
  const totals = storageTotals(useStorages().data ?? [])
  const active = useTasks(useTrackedTasks()).filter((r) => r.data?.status === 'queued' || r.data?.status === 'running').length + useSending().length

  return (
    <div className="grid gap-5">
      <header className="relative isolate grid gap-2 py-6 md:py-10">
        <span className="absolute inset-0 -z-10 overflow-hidden" aria-hidden>
          <span className="fx-numeral -top-2 right-0 text-[clamp(5rem,16vw,12rem)]">{formatBytes(totals.size)}</span>
        </span>
        <span className="fx-orb top-2 -left-6 size-36" aria-hidden />
        <PageTitle text="Дашборд" className="text-4xl md:text-5xl" />
        <p className="text-sm text-muted-foreground">Хранилища, задачи и состояние системы</p>
        <ResumeLink />
      </header>
      {me?.role === 'root' && <Checklist />}
      <section aria-label="Сводка" className="fx-panel flex items-stretch">
        <span className="fx-vlabel hidden border-r fx-dotted px-3 py-4 text-center sm:block" aria-hidden>
          сводка
        </span>
        <div className="fx-stagger grid flex-1 grid-cols-2 lg:grid-cols-4 [&>*]:fx-dotted [&>*:nth-child(n+3)]:border-t lg:[&>*:nth-child(n+3)]:border-t-0 [&>*:not(:first-child)]:border-l [&>*:nth-child(3)]:border-l-0 lg:[&>*:nth-child(3)]:border-l">
          <Stat label="хранилища" value={totals.storages} />
          <Stat label="файлы" value={totals.files} />
          <Stat label="объём" value={totals.size} format={formatBytes} />
          <Stat label="в работе" value={active} />
        </div>
      </section>
      <div className="fx-stagger grid gap-4 lg:grid-cols-3">
        <SystemPanel />
        <StorageUsage />
        <Feed />
        <AccountPanel />
        {isAdmin(me) && <UsersPanel />}
      </div>
    </div>
  )
}
