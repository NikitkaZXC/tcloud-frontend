import { Navigate, Route, Routes } from 'react-router'
import { NotFound } from '@/components/extras'
import { Layout } from '@/components/layout'
import { useFeature } from '@/lib/features'
import { startPath, useSettings } from '@/lib/settings'
import { AccountPage } from '@/pages/account'
import { DashboardPage } from '@/pages/dashboard'
import { FilesPage } from '@/pages/files'
import { LoginPage } from '@/pages/login'
import { SearchPage } from '@/pages/search'
import { SettingsPage } from '@/pages/settings'
import { TasksPage } from '@/pages/tasks'
import { TelegramPage } from '@/pages/telegram'
import { UserPage } from '@/pages/user'
import { UsersPage } from '@/pages/users'

export default function App() {
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
