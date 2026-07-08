import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { NotificationProvider } from './context/NotificationContext'
import NotificationToastHandler from './components/notifications/NotificationToast'
import { VehicleProvider } from './context/VehicleContext'
import { AIProvider } from './context/AIContext'
import AiChatButton from './components/ai/AiChatButton'
import AiChatWindow from './components/ai/AiChatWindow'
import ProtectedRoute from './components/layout/ProtectedRoute'
import ErrorBoundary from './components/layout/ErrorBoundary'

var Home = lazy(function () { return import('./pages/Home') })
var About = lazy(function () { return import('./pages/About') })
var Features = lazy(function () { return import('./pages/Features') })
var Contact = lazy(function () { return import('./pages/Contact') })
var Login = lazy(function () { return import('./pages/Login') })
var Register = lazy(function () { return import('./pages/Register') })
var ForgotPassword = lazy(function () { return import('./pages/ForgotPassword') })
var ResetPassword = lazy(function () { return import('./pages/ResetPassword') })
var MapPage = lazy(function () { return import('./pages/MapPage') })
var DashboardPage = lazy(function () { return import('./pages/DashboardPage') })
var TripsPage = lazy(function () { return import('./pages/TripsPage') })
var BookingsPage = lazy(function () { return import('./pages/BookingsPage') })
var AdminPage = lazy(function () { return import('./pages/AdminPage') })
var StationDetailPage = lazy(function () { return import('./pages/StationDetailPage') })
var NotificationCenter = lazy(function () { return import('./pages/NotificationCenter') })

function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-950">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-500 border-t-transparent" />
    </div>
  )
}

function App() {
  var { user, loading } = useAuth()
  var location = useLocation()

  if (loading) {
    return <PageLoader />
  }

  return (
    <ToastProvider>
      <NotificationProvider>
        <NotificationToastHandler />
        <VehicleProvider>
          <AIProvider>
          <Suspense fallback={<PageLoader />}>
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
          </Suspense>
          {(user || location.pathname === '/') && <AiChatButton />}
          {(user || location.pathname === '/') && <AiChatWindow />}
        </AIProvider>
        </VehicleProvider>
      </NotificationProvider>
    </ToastProvider>
  )
}

export default App
