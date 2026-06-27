import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { NotificationProvider } from './context/NotificationContext'
import NotificationToastHandler from './components/notifications/NotificationToast'
import { VehicleProvider } from './context/VehicleContext'
import ProtectedRoute from './components/layout/ProtectedRoute'
import ErrorBoundary from './components/layout/ErrorBoundary'
import Home from './pages/Home'
import About from './pages/About'
import Features from './pages/Features'
import Contact from './pages/Contact'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import MapPage from './pages/MapPage'
import DashboardPage from './pages/DashboardPage'
import TripsPage from './pages/TripsPage'
import BookingsPage from './pages/BookingsPage'
import AdminPage from './pages/AdminPage'
import StationDetailPage from './pages/StationDetailPage'
import NotificationCenter from './pages/NotificationCenter'

function App() {
  var { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <ToastProvider>
      <NotificationProvider>
        <NotificationToastHandler />
        <VehicleProvider>
          <Routes>
          <Route path="/" element={<ErrorBoundary><Home /></ErrorBoundary>} />
          <Route path="/about" element={<ErrorBoundary><About /></ErrorBoundary>} />
          <Route path="/features" element={<ErrorBoundary><Features /></ErrorBoundary>} />
          <Route path="/contact" element={<ErrorBoundary><Contact /></ErrorBoundary>} />
          <Route path="/login" element={<ErrorBoundary><Login /></ErrorBoundary>} />
          <Route path="/register" element={<ErrorBoundary>{user ? <Navigate to="/map" replace /> : <Register />}</ErrorBoundary>} />
          <Route path="/forgot-password" element={<ErrorBoundary><ForgotPassword /></ErrorBoundary>} />
          <Route path="/reset-password" element={<ErrorBoundary><ResetPassword /></ErrorBoundary>} />
          <Route path="/map" element={<ErrorBoundary><MapPage /></ErrorBoundary>} />
          <Route path="/stations/:id" element={<ErrorBoundary><StationDetailPage /></ErrorBoundary>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute roles={['DRIVER', 'STATION_OWNER', 'SUPER_ADMIN']}>
                <ErrorBoundary><DashboardPage /></ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/trips"
            element={
              <ProtectedRoute roles={['DRIVER']}>
                <ErrorBoundary><TripsPage /></ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/bookings"
            element={
              <ProtectedRoute roles={['DRIVER']}>
                <ErrorBoundary><BookingsPage /></ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute roles={['DRIVER', 'STATION_OWNER', 'SUPER_ADMIN']}>
                <ErrorBoundary><NotificationCenter /></ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={['STATION_OWNER', 'SUPER_ADMIN']}>
                <ErrorBoundary><AdminPage /></ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/map" replace />} />
        </Routes>
      </VehicleProvider>
      </NotificationProvider>
    </ToastProvider>
  )
}

export default App
