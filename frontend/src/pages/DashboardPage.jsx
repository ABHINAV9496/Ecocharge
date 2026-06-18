import { useAuth } from '../context/AuthContext'
import Navbar from '../components/layout/Navbar'
import Sidebar from '../components/layout/Sidebar'
import DriverDashboard from '../components/dashboard/DriverDashboard'
import StationOwnerDashboard from '../components/dashboard/StationOwnerDashboard'
import SuperAdminDashboard from '../components/dashboard/SuperAdminDashboard'

export default function DashboardPage() {
  const { user } = useAuth()

  const renderDashboard = () => {
    if (!user) return null
    if (user.role === 'DRIVER') return <DriverDashboard />
    if (user.role === 'STATION_OWNER') return <StationOwnerDashboard />
    if (user.role === 'SUPER_ADMIN') return <SuperAdminDashboard />
    return <DriverDashboard />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <div className="pt-16 flex">
        <Sidebar />
        <div className="ml-16 md:ml-56 flex-1">
          {renderDashboard()}
        </div>
      </div>
    </div>
  )
}
