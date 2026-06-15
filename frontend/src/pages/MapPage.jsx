import { useState } from 'react'
import MapView from '../components/map/MapView'
import RoutePlanner from '../components/map/RoutePlanner'
import EcoBotWidget from '../components/chat/EcoBotWidget'
import { DEFAULT_VEHICLE_ID, getVehicleById } from '../data/vehicleProfiles'

export default function MapPage() {
  var [routePlan, setRoutePlan] = useState(null)
  var [showPlanner, setShowPlanner] = useState(true)
  var [vehicle, setVehicle] = useState(getVehicleById(DEFAULT_VEHICLE_ID))
  var [batteryPercent, setBatteryPercent] = useState(80)
  var [stations, setStations] = useState([])

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-950 flex">
      {showPlanner && (
        <div className="w-[360px] shrink-0 border-r border-gray-800">
          <RoutePlanner
            vehicle={vehicle}
            setVehicle={setVehicle}
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
