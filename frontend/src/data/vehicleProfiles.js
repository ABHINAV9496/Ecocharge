import { getVehicles as fetchVehicles, createVehicle, deleteVehicle } from '../api/vehicles'

var cachedVehicles = null

export async function getAllVehicles() {
  if (cachedVehicles) return cachedVehicles
  var res = await fetchVehicles()
  cachedVehicles = res.data || []
  return cachedVehicles
}

export function invalidateCache() {
  cachedVehicles = null
}

export async function getVehicleById(id) {
  var all = await getAllVehicles()
  return all.find(function (v) { return v.id === id }) || null
}

export async function addCustomVehicle(v) {
  var res = await createVehicle(v)
  invalidateCache()
  return res.data
}

export async function removeCustomVehicle(id) {
  await deleteVehicle(id)
  invalidateCache()
}

export function getEstimatedRange(vehicle, batteryPercent) {
  if (!vehicle) return 0
  var usableKwh = vehicle.battery_kwh * (batteryPercent / 100) * 0.9
  var rangeKm = (usableKwh / vehicle.consumption_wh_per_km) * 1000
  return Math.round(rangeKm)
}

var DEFAULT_VEHICLE_ID = 'tata-nexon-ev'
export { DEFAULT_VEHICLE_ID }
