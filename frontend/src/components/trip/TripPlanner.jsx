import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiSearch, FiMapPin, FiBatteryCharging, FiNavigation, FiDollarSign, FiClock, FiSave, FiZap, FiMap, FiBattery } from 'react-icons/fi'
import { createTrip } from '../../api/trips'
import { planRoute } from '../../api/routePlanner'
import { useAuth } from '../../context/AuthContext'
import { useVehicle } from '../../context/VehicleContext'
import { searchLocations } from '../../api/geocode'
import { formatCurrency } from '../../utils/formatters'
import VehicleSelector from '../map/VehicleSelector'
import TripTimeline from './TripTimeline'

var OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0m'
  var h = Math.floor(seconds / 3600)
  var m = Math.round((seconds % 3600) / 60)
  return h > 0 ? h + 'h ' + m + 'm' : m + 'm'
}

export default function TripPlanner() {
  var { user } = useAuth()
  var { vehicle, setVehicle, vehicles } = useVehicle()
  var navigate = useNavigate()
  var [origin, setOrigin] = useState('')
  var [destination, setDestination] = useState('')
  var [originCoords, setOriginCoords] = useState(null)
  var [destCoords, setDestCoords] = useState(null)
  var [batteryPercent, setBatteryPercent] = useState(80)
  var [route, setRoute] = useState(null)
  var [selectedAlt, setSelectedAlt] = useState(0)
  var [alternatives, setAlternatives] = useState([])
  var [isLoading, setIsLoading] = useState(false)
  var [error, setError] = useState('')
  var [saving, setSaving] = useState(false)
  var [saved, setSaved] = useState(false)
  var [confirming, setConfirming] = useState(false)
  var [originSuggestions, setOriginSuggestions] = useState([])
  var [destSuggestions, setDestSuggestions] = useState([])
  var [showOriginSugg, setShowOriginSugg] = useState(false)
  var [showDestSugg, setShowDestSugg] = useState(false)
  var originTimer = useRef(null)
  var destTimer = useRef(null)
  var whatIfTimer = useRef(null)

  async function geocode(query, type) {
    if (!query.trim()) {
      if (type === 'origin') { setOriginSuggestions([]); setShowOriginSugg(false) }
      else { setDestSuggestions([]); setShowDestSugg(false) }
      return
    }
    try {
      var data = await searchLocations(query, 5)
      if (type === 'origin') { setOriginSuggestions(data); setShowOriginSugg(data.length > 0) }
      else { setDestSuggestions(data); setShowDestSugg(data.length > 0) }
    } catch (e) { console.error('Geocode error:', e) }
  }

  function handleOriginInput(v) {
    setOrigin(v); setOriginCoords(null)
    if (originTimer.current) clearTimeout(originTimer.current)
    originTimer.current = setTimeout(function () { geocode(v, 'origin') }, 400)
  }

  function handleDestInput(v) {
    setDestination(v); setDestCoords(null)
    if (destTimer.current) clearTimeout(destTimer.current)
    destTimer.current = setTimeout(function () { geocode(v, 'destination') }, 400)
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

      // Downsample dense route coords for faster planner performance
      var MAX_PLANNER_POINTS = 1000
      if (coordinates.length > MAX_PLANNER_POINTS) {
        var step = coordinates.length / MAX_PLANNER_POINTS
        coordinates = coordinates.filter(function (_, i) { return i === 0 || i === coordinates.length - 1 || Math.floor(i % step) === 0 })
      }

      var distanceM = osrmRoute.distance
      var durationS = osrmRoute.duration
      console.log('OSRM raw: distance_m=' + distanceM + ' duration_s=' + durationS + ' km=' + (distanceM / 1000).toFixed(1))

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

      setAlternatives(backendPlan.alternatives || [])
      setSelectedAlt(0)
      setRoute({
        route: coordinates,
        distance: distanceM,
        duration: durationS,
        backendPlan: backendPlan,
        originalPlan: Object.assign({}, backendPlan),
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
      setAlternatives(backendPlan.alternatives || [])
      setSelectedAlt(0)
      setRoute(Object.assign({}, route, {
        backendPlan: backendPlan,
        originalPlan: Object.assign({}, backendPlan),
        stops: backendPlan.stops || [],
      }))
    } catch (e) { console.error('Replan error:', e) }
  }

  function handleSelectAlt(index) {
    setSelectedAlt(index)
    if (index === 0) {
      if (route && route.originalPlan) {
        setRoute(Object.assign({}, route, {
          backendPlan: route.originalPlan,
          stops: route.originalPlan.stops || [],
        }))
      }
      return
    }
    if (!route) return
    var alt = alternatives[index - 1]
    if (!alt) return
    setRoute(Object.assign({}, route, {
      backendPlan: Object.assign({}, route.backendPlan, {
        total_drive_time_seconds: alt.total_drive_time_seconds,
        total_charge_time_seconds: alt.total_charge_time_seconds,
        total_cost: alt.total_cost,
        total_energy_consumed_kwh: alt.total_energy_consumed_kwh,
        final_soc_percent: alt.final_soc_percent,
        stops: alt.stops || [],
        legs: alt.legs || [],
      }),
      stops: alt.stops || [],
    }))
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

      var routeGeo = (bp && bp.waypoint_geometry && bp.waypoint_geometry.length > 0)
        ? bp.waypoint_geometry : route.route

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
        route_geometry: routeGeo,
        stops: stopData,
      })
      setSaved(true)
    } catch (e) { console.error('Save trip error:', e); setError('Failed to save trip.') }
    setSaving(false)
  }

  async function handleConfirmTrip() {
    if (!route || !user) return
    setConfirming(true)

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

      var routeGeo = (bp && bp.waypoint_geometry && bp.waypoint_geometry.length > 0)
        ? bp.waypoint_geometry : route.route

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
        route_geometry: routeGeo,
        stops: stopData,
      })
      var enhancedRoute = Object.assign({}, route, {
        waypointGeometry: (bp && bp.waypoint_geometry && bp.waypoint_geometry.length > 10)
          ? bp.waypoint_geometry : null
      })
      navigate('/map', { state: { routePlan: enhancedRoute } })
    } catch (e) { console.error('Save trip error:', e); setError('Failed to save trip.') }
    setConfirming(false)
  }

  var bp = route ? route.backendPlan : null
  var stopCount = bp ? bp.stops.length : 0
  var arrivalPercent = bp ? bp.final_soc_percent : 0
  var batteryColorClass = arrivalPercent > 20 ? 'text-emerald-500' : 'text-red-500'

  // === Calculation Validation ===
  var validationWarnings = []
  if (bp && stopCount > 0) {
    if (!bp.total_charge_time_seconds || bp.total_charge_time_seconds <= 0) {
      validationWarnings.push('Charging time is zero despite having ' + stopCount + ' stop(s)')
    }
    if (!bp.total_cost || bp.total_cost <= 0) {
      validationWarnings.push('Charging cost is zero for a multi-stop trip')
    }
  }
  if (bp && bp.total_charge_time_seconds > 0 && stopCount === 0) {
    validationWarnings.push('Charging time is positive but no charging stops defined')
  }
  if (alternatives && alternatives.length >= 1) {
    var fData = selectedAlt === 0 ? bp : (route ? route.originalPlan : null)
    var cData = alternatives[0]
    if (fData && cData) {
      var fTotal = (fData.total_drive_time_seconds || 0) + (fData.total_charge_time_seconds || 0)
      var cTotal = (cData.total_drive_time_seconds || 0) + (cData.total_charge_time_seconds || 0)
      if (cTotal > 0 && fTotal > cTotal + 1800) {
        validationWarnings.push('Fastest is slower than Cheapest — unexpected ordering')
      }
    }
  }

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

          {/* Vehicle selector */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Vehicle</label>
            <VehicleSelector vehicle={vehicle} onSelect={setVehicle} vehicles={vehicles} />
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
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Route Options</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              { (function () {
                var cards = []
                var fastestPlan = selectedAlt === 0 ? bp : (route ? route.originalPlan : null)
                var cheapestPlan = alternatives[0]
                var fastestCost = fastestPlan ? fastestPlan.total_cost : 0

                var planDefs = [
                  { idx: 0, label: '\u26A1 Fastest', color: 'emerald', desc: 'Premium DC chargers for minimum travel time', data: fastestPlan },
                  { idx: 1, label: '\uD83D\uDCB0 Cheapest', color: 'amber', desc: 'Lowest-cost chargers to minimize expenses', data: cheapestPlan },
                ]

                for (var ci = 0; ci < planDefs.length; ci++) {
                  let pd = planDefs[ci]
                  var d = pd.data || {}
                  var totalTime = (d.total_drive_time_seconds || 0) + (d.total_charge_time_seconds || 0)
                  if (pd.idx === 0 && !totalTime) { totalTime = route.duration + (bp ? bp.total_charge_time_seconds : 0) }
                  var isSelected = selectedAlt === pd.idx
                  var stopCt = d.stops ? d.stops.length : 0
                  if (pd.idx === 0 && bp) stopCt = bp.stops.length
                  var cost = pd.idx === 0 ? (bp ? bp.total_cost : 0) : (d.total_cost || 0)
                  var savings = Math.max(0, (fastestCost || 0) - cost)
                  var savingsFormatted = savings > 0.5 ? '\u20B9' + Math.round(savings).toLocaleString('en-IN') : null

                  cards.push(
                    <button key={ci} onClick={function () { handleSelectAlt(pd.idx) }}
                      className={'relative flex-1 p-3 rounded-xl transition-all duration-300 text-left ' + (isSelected
                        ? 'bg-white dark:bg-gray-800 border-2 border-' + pd.color + '-400 dark:border-' + pd.color + '-500 shadow-lg shadow-' + pd.color + '-200/50 dark:shadow-' + pd.color + '-900/20 scale-[1.02] z-10'
                        : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-' + pd.color + '-300 shadow-sm hover:shadow-md')}>
                      {isSelected && <div className="absolute -top-2 -right-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30"><svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
                      <div className={'text-base font-bold tracking-tight ' + (isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-800 dark:text-gray-200')}>{formatDuration(totalTime)}</div>
                      <div className={'text-[11px] font-semibold mt-0.5 ' + (isSelected ? 'text-' + pd.color + '-600 dark:text-' + pd.color + '-400' : 'text-gray-500 dark:text-gray-400')}>{pd.label}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {pd.idx === 0 && <span className="inline-flex items-center text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">Fastest option</span>}
                        {pd.idx > 0 && savingsFormatted && <span className={'inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded ' + (isSelected ? 'bg-' + pd.color + '-50 dark:bg-' + pd.color + '-900/20 text-' + pd.color + '-600 dark:text-' + pd.color + '-400' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400')}>Save {savingsFormatted}</span>}
                      </div>
                      <div className="mt-1.5 space-y-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                        <div className="flex items-center gap-1"><FiZap className="w-3 h-3" />{formatDuration(d.total_charge_time_seconds || 0)} charging</div>
                        <div className="flex items-center gap-1"><FiBatteryCharging className="w-3 h-3" />{stopCt} stop{stopCt !== 1 ? 's' : ''} &middot; {d.final_soc_percent || arrivalPercent}% arrival</div>
                        <div className="flex items-center gap-1"><FiDollarSign className="w-3 h-3" />{'\u20B9' + Math.round(cost).toLocaleString('en-IN')}</div>
                      </div>
                      <div className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500 italic leading-tight">{pd.desc}</div>
                    </button>
                  )
                }
                return cards
              })()}
            </div>
          </div>
        )}

        {route && validationWarnings.length > 0 && (
          <div className="space-y-1">
            {validationWarnings.map(function (w, i) {
              return <div key={i} className="p-2.5 text-xs bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 rounded-xl flex items-start gap-2">
                <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                <span>{w}</span>
              </div>
            })}
          </div>
        )}

        {route && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Route Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div className="col-span-2 md:col-span-3 flex items-center gap-2 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-800/80 rounded-xl p-2.5 border border-gray-100 dark:border-gray-700">
                <FiClock className="w-4 h-4 text-gray-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">Total Trip Time</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">{formatDuration((bp ? bp.total_drive_time_seconds : 0) + (bp ? bp.total_charge_time_seconds : 0))}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5">
                <FiMapPin className="w-4 h-4 text-blue-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">Distance</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{(route.distance / 1000).toFixed(1)} km</div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5">
                <FiNavigation className="w-4 h-4 text-violet-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">Drive Time</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{formatDuration(bp ? bp.total_drive_time_seconds : route.duration)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5">
                <FiZap className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">Charge Time</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{formatDuration(bp ? bp.total_charge_time_seconds : 0)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5">
                <FiBatteryCharging className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">Charging Stops</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{stopCount}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5">
                <FiDollarSign className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">Charging Cost</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{'\u20B9' + Math.round(bp ? bp.total_cost : 0).toLocaleString('en-IN')}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5">
                <FiBattery className="w-4 h-4 text-blue-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">Arrival Battery</div>
                  <div className={'text-sm font-semibold ' + batteryColorClass}>{arrivalPercent}%</div>
                </div>
              </div>
            </div>

            <TripTimeline
              originName={route.originName}
              destName={route.destName}
              batteryPercent={batteryPercent}
              stops={bp ? bp.stops : []}
              legs={bp ? bp.legs : []}
              finalSoc={arrivalPercent}
            />

            {stopCount > 0 && bp.stops.map(function (stop, i) {
              var prevDist = i > 0 ? bp.stops[i - 1].distance_from_start_km : 0
              var legDist = stop.distance_from_start_km - prevDist
              var chargerLabel = stop.slot_type === 'DC_FAST' ? 'DC Fast' : stop.slot_type === 'DC_ULTRA' ? 'DC Ultra' : stop.slot_type === 'AC_FAST' ? 'AC Fast' : stop.slot_type || 'Charger'
              var chargerColor = stop.slot_type && stop.slot_type.startsWith('DC') ? 'text-purple-600 dark:text-purple-400' : 'text-amber-600 dark:text-amber-400'
              var chargerBg = stop.slot_type && stop.slot_type.startsWith('DC') ? 'bg-purple-100 dark:bg-purple-900/20' : 'bg-amber-100 dark:bg-amber-900/20'
              return (
                <div key={i} className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-500">{i + 1}</div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{stop.station_name || 'Stop ' + (i + 1)}</span>
                    </div>
                    <span className={'text-[10px] font-medium px-1.5 py-0.5 rounded ' + chargerBg + ' ' + chargerColor}>{chargerLabel}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-gray-500">
                    <span className="flex items-center gap-1"><FiNavigation className="w-3 h-3 text-gray-400" />{legDist.toFixed(1)} km</span>
                    <span className="flex items-center gap-1"><FiZap className="w-3 h-3 text-gray-400" />{stop.charger_power_kw || '?'} kW</span>
                    <span className="flex items-center gap-1"><FiBatteryCharging className="w-3 h-3 text-gray-400" />{stop.arrival_soc_percent}% → {stop.departure_soc_percent}%</span>
                    <span className="flex items-center gap-1"><FiClock className="w-3 h-3 text-gray-400" />{formatDuration(stop.charge_time_seconds)}</span>
                    <span className="flex items-center gap-1"><FiDollarSign className="w-3 h-3 text-gray-400" />{'\u20B9' + Math.round(stop.cost).toLocaleString('en-IN')}</span>
                    {stop.distance_from_start_km != null && <span className="flex items-center gap-1"><FiMapPin className="w-3 h-3 text-gray-400" />{stop.distance_from_start_km.toFixed(0)} km total</span>}
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
              <div className="flex gap-2">
                <button onClick={handleSaveTrip} disabled={saving || saved}
                  className={'flex-1 py-2 text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-1.5 ' + (saved ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400')}>
                  {saving ? 'Saving...' : saved ? <><FiSave className="w-3 h-3" /> Saved</> : <><FiSave className="w-3 h-3" /> Save Trip</>}
                </button>
                <button onClick={handleConfirmTrip} disabled={confirming}
                  className="flex-1 py-2 text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50">
                  {confirming ? 'Confirming...' : <><FiMap className="w-3 h-3" /> Confirm & Show on Map</>}
                </button>
              </div>
            )}
          </div>
        )}
    </div>
  )
}
