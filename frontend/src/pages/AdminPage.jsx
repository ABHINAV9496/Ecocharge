import { useAuth } from '../context/AuthContext'
import Navbar from '../components/layout/Navbar'
import Sidebar from '../components/layout/Sidebar'
import StationOwnerDashboard from '../components/dashboard/StationOwnerDashboard'
import SuperAdminDashboard from '../components/dashboard/SuperAdminDashboard'
import EcoBotWidget from '../components/chat/EcoBotWidget'

export default function AdminPage() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <div className="pt-16 flex">
        <Sidebar />
        <div className="ml-16 md:ml-56 flex-1">
          {user?.role === 'SUPER_ADMIN' ? <SuperAdminDashboard /> : <StationOwnerDashboard />}
        </div>
      </div>
      <EcoBotWidget />
    </div>
  )
}
