/*
  App Root
  --------
  The main routing component for the entire frontend.

  How it works:
  1. Shows a loading spinner while auth state is being checked
  2. After loading, renders a set of routes:
     - Home (/) — landing page (redirects to /map if logged in)
     - Login (/login) — auth page (redirects to /map if already logged in)
     - Register (/register) — sign up page (redirects to /map if already logged in)
     - Map (/map) — main station map (any role including GUEST)
     - Dashboard (/dashboard) — role-specific dashboard
     - Trips (/trips) — trip planner and history (DRIVER only)
     - Admin (/admin) — station management (STATION_OWNER, SUPER_ADMIN)
  3. ProtectedRoute checks if the user has the required role
  4. Unknown paths (*) redirect back to home
*/

import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/layout/ProtectedRoute'
import Navbar from './components/layout/Navbar'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import MapPage from './pages/MapPage'
import DashboardPage from './pages/DashboardPage'
import TripsPage from './pages/TripsPage'
import AdminPage from './pages/AdminPage'

function App() {
  var { user, loading } = useAuth()

  // CASE: Auth is still loading — show spinner
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  // CASE: Auth loaded — render routes
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/map" replace /> : <Home />} />
      <Route path="/login" element={user ? <Navigate to="/map" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/map" replace /> : <Register />} />
      <Route
        path="/map"
        element={
          <ProtectedRoute roles={['DRIVER', 'GUEST', 'STATION_OWNER', 'SUPER_ADMIN']}>
            <MapPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute roles={['DRIVER', 'STATION_OWNER', 'SUPER_ADMIN']}>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/trips"
        element={
          <ProtectedRoute roles={['DRIVER']}>
            <TripsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['STATION_OWNER', 'SUPER_ADMIN']}>
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
