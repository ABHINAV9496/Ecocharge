import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/layout/Navbar'
import Sidebar from '../components/layout/Sidebar'
import TripPlanner from '../components/trip/TripPlanner'
import TripHistory from '../components/trip/TripHistory'

export default function TripsPage() {
  const { user } = useAuth()
  var location = useLocation()
  var initialTab = (location.state && location.state.tripId) ? 'history' : 'planner'
  var [activeTab, setActiveTab] = useState(initialTab)

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
                  onClick={() => { setActiveTab('planner') }}
                  className={'px-4 py-3 text-sm font-medium transition-colors ' + (activeTab === 'planner' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300')}
                >
                  Trip Planner
                </button>
                <button
                  onClick={() => { setActiveTab('history') }}
                  className={'px-4 py-3 text-sm font-medium transition-colors ' + (activeTab === 'history' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300')}
                >
                  History
                </button>
              </div>
            </div>
          </div>
          {activeTab === 'planner' && <div id="planner"><TripPlanner /></div>}
          {activeTab === 'history' && <div id="history"><TripHistory highlightId={location.state && location.state.tripId} /></div>}
        </div>
      </div>
    </div>
  )
}
