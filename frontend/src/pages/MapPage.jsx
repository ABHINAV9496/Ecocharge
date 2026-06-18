import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FiArrowLeft } from 'react-icons/fi'
import Navbar from '../components/layout/Navbar'
import MapView from '../components/map/MapView'
import RoutePlanner from '../components/map/RoutePlanner'
import { useAuth } from '../context/AuthContext'
import { DEFAULT_VEHICLE_ID, getVehicleById, getAllVehicles } from '../data/vehicleProfiles'

export default function MapPage() {
  var { user } = useAuth()
  var [routePlan, setRoutePlan] = useState(null)
  var [showPlanner, setShowPlanner] = useState(true)
  var [vehicle, setVehicle] = useState(null)
  var [batteryPercent, setBatteryPercent] = useState(80)
  var [stations, setStations] = useState([])
  var [vehicles, setVehicles] = useState([])

  useEffect(function () {
    getAllVehicles().then(function (list) {
      setVehicles(list)
      var defaultV = list.find(function (v) { return v.id === DEFAULT_VEHICLE_ID }) || list[0]
      setVehicle(defaultV)
    }).catch(function () {
      setVehicles([])
    })
  }, [])

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-950 flex flex-col">
      <Navbar />
      <div className="flex-1 flex overflow-hidden pt-16">
      {showPlanner && (
        <div className="w-[360px] shrink-0 border-r border-gray-800">
          <RoutePlanner
            vehicle={vehicle}
            setVehicle={setVehicle}
            vehicles={vehicles}
            stations={stations}
            batteryPercent={batteryPercent}
            onBatteryChange={setBatteryPercent}
            onRoutePlan={setRoutePlan}
            routePlan={routePlan}
            onClose={function () { setShowPlanner(false) }}
          />
        </div>
      )}
      <div className="flex-1 relative">
        {user && (
          <Link
            to="/dashboard"
            className="absolute top-4 left-4 z-50 flex items-center gap-2 px-3 py-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all no-underline"
          >
            <FiArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
        )}
        <MapView
          onRoutePlan={setRoutePlan}
          routePlan={routePlan}
          vehicle={vehicle}
          vehicles={vehicles}
          batteryPercent={batteryPercent}
          onVehicleChange={setVehicle}
          onBatteryChange={setBatteryPercent}
          onStationsLoad={setStations}
          onTogglePlanner={function () { setShowPlanner(!showPlanner) }}
          showPlanner={showPlanner}
        />
      </div>
      </div>
    </div>
  )
}
