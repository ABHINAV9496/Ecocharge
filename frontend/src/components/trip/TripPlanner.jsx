import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiSearch, FiMapPin, FiBatteryCharging, FiNavigation, FiDollarSign, FiClock, FiSave, FiZap, FiMap, FiBattery } from 'react-icons/fi'
import { createTrip } from '../../api/trips'
import { planRoute, planRouteStream } from '../../api/routePlanner'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useVehicle } from '../../context/VehicleContext'
import { searchLocations } from '../../api/geocode'
import { formatCurrency, formatDuration, chargerLabel } from '../../utils/formatters'
import VehicleSelector from '../map/VehicleSelector'
import TripTimeline from './TripTimeline'
import RouteWeatherTimeline from '../weather/RouteWeatherTimeline'

var OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'

export default function TripPlanner() {
  var { user } = useAuth()
  var showToast = useToast()
  var { vehicle, setVehicle, vehicles } = useVehicle()
  var navigate = useNavigate()
  var [origin, setOrigin] = useState('')
  var [destination, setDestination] = useState('')
  var [originCoords, setOriginCoords] = useState(null)
  var [destCoords, setDestCoords] = useState(null)
  var [batteryPercent, setBatteryPercent] = useState(80)
  var [route, setRoute] = useState(null)
  var [isLoading, setIsLoading] = useState(false)
  var [progressMessage, setProgressMessage] = useState('')
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
  var [chargerType, setChargerType] = useState('all')
  var [comparison, setComparison] = useState(null)
  var [comparing, setComparing] = useState(false)

  async function geocode(query, type) {
    if (!query.trim()) {
      if (type === 'origin') { setOriginSuggestions([]); setShowOriginSugg(false) }
      else { setDestSuggestions([]); setShowDestSugg(false) }
      return
    }
    var t0 = performance.now()
    try {
      var data = await searchLocations(query, 5)
      var elapsed = ((performance.now() - t0) / 1000).toFixed(3)
      console.log('[TIMING] ' + type + '_geocoding: ' + elapsed + 's')
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
    setIsLoading(true); setProgressMessage('Requesting route...'); setError(''); setSaved(false); setRoute(null)
    var timings = {}
    try {
      var t0 = performance.now()
      var url = OSRM_BASE + '/' + originCoords.lng + ',' + originCoords.lat + ';' + destCoords.lng + ',' + destCoords.lat + '?geometries=geojson&overview=full&steps=true'
      var res = await fetch(url)
      var data = await res.json()
      timings['4_route_api_osrm'] = ((performance.now() - t0) / 1000).toFixed(1) + 's'
      if (!data.routes || data.routes.length === 0) { setError('Could not find a route.'); setIsLoading(false); return }

      var t1 = performance.now()
      var osrmRoute = data.routes[0]
      var coordinates = osrmRoute.geometry.coordinates.map(function (c) { return [c[1], c[0]] })

      // Downsample dense route coords for faster planner performance
      var MAX_PLANNER_POINTS = 1000
      if (coordinates.length > MAX_PLANNER_POINTS) {
        var step = coordinates.length / MAX_PLANNER_POINTS
        coordinates = coordinates.filter(function (_, i) { return i === 0 || i === coordinates.length - 1 || Math.floor(i % step) === 0 })
      }
      timings['5_polyline_decoding'] = ((performance.now() - t1) / 1000).toFixed(1) + 's'

      var distanceM = osrmRoute.distance
      var durationS = osrmRoute.duration

      var t2 = performance.now()
      // Use streaming endpoint with progress
      await planRouteStream({
        route_coords: coordinates,
        total_distance_m: distanceM,
        total_duration_s: durationS,
        vehicle_id: vehicle.id,
        battery_start_percent: batteryPercent,
        origin_name: origin,
        dest_name: destination,
        charger_type: chargerType,
      },
      function onProgress(msg) { setProgressMessage(msg) },
      function onResult(backendPlan) {
        timings['backend_total'] = ((performance.now() - t2) / 1000).toFixed(1) + 's'
        console.log('========== TRIP PLAN CLIENT TIMINGS ==========')
        for (var tk in timings) { console.log('  ' + tk + ': ' + timings[tk]) }
        console.log('=============================================')
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
        if (backendPlan.note && (backendPlan.note.includes('No ') || backendPlan.note.includes('No reachable'))) {
          showToast(backendPlan.note, 'error')
        }
        setIsLoading(false)
        setProgressMessage('')
      },
      function onError(errMsg) { showToast(errMsg || 'Route planning failed.', 'error'); setError(errMsg || 'Route planning failed.'); setIsLoading(false); setProgressMessage('') })
    } catch (e) { console.error(e); setError('Route planning failed. Please try again.'); setIsLoading(false); setProgressMessage('') }
  }

  async function handleQuickCompare() {
    if (!originCoords || !destCoords || !vehicle) return
    setComparing(true); setError('')
    var types = ['all', 'dc', 'ac']
    var results = {}
    try {
      var t0 = performance.now()
      var url = OSRM_BASE + '/' + originCoords.lng + ',' + originCoords.lat + ';' + destCoords.lng + ',' + destCoords.lat + '?geometries=geojson&overview=full&steps=true'
      var res = await fetch(url)
      var data = await res.json()
      if (!data.routes || data.routes.length === 0) { setError('Could not find a route.'); setComparing(false); return }
      var osrmRoute = data.routes[0]
      var coordinates = osrmRoute.geometry.coordinates.map(function (c) { return [c[1], c[0]] })
      var MAX_PLANNER_POINTS = 1000
      if (coordinates.length > MAX_PLANNER_POINTS) {
        var step = coordinates.length / MAX_PLANNER_POINTS
        coordinates = coordinates.filter(function (_, i) { return i === 0 || i === coordinates.length - 1 || Math.floor(i % step) === 0 })
      }
      var distanceM = osrmRoute.distance
      var durationS = osrmRoute.duration

      await Promise.all(types.map(async function (t) {
        try {
          var resp = await planRoute({
            route_coords: coordinates,
            total_distance_m: distanceM,
            total_duration_s: durationS,
            vehicle_id: vehicle.id,
            battery_start_percent: batteryPercent,
            origin_name: origin,
            dest_name: destination,
            charger_type: t,
          })
          var bp = resp.data
          var totalTime = (bp.total_drive_time_seconds || 0) + (bp.total_charge_time_seconds || 0)
          results[t] = {
            stops: bp.stops ? bp.stops.length : 0,
            chargeTime: bp.total_charge_time_seconds || 0,
            totalTime: totalTime,
            cost: bp.total_cost || 0,
            note: bp.note || '',
          }
        } catch (e) {
          results[t] = { stops: '-', chargeTime: 0, totalTime: 0, cost: 0, note: 'Error' }
        }
      }))
      setComparison(results)
    } catch (e) { console.error(e); setError('Quick compare failed.') }
    setComparing(false)
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
        charger_type: chargerType,
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
  var energyKwh = bp ? bp.total_energy_consumed_kwh : 0
  var chargingTime = bp ? bp.total_charge_time_seconds : 0
  var totalCost = bp ? bp.total_cost : 0

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

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Charger Type</label>
            <div className="flex gap-2">
              {[
                { value: 'all', label: 'Mixed' },
                { value: 'dc', label: 'DC Only' },
                { value: 'ac', label: 'AC Only' },
              ].map(function (opt) {
                return (
                  <button key={opt.value} type="button"
                    onClick={function () { setChargerType(opt.value); setComparison(null) }}
                    className={'flex-1 py-2 text-xs font-medium rounded-xl transition-all ' +
                      (chargerType === opt.value
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600')}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">
              {chargerType === 'all' ? 'All charger types considered (DC + AC)' :
               chargerType === 'dc' ? 'Only DC Fast and DC Ultra chargers' :
               'Only AC Fast and AC Slow chargers'}
            </p>
          </div>

          <div className="flex gap-2">
            <button onClick={handlePlanRoute} disabled={isLoading || !originCoords || !destCoords}
              className={'flex-1 py-2.5 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 ' + (isLoading || !originCoords || !destCoords ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-emerald-700')}>
              {isLoading ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> Planning...</> : <><FiSearch className="w-4 h-4" /> Plan Trip</>}
            </button>
            <button onClick={handleQuickCompare} disabled={comparing || !originCoords || !destCoords}
              className={'py-2.5 px-3 text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-1.5 border ' + (comparing || !originCoords || !destCoords ? 'border-gray-200 dark:border-gray-700 text-gray-400 cursor-not-allowed bg-gray-50 dark:bg-gray-800' : 'border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 bg-white dark:bg-gray-800')}>
              {comparing ? <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-emerald-500 border-t-transparent" /> : <FiZap className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Quick Compare</span>
            </button>
          </div>
          {isLoading && progressMessage && <div className="text-xs text-emerald-600 dark:text-emerald-400 text-center animate-pulse">{progressMessage}</div>}

          {error && <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl">{error}</div>}

          {comparison && (
            <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-gray-900 dark:text-white">Quick Compare</h4>
                <button onClick={function () { setComparison(null) }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {['all', 'dc', 'ac'].map(function (t) {
                  var d = comparison[t]
                  var labels = { all: 'Mixed', dc: 'DC Only', ac: 'AC Only' }
                  var isSelected = chargerType === t
                  var stopLabel = d.stops !== '-' ? d.stops + ' stop' + (d.stops !== 1 ? 's' : '') : '\u2014'
                  return (
                    <button key={t} type="button"
                      onClick={function () { setChargerType(t); setComparison(null) }}
                      className={'p-2 rounded-lg text-center text-[11px] transition-all ' +
                        (isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-400/50'
                          : 'bg-gray-50 dark:bg-gray-700/50 border border-transparent hover:border-gray-300 dark:hover:border-gray-600')}
                    >
                      <div className="font-semibold text-gray-900 dark:text-white mb-1">{labels[t]}</div>
                      <div className="text-gray-500 dark:text-gray-400">{stopLabel}</div>
                      <div className="text-gray-500 dark:text-gray-400">{d.stops !== '-' ? formatDuration(d.chargeTime) + ' charge' : '\u2014'}</div>
                      <div className="text-gray-500 dark:text-gray-400">{d.stops !== '-' ? '\u20B9' + Math.round(d.cost).toLocaleString('en-IN') : '\u2014'}</div>
                      <div className={'mt-1 text-[10px] ' + (d.note && d.note.includes('No ') ? 'text-amber-500' : 'text-emerald-400')}>
                        {d.note && d.note.includes('No ') ? '\u26A0\uFE0F No stations' : d.note === 'Error' ? '\u2716 Error' : ''}
                      </div>
                    </button>
                  )
                })}
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5 text-center">Tap a type to select, then click Plan Trip</p>
            </div>
          )}
        </div>

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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="col-span-2 md:col-span-4 flex items-center gap-2 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-800/80 rounded-xl p-2.5 border border-gray-100 dark:border-gray-700">
                <FiClock className="w-4 h-4 text-gray-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">Total Trip Time</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">{formatDuration(bp ? bp.total_trip_time_seconds : 0)}</div>
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
              {energyKwh > 0 && <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5">
                <FiZap className="w-4 h-4 text-violet-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">Energy</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{energyKwh.toFixed(1)} kWh</div>
                </div>
              </div>}
            </div>

            <TripTimeline
              originName={route.originName}
              destName={route.destName}
              batteryPercent={batteryPercent}
              stops={bp ? bp.stops : []}
              legs={bp ? bp.legs : []}
              finalSoc={arrivalPercent}
            />

            {bp && (bp.origin_weather || bp.destination_weather || (bp.stops && bp.stops.some(function (s) { return s.weather }))) && (
              <RouteWeatherTimeline routeWeather={[
                bp.origin_weather ? { icon: bp.origin_weather.icon, temperature: bp.origin_weather.temperature, precipitation_probability: bp.origin_weather.precipitation_probability } : null,
                ...(bp.stops || []).filter(function (s) { return s.weather }).map(function (s) { return { icon: s.weather.icon, temperature: s.weather.temperature, precipitation_probability: s.weather.precipitation_probability } }),
                bp.destination_weather ? { icon: bp.destination_weather.icon, temperature: bp.destination_weather.temperature, precipitation_probability: bp.destination_weather.precipitation_probability } : null,
              ].filter(Boolean)} />
            )}

            <details className="text-xs text-gray-500 dark:text-gray-400 group">
              <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 font-medium py-1 select-none">
                Try different charger type
              </summary>
              <div className="flex gap-2 mt-1.5">
                {['all', 'dc', 'ac'].map(function (t) {
                  if (t === chargerType) return null
                  var labels = { all: 'Mixed', dc: 'DC Only', ac: 'AC Only' }
                  return (
                    <button key={t} type="button"
                      onClick={function () { setChargerType(t); recalcPlan(batteryPercent) }}
                      className="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all text-[11px] font-medium"
                    >
                      {labels[t]}
                    </button>
                  )
                })}
              </div>
            </details>

            {stopCount > 0 && bp.stops.map(function (stop, i) {
              var prevDist = i > 0 ? bp.stops[i - 1].distance_from_start_km : 0
              var legDist = stop.distance_from_start_km - prevDist
              var chargerLabelText = chargerLabel(stop.slot_type)
              var chargerColor = stop.slot_type && stop.slot_type.startsWith('DC') ? 'text-purple-600 dark:text-purple-400' : 'text-amber-600 dark:text-amber-400'
              var chargerBg = stop.slot_type && stop.slot_type.startsWith('DC') ? 'bg-purple-100 dark:bg-purple-900/20' : 'bg-amber-100 dark:bg-amber-900/20'
              return (
                <div key={i} className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-500">{i + 1}</div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{stop.station_name || 'Stop ' + (i + 1)}</span>
                    </div>
                    <span className={'text-[10px] font-medium px-1.5 py-0.5 rounded ' + chargerBg + ' ' + chargerColor}>{chargerLabelText}</span>
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
