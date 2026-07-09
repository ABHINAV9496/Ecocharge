import { createContext, useContext, useState, useEffect } from 'react'
import { getAllVehicles, DEFAULT_VEHICLE_ID } from '../data/vehicleProfiles'

var VehicleContext = createContext(null)

export function VehicleProvider({ children }) {
  var [vehicle, setVehicle] = useState(null)
  var [vehicles, setVehicles] = useState([])

  useEffect(function () {
    getAllVehicles().then(function (list) {
      setVehicles(list)
      var preferredId = localStorage.getItem('preferred_vehicle_id')
      var defaultV
      if (preferredId) {
        defaultV = list.find(function (v) { return v.id === preferredId })
      }
      if (!defaultV) {
        defaultV = list.find(function (v) { return v.id === DEFAULT_VEHICLE_ID }) || list[0]
      }
      setVehicle(defaultV)
    }).catch(function () {
      setVehicles([])
    })
  }, [])

  return (
    <VehicleContext.Provider value={{ vehicle, setVehicle, vehicles, setVehicles }}>
      {children}
    </VehicleContext.Provider>
  )
}

export function useVehicle() {
  var ctx = useContext(VehicleContext)
  if (!ctx) throw new Error('useVehicle must be used within VehicleProvider')
  return ctx
}
