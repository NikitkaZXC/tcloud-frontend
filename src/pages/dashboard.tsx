import { useQuery } from '@tanstack/react-query'
import { XIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { CountUp, PageTitle, StatusLight, TermStatus } from '@/components/fx'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useProgress } from '@/hooks/use-fx'
import { isAdmin, useMe } from '@/hooks/use-me'
import { useStorages } from '@/hooks/use-storages'
import { useTasks } from '@/hooks/use-tasks'
import { api } from '@/lib/api'
import { HEALTH_LABELS, healthChecks, storageTotals, taskCounts } from '@/lib/dashboard'
import { formatBytes } from '@/lib/format'
import { checklist, dismiss, isDismissed } from '@/lib/onboarding'
import { easeOut } from '@/lib/fx'
import { TASK_STAGE, TASK_STATUS, useTrackedTasks } from '@/lib/tasks'
import type { Account, Health, Task, TelegramSessionState, User } from '@/lib/types'
import { useSending } from '@/lib/upload'

function Tile({ label, value, format, tone }: { label: string; value: number; format?: (value: number) => string; tone: string }) {
  return (
    <Card size="sm">
      <CardContent className="grid gap-1">
        <span className="font-mono text-xs text-muted-foreground uppercase">// {label}</span>
        <span className={`fx-neon font-heading text-3xl font-bold ${tone}`}>
          <CountUp value={value} format={format} />
        </span>
      </CardContent>
    </Card>
  )
}

function Gauge({ ratio }: { ratio: number }) {
  const progress = useProgress(1200, ratio)
  const length = 2 * Math.PI * 40
  return (
    <svg viewBox="0 0 100 100" className="size-28 shrink-0 -rotate-90" role="img" aria-label={`${Math.round(ratio * 100)}% в норме`}>
      <circle cx="50" cy="50" r="40" fill="none" stroke="var(--muted)" strokeWidth="8" />
      <circle
        cx="50"
        cy="50"
        r="40"
        fill="none"
        stroke={ratio === 1 ? 'var(--neon-green)' : 'var(--neon-red)'}
        strokeWidth="8"
        strokeDasharray={length}
        strokeDashoffset={length * (1 - ratio * easeOut(progress))}
        style={{ filter: 'drop-shadow(0 0 4px currentColor)' }}
      />
      <text x="50" y="50" className="rotate-90 fill-foreground font-mono text-base" style={{ transformOrigin: '50px 50px' }} textAnchor="middle" dominantBaseline="central">
        {Math.round(ratio * 100)}%
      </text>
    </svg>
  )
}

