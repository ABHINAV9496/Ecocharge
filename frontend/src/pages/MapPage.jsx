import { useAuth } from '../context/AuthContext'
import Navbar from '../components/layout/Navbar'
import Sidebar from '../components/layout/Sidebar'
import MapView from '../components/map/MapView'
import EcoBotWidget from '../components/chat/EcoBotWidget'

export default function MapPage() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <div className="pt-16 flex">
        {user && <Sidebar />}
        <div className={user ? 'ml-16 md:ml-56 flex-1' : 'flex-1'}>
          <MapView />
        </div>
      </div>
      <EcoBotWidget />
    </div>
  )
}
