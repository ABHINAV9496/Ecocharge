import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/layout/ProtectedRoute'
import Navbar from './components/layout/Navbar'
import Home from './pages/Home'
import About from './pages/About'
import Features from './pages/Features'
import Contact from './pages/Contact'
import Login from './pages/Login'
import Register from './pages/Register'
import MapPage from './pages/MapPage'
import DashboardPage from './pages/DashboardPage'
import TripsPage from './pages/TripsPage'
import AdminPage from './pages/AdminPage'

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
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/features" element={<Features />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/login" element={user ? <Navigate to="/map" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/map" replace /> : <Register />} />
      <Route path="/map" element={<MapPage />} />
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
      <Route path="*" element={<Navigate to="/map" replace />} />
    </Routes>
  )
}

export default App
