import { useState, useRef, useEffect } from 'react'
import { FiSearch, FiMapPin, FiBatteryCharging, FiNavigation, FiDollarSign, FiClock, FiSave, FiZap } from 'react-icons/fi'
import { createTrip } from '../../api/trips'
import { planRoute } from '../../api/routePlanner'
import { getVehicleById, DEFAULT_VEHICLE_ID } from '../../data/vehicleProfiles'
import { useAuth } from '../../context/AuthContext'

var OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0m'
  var h = Math.floor(seconds / 3600)
  var m = Math.round((seconds % 3600) / 60)
  return h > 0 ? h + 'h ' + m + 'm' : m + 'm'
}

export default function TripPlanner() {
  var { user } = useAuth()
  var [origin, setOrigin] = useState('')
  var [destination, setDestination] = useState('')
  var [originCoords, setOriginCoords] = useState(null)
  var [destCoords, setDestCoords] = useState(null)
  var [batteryPercent, setBatteryPercent] = useState(80)
  var [route, setRoute] = useState(null)
  var [isLoading, setIsLoading] = useState(false)
  var [error, setError] = useState('')
  var [saving, setSaving] = useState(false)
  var [saved, setSaved] = useState(false)
  var [originSuggestions, setOriginSuggestions] = useState([])
  var [destSuggestions, setDestSuggestions] = useState([])
  var [showOriginSugg, setShowOriginSugg] = useState(false)
  var [showDestSugg, setShowDestSugg] = useState(false)
  var originTimer = useRef(null)
  var destTimer = useRef(null)
  var whatIfTimer = useRef(null)
  var [vehicle, setVehicle] = useState(null)

  useEffect(function () {
    getVehicleById(DEFAULT_VEHICLE_ID).then(function (v) { setVehicle(v) })
  }, [])

  async function geocode(query, type) {
    if (!query.trim()) {
      if (type === 'origin') { setOriginSuggestions([]); setShowOriginSugg(false) }
      else { setDestSuggestions([]); setShowDestSugg(false) }
      return
    }
    try {
      var res = await fetch('/api/geocode/?q=' + encodeURIComponent(query) + '&limit=5')
      if (!res.ok) return
      var data = await res.json()
      if (!Array.isArray(data)) return
      if (type === 'origin') { setOriginSuggestions(data); setShowOriginSugg(data.length > 0) }
      else { setDestSuggestions(data); setShowDestSugg(data.length > 0) }
    } catch (e) { console.error('Geocode error:', e) }
  }

  function handleOriginInput(v) {
    setOrigin(v); setOriginCoords(null)
    if (originTimer.current) clearTimeout(originTimer.current)
    originTimer.current = setTimeout(function () { geocode(v, 'origin') }, 600)
  }

  function handleDestInput(v) {
    setDestination(v); setDestCoords(null)
    if (destTimer.current) clearTimeout(destTimer.current)
    destTimer.current = setTimeout(function () { geocode(v, 'destination') }, 600)
  }

  function selectOrigin(s) {
    setOrigin(s.display_name)
    setOriginCoords({ lat: parseFloat(s.lat), lng: parseFloat(s.lon) })
    setShowOriginSugg(false)
  }

  function selectDest(s) {
    setDestination(s.display_name)
    setDestCoords({ lat: parseFloat(s.lat), lng: parseFloat(s.lon) })
    setShowDestSugg(false)
  }

  async function handlePlanRoute() {
    if (!originCoords || !destCoords) { setError('Please select valid origin and destination from suggestions.'); return }
    if (!vehicle) { setError('No vehicle selected.'); return }
    setIsLoading(true); setError(''); setSaved(false); setRoute(null)
    try {
      var url = OSRM_BASE + '/' + originCoords.lng + ',' + originCoords.lat + ';' + destCoords.lng + ',' + destCoords.lat + '?geometries=geojson&overview=full&steps=true'
      var res = await fetch(url)
      var data = await res.json()
      if (!data.routes || data.routes.length === 0) { setError('Could not find a route.'); setIsLoading(false); return }

      var osrmRoute = data.routes[0]
      var coordinates = osrmRoute.geometry.coordinates.map(function (c) { return [c[1], c[0]] })
      var distanceM = osrmRoute.distance
      var durationS = osrmRoute.duration

      var planResult = await planRoute({
        route_coords: coordinates,
        total_distance_m: distanceM,
        total_duration_s: durationS,
        vehicle_id: vehicle.id,
        battery_start_percent: batteryPercent,
        origin_name: origin,
        dest_name: destination,
      })

      var backendPlan = planResult.data

      setRoute({
        route: coordinates,
        distance: distanceM,
        duration: durationS,
        backendPlan: backendPlan,
        origin: originCoords,
        destination: destCoords,
        originName: origin,
        destName: destination,
        stops: backendPlan.stops || [],
      })
    } catch (e) { console.error(e); setError('Route planning failed. Please try again.') }
    setIsLoading(false)
  }

  function handleWhatIfChange(newValue) {
    setBatteryPercent(newValue)
    if (route) {
      if (whatIfTimer.current) clearTimeout(whatIfTimer.current)
      whatIfTimer.current = setTimeout(function () { recalcPlan(newValue) }, 400)
    }
  }

  async function recalcPlan(batteryValue) {
    if (!route || !route.route || !vehicle) return
    try {
      var planResult = await planRoute({
        route_coords: route.route,
        total_distance_m: route.distance,
        total_duration_s: route.duration,
        vehicle_id: vehicle.id,
        battery_start_percent: batteryValue,
        origin_name: route.originName,
        dest_name: route.destName,
      })
      var backendPlan = planResult.data
      setRoute(Object.assign({}, route, {
        backendPlan: backendPlan,
        stops: backendPlan.stops || [],
      }))
    } catch (e) { console.error('Replan error:', e) }
  }

  async function handleSaveTrip() {
    if (!route || !user) return
    setSaving(true)

    if (whatIfTimer.current) {
      clearTimeout(whatIfTimer.current)
      whatIfTimer.current = null
      await recalcPlan(batteryPercent)
    }

    try {
      var bp = route.backendPlan
      var totalCost = bp ? bp.total_cost : 0
      var endPercent = bp ? bp.final_soc_percent : batteryPercent
      var stopData = bp ? bp.stops.map(function (s) {
        return {
          stop_index: s.stop_index,
          station_id: s.station_id,
          station_name: s.station_name,
          lat: s.lat,
          lng: s.lng,
          arrival_soc_percent: s.arrival_soc_percent,
          departure_soc_percent: s.departure_soc_percent,
          charge_kwh: s.charge_kwh,
          charge_time_seconds: s.charge_time_seconds,
          cost: s.cost,
          detour_km: s.detour_km,
        }
      }) : []

      await createTrip({
        origin: route.originName,
        destination: route.destName,
        origin_lat: route.origin.lat,
        origin_lng: route.origin.lng,
        dest_lat: route.destination.lat,
        dest_lng: route.destination.lng,
        distance_km: route.distance / 1000,
        duration_minutes: route.duration / 60,
        battery_start_percent: batteryPercent,
        battery_end_percent: endPercent,
        total_cost: totalCost,
        route_geometry: route.route,
        stops: stopData,
      })
      setSaved(true)
    } catch (e) { console.error('Save trip error:', e); setError('Failed to save trip.') }
    setSaving(false)
  }

  var bp = route ? route.backendPlan : null
  var stopCount = bp ? bp.stops.length : 0
  var arrivalPercent = bp ? bp.final_soc_percent : 0
  var batteryColorClass = arrivalPercent > 20 ? 'text-emerald-500' : 'text-red-500'

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center">
            <FiNavigation className="w-5 h-5 text-emerald-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Trip Planner</h2>
        </div>

        <div className="space-y-3.5">
          <div className="relative">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Origin</label>
            <div className="relative">
              <FiMapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={origin} onChange={function (e) { handleOriginInput(e.target.value) }} placeholder="e.g. Kochi, Kerala"
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500 transition-all" />
              {originCoords && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
            </div>
            {showOriginSugg && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-10 max-h-40 overflow-y-auto">
                {originSuggestions.map(function (s, i) {
                  return <button key={i} onClick={function () { selectOrigin(s) }} className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0 truncate">{s.display_name}</button>
                })}
              </div>
            )}
          </div>

          <div className="relative">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Destination</label>
            <div className="relative">
              <FiNavigation className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={destination} onChange={function (e) { handleDestInput(e.target.value) }} placeholder="e.g. Munnar, Kerala"
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500 transition-all" />
              {destCoords && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
            </div>
            {showDestSugg && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-10 max-h-40 overflow-y-auto">
                {destSuggestions.map(function (s, i) {
                  return <button key={i} onClick={function () { selectDest(s) }} className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0 truncate">{s.display_name}</button>
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Starting Battery: <span className="font-bold text-emerald-500">{batteryPercent}%</span></label>
            <input type="range" min="10" max="100" step="5" value={batteryPercent} onChange={function (e) { handleWhatIfChange(Number(e.target.value)) }} className="w-full accent-emerald-500" />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5"><span>10%</span><span>100%</span></div>
          </div>

          <button onClick={handlePlanRoute} disabled={isLoading || !originCoords || !destCoords}
            className={'w-full py-2.5 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 ' + (isLoading || !originCoords || !destCoords ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-emerald-700')}>
            {isLoading ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> Planning...</> : <><FiSearch className="w-4 h-4" /> Plan Trip</>}
          </button>

          {error && <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl">{error}</div>}
        </div>

        {route && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-800 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Route Summary</h3>
            <div className="space-y-2 bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Distance</span>
                <span className="font-semibold text-gray-900 dark:text-white">{(route.distance / 1000).toFixed(1)} km</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Est. driving time</span>
                <span className="font-semibold text-gray-900 dark:text-white">{formatDuration(route.duration)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Arrival Battery</span>
                <span className={'font-semibold ' + batteryColorClass}>{arrivalPercent}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Charging stops</span>
                <span className="font-semibold text-amber-500">{stopCount}</span>
              </div>
              {bp && bp.total_cost > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Est. cost</span>
                  <span className="font-semibold text-emerald-500">₹{bp.total_cost}</span>
                </div>
              )}
              {bp && bp.total_charge_time_seconds > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Total charge time</span>
                  <span className="font-semibold text-amber-500">{formatDuration(bp.total_charge_time_seconds)}</span>
                </div>
              )}
            </div>

            {stopCount > 0 && bp.stops.map(function (stop, i) {
              return (
                <div key={i} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{stop.station_name || 'Stop ' + (i + 1)}</span>
                    <span className="text-xs text-gray-500">{stop.distance_from_start_km} km</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><FiBatteryCharging className="w-3 h-3" />Arrive {stop.arrival_soc_percent}%</span>
                    <span className="flex items-center gap-1"><FiZap className="w-3 h-3" />{stop.charge_kwh} kWh</span>
                    <span className="flex items-center gap-1"><FiClock className="w-3 h-3" />{formatDuration(stop.charge_time_seconds)}</span>
                    <span className="flex items-center gap-1"><FiDollarSign className="w-3 h-3" />₹{stop.cost}</span>
                  </div>
                </div>
              )
            })}

            {stopCount === 0 && (
              <div className="text-center py-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                <FiBatteryCharging className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                <p className="text-xs text-emerald-600 dark:text-emerald-400">No charging stops needed!</p>
              </div>
            )}

            {user && (
              <button onClick={handleSaveTrip} disabled={saving || saved}
                className={'w-full py-2 text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-1.5 ' + (saved ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400')}>
                {saving ? 'Saving...' : saved ? <><FiSave className="w-3 h-3" /> Trip Saved</> : <><FiSave className="w-3 h-3" /> Save Trip</>}
              </button>
            )}
          </div>
        )}
    </div>
  )
}
