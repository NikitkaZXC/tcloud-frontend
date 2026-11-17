import { Navigate, Route, Routes } from 'react-router'
import { Layout } from '@/components/layout'
import { AccountPage } from '@/pages/account'
import { FilesPage } from '@/pages/files'
import { LoginPage } from '@/pages/login'
import { TasksPage } from '@/pages/tasks'
import { TelegramPage } from '@/pages/telegram'
import { UserPage } from '@/pages/user'
import { UsersPage } from '@/pages/users'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/files" replace />} />
        <Route path="/files" element={<FilesPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/users/:id" element={<UserPage />} />
        <Route path="/telegram" element={<TelegramPage />} />
        <Route path="*" element={<Navigate to="/files" replace />} />
      </Route>
    </Routes>
  )
}
