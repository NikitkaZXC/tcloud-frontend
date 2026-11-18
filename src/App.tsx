import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { NotFound } from '@/components/extras'
import { Layout } from '@/components/layout'
import { useFeature } from '@/lib/features'
import { useLang } from '@/lib/i18n'
import { startPath, useSettings } from '@/lib/settings'
import { FilesPage } from '@/pages/files'
import { LoginPage } from '@/pages/login'

const AccountPage = lazy(() => import('@/pages/account').then((m) => ({ default: m.AccountPage })))
const DashboardPage = lazy(() => import('@/pages/dashboard').then((m) => ({ default: m.DashboardPage })))
const SearchPage = lazy(() => import('@/pages/search').then((m) => ({ default: m.SearchPage })))
const SettingsPage = lazy(() => import('@/pages/settings').then((m) => ({ default: m.SettingsPage })))
const TasksPage = lazy(() => import('@/pages/tasks').then((m) => ({ default: m.TasksPage })))
const TelegramPage = lazy(() => import('@/pages/telegram').then((m) => ({ default: m.TelegramPage })))
const UserPage = lazy(() => import('@/pages/user').then((m) => ({ default: m.UserPage })))
const UsersPage = lazy(() => import('@/pages/users').then((m) => ({ default: m.UsersPage })))

function AppRoutes() {
  const eggs = useFeature('eggs')
  const start = startPath(useSettings())
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Layout />}>
        <Route index element={<Navigate to={start} replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/files" element={<FilesPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/users/:id" element={<UserPage />} />
        <Route path="/telegram" element={<TelegramPage />} />
        <Route path="*" element={eggs ? <NotFound /> : <Navigate to={start} replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return <AppRoutes key={useLang()} />
}
