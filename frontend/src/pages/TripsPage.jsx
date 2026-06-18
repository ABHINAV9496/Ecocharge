import { useAuth } from '../context/AuthContext'
import Navbar from '../components/layout/Navbar'
import Sidebar from '../components/layout/Sidebar'
import TripPlanner from '../components/trip/TripPlanner'
import TripHistory from '../components/trip/TripHistory'

export default function TripsPage() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <div className="pt-16 flex">
        <Sidebar />
        <div className="ml-16 md:ml-56 flex-1">
          <div className="border-b border-gray-200 dark:border-gray-800">
            <div className="max-w-6xl mx-auto px-4">
              <div className="flex">
                <button
                  onClick={() => {
                    const el = document.getElementById('planner')
                    if (el) el.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="px-4 py-3 text-sm font-medium text-ev-green border-b-2 border-ev-green"
                >
                  Trip Planner
                </button>
                <button
                  onClick={() => {
                    const el = document.getElementById('history')
                    if (el) el.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  History
                </button>
              </div>
            </div>
          </div>
          <div id="planner">
            <TripPlanner />
          </div>
          <div id="history">
            <TripHistory />
          </div>
        </div>
      </div>
    </div>
  )
}
