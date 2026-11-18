import { Navigate, Route, Routes } from 'react-router'
import { NotFound } from '@/components/extras'
import { Layout } from '@/components/layout'
import { useFeature } from '@/lib/features'
import { AccountPage } from '@/pages/account'
import { DashboardPage } from '@/pages/dashboard'
import { FilesPage } from '@/pages/files'
import { LoginPage } from '@/pages/login'
import { TasksPage } from '@/pages/tasks'
import { TelegramPage } from '@/pages/telegram'
import { UserPage } from '@/pages/user'
import { UsersPage } from '@/pages/users'

export default function App() {
  const eggs = useFeature('eggs')
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/files" element={<FilesPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/users/:id" element={<UserPage />} />
        <Route path="/telegram" element={<TelegramPage />} />
        <Route path="*" element={eggs ? <NotFound /> : <Navigate to="/files" replace />} />
      </Route>
    </Routes>
  )
}
