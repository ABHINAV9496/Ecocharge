import { useState, useEffect } from 'react'
import MapView from '../components/map/MapView'
import RoutePlanner from '../components/map/RoutePlanner'
import EcoBotWidget from '../components/chat/EcoBotWidget'
import { DEFAULT_VEHICLE_ID, getVehicleById, getAllVehicles } from '../data/vehicleProfiles'

export default function MapPage() {
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
    <div className="h-screen w-screen overflow-hidden bg-gray-950 flex">
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
        <EcoBotWidget />
      </div>
    </div>
  )
}