function SystemPanel() {
  const health = useQuery({ queryKey: ['health'], queryFn: () => api.get<Health>('/health'), refetchInterval: 15000 })
  const account = useQuery({ queryKey: ['account'], queryFn: () => api.get<Account>('/account'), retry: false })
  const checks = health.data ? healthChecks(health.data) : []
  const ok = checks.filter(([, value]) => value).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          Система {health.data && <TermStatus status={health.data.ok ? 'ok' : 'fail'} />}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {health.isPending && <TermStatus status="wait" />}
        {health.error && <p className="text-sm text-destructive">{health.error.message}</p>}
        {checks.length > 0 && (
          <div className="flex items-center gap-4">
            <Gauge ratio={ok / checks.length} />
            <ul className="fx-stagger grid min-w-0 flex-1 gap-1.5 font-mono text-xs">
              {checks.map(([key, value]) => (
                <li key={key} className="flex items-center gap-2">
                  <StatusLight ok={value} />
                  <span className="truncate">{HEALTH_LABELS[key] ?? key}</span>
                  <span className={value ? 'ml-auto text-muted-foreground' : 'ml-auto text-neon-red'}>{value ? 'online' : 'down'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {account.data && (
          <p className="font-mono text-xs text-muted-foreground">
            premium: {account.data.premium ? 'да' : 'нет'} · лимит файла: {formatBytes(account.data.file_limit)}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function StorageUsage() {
  const storages = useStorages()
  const max = storageTotals(storages.data ?? []).max

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Хранилища</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {storages.isPending && <TermStatus status="wait" />}
        {storages.error && <p className="text-sm text-destructive">{storages.error.message}</p>}
        {storages.data?.length === 0 && <p className="font-mono text-xs text-muted-foreground">&gt; хранилищ нет</p>}
        <ul className="fx-stagger grid gap-3">
          {storages.data?.map((storage, i) => (
            <li key={storage.id} className="grid gap-1">
              <div className="flex items-center gap-2 text-sm">
                <StatusLight ok={storage.available} />
                <Link to={`/files?path=${encodeURIComponent(storage.path)}`} className="min-w-0 flex-1 truncate hover:underline">
                  {storage.name ?? storage.id}
                </Link>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {storage.files ?? '—'} ф · {formatBytes(storage.total_size)}
                </span>
              </div>
              <div className="h-1.5 bg-muted">
                <div
                  className="fx-grow h-full"
                  style={{
                    width: `${max ? ((storage.total_size ?? 0) / max) * 100 : 0}%`,
                    background: `var(--chart-${(i % 5) + 1})`,
                    boxShadow: 'var(--glow)',
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
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
          <span className="flex gap-3 font-mono text-xs font-normal normal-case">
            <span className="text-neon-yellow">run {counts.running + sending.length}</span>
            <span className="text-muted-foreground">queue {counts.queued}</span>
            <span className="text-neon-green">ok {counts.done}</span>
            <span className="text-neon-red">fail {counts.failed + counts.cancelled}</span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="fx-stagger grid max-h-96 gap-2 overflow-y-auto bg-background/60 p-3 font-mono text-xs ring-1 ring-border">
          {sending.map((item) => (
            <li key={`s${item.id}`} className="grid gap-1">
              <div className="flex items-center gap-2">
                <TermStatus status="wait" />
                <span className="min-w-0 flex-1 truncate">{item.path.split('/').pop()}</span>
                <span className="shrink-0 text-muted-foreground">
                  отправка {formatBytes(item.loaded)} / {formatBytes(item.total)}
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
                  <TermStatus status={status} />
                  <span className="min-w-0 flex-1 truncate">{task.archive?.name ?? task.path.split('/').pop()}</span>
                  <span className={status === 'fail' ? 'shrink-0 text-neon-red' : 'shrink-0 text-muted-foreground'}>
                    {text}
                    {task.status === 'running' && task.progress != null && ` · ${(task.progress * 100).toFixed(0)}%`}
                  </span>
                </div>
                {task.status === 'running' && <Progress value={task.progress != null ? task.progress * 100 : null} />}
              </li>
            )
          })}
          {sending.length + tasks.length === 0 && <li className="fx-cursor text-muted-foreground">&gt; задач нет</li>}
        </ul>
        <Link to="/tasks" className="mt-2 inline-block font-mono text-xs text-primary hover:underline">
          &gt; все задачи
        </Link>
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
          <span className="fx-neon font-heading text-2xl text-neon-magenta">
            <CountUp value={list.length} />
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {users.error && <p className="text-sm text-destructive">{users.error.message}</p>}
        <ul className="fx-stagger grid gap-1.5 font-mono text-xs">
          {rows.map(([label, count]) => (
            <li key={label} className="flex justify-between gap-2">
              <span className="text-muted-foreground">{label}</span>
              <span className={label === 'blocked' && count ? 'text-neon-red' : ''}>{count}</span>
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
        <ol className="fx-stagger grid gap-2 font-mono text-sm">
          {steps.map((step, i) => (
            <li key={step.key} className="flex flex-wrap items-center gap-2">
              <TermStatus status={step.done ? 'ok' : 'wait'} />
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
    <div className="grid gap-4">
      <PageTitle text="Дашборд" />
      {me?.role === 'root' && <Checklist />}
      <div className="fx-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="хранилища" value={totals.storages} tone="text-neon-cyan" />
        <Tile label="файлы" value={totals.files} tone="text-neon-magenta" />
        <Tile label="объём" value={totals.size} format={formatBytes} tone="text-neon-green" />
        <Tile label="в работе" value={active} tone="text-neon-yellow" />
      </div>
      <div className="fx-stagger grid gap-4 lg:grid-cols-3">
        <SystemPanel />
        <StorageUsage />
        <Feed />
        {isAdmin(me) && <UsersPanel />}
      </div>
    </div>
  )
}
