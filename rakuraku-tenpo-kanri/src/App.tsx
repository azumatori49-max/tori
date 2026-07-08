import { Navigate, Route, Routes } from 'react-router-dom'
import { useApp } from './AppContext'
import { UpdateToast } from './components/UpdateToast'
import { LoginPage } from './pages/LoginPage'
import { StaffHome } from './pages/staff/StaffHome'
import { CheckPage } from './pages/staff/CheckPage'
import { HistoryPage } from './pages/staff/HistoryPage'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { StoresPage } from './pages/admin/StoresPage'
import { SettingsPage } from './pages/admin/SettingsPage'
import { FeedbackInbox } from './pages/admin/FeedbackInbox'
import { ErrorLogsPage } from './pages/admin/ErrorLogsPage'
import type { Role } from './lib/types'

function homeOf(role: Role): string {
  if (role === 'staff') return '/staff'
  if (role === 'admin') return '/admin'
  return '/view'
}

export default function App() {
  const { session } = useApp()

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={session ? <Navigate to={homeOf(session.role)} replace /> : <LoginPage />}
        />
        {session?.role === 'staff' && (
          <>
            <Route path="/staff" element={<StaffHome />} />
            <Route path="/staff/check/:type" element={<CheckPage />} />
            <Route path="/staff/history" element={<HistoryPage />} />
          </>
        )}
        {session?.role === 'admin' && (
          <>
            <Route path="/admin" element={<AdminDashboard readonly={false} />} />
            <Route path="/admin/stores" element={<StoresPage />} />
            <Route path="/admin/settings" element={<SettingsPage />} />
            <Route path="/admin/feedback" element={<FeedbackInbox />} />
            <Route path="/admin/errors" element={<ErrorLogsPage />} />
          </>
        )}
        {session?.role === 'viewer' && (
          <Route path="/view" element={<AdminDashboard readonly />} />
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <UpdateToast />
    </>
  )
}
