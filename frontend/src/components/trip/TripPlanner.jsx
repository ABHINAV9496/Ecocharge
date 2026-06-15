import { useState, useRef } from 'react'
import { FiSearch, FiMapPin, FiBatteryCharging, FiNavigation, FiDollarSign, FiClock, FiSave } from 'react-icons/fi'
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet'
import L from 'leaflet'
import { getStations } from '../../api/stations'
import { createTrip } from '../../api/trips'
import { formatCurrency } from '../../utils/formatters'
import { useAuth } from '../../context/AuthContext'
import { getVehicleById, DEFAULT_VEHICLE_ID } from '../../data/vehicleProfiles'
import 'leaflet/dist/leaflet.css'

delete L.Icon.Default.prototype._getIconUrl

var startIcon = L.divIcon({
  html: '<div style="width:24px;height:24px;background:#22c55e;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
  className: '', iconSize: [24, 24], iconAnchor: [12, 12],
})

var endIcon = L.divIcon({
  html: '<div style="width:24px;height:24px;background:#ef4444;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
  className: '', iconSize: [24, 24], iconAnchor: [12, 12],
})

var stopIcon = L.divIcon({
  html: '<div style="width:20px;height:20px;background:#f59e0b;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
  className: '', iconSize: [20, 20], iconAnchor: [10, 10],
})

var OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'

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
  var vehicle = getVehicleById(DEFAULT_VEHICLE_ID)

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

      var stationsRes = await getStations({ include_ocm: 'true' })
      var allStations = stationsRes.data || []

      var stops = findChargingStops(coordinates, distanceM, vehicle, batteryPercent, allStations)

      setRoute({
        route: coordinates,
        distance: distanceM,
        duration: durationS,
        stops: stops,
        origin: originCoords,
        destination: destCoords,
        originName: origin,
        destName: destination,
      })
    } catch (e) { console.error(e); setError('Route planning failed. Please try again.') }
    setIsLoading(false)
  }

  function handleWhatIfChange(newValue) {
    setBatteryPercent(newValue)
    if (route) {
      setTimeout(function () { recalcStops(newValue) }, 400)
    }
  }

  function recalcStops(batteryValue) {
    if (!route || !route.route) return
    var stationsResPromise = getStations({ include_ocm: 'true' })
    stationsResPromise.then(function (res) {
      var allStations = res.data || []
      var newStops = findChargingStops(route.route, route.distance, vehicle, batteryValue, allStations)
      setRoute(Object.assign({}, route, { stops: newStops }))
    }).catch(function () {})
  }

  async function handleSaveTrip() {
    if (!route || !user) return
    setSaving(true)
    try {
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
        battery_end_percent: route.stops.length > 0 ? 20 : Math.round(100 - (route.distance / 1000) * vehicle.consumption_wh_per_km / (vehicle.battery_kwh * 10)),
        total_cost: route.stops.reduce(function (sum, s) { return sum + (s.cost || 0) }, 0),
        route_geometry: route.route,
        stops: route.stops,
      })
      setSaved(true)
    } catch (e) { console.error('Save trip error:', e); setError('Failed to save trip.') }
    setSaving(false)
  }

  var arrivalPercent = route ? Math.round(100 - ((route.distance / 1000) * vehicle.consumption_wh_per_km / (vehicle.battery_kwh * 10))) : 0
  var batteryColor = arrivalPercent > 20 ? 'text-emerald-500' : 'text-red-500'

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <div className="w-full md:w-96 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 overflow-y-auto p-5 space-y-5">
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
            <input type="range" min="10" max="100" step="5" value={batteryPercent} onChange={function (e) { setBatteryPercent(Number(e.target.value)) }} className="w-full accent-emerald-500" />
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
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FiBatteryCharging className="w-4 h-4 text-emerald-500" />
              What-If Simulator
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Adjust battery to see how it affects charging stops</p>
            <input type="range" min="10" max="100" step="1" value={batteryPercent} onChange={function (e) { handleWhatIfChange(Number(e.target.value)) }} className="w-full accent-emerald-500" />
            <div className="flex justify-between text-xs text-gray-400"><span>10%</span><span className="font-bold text-emerald-500">{batteryPercent}%</span><span>100%</span></div>
          </div>
        )}

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
                <span className="font-semibold text-gray-900 dark:text-white">{Math.round(route.duration / 60)} min</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Arrival Battery</span>
                <span className={'font-semibold ' + batteryColor}>{arrivalPercent}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Charging stops</span>
                <span className="font-semibold text-amber-500">{route.stops.length}</span>
              </div>
            </div>

            {route.stops.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2.5">Charging Stops ({route.stops.length})</h4>
                <div className="space-y-2">
                  {route.stops.map(function (stop, i) {
                    var stopCost = stop.chargeTime ? Math.round((stop.chargeTime / 3600) * 10) : 0
                    return (
                      <div key={i} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{stop.name || 'Stop ' + (i + 1)}</span>
                          <span className="text-xs text-gray-500">{stop.distanceKm} km</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span className="flex items-center gap-1"><FiBatteryCharging className="w-3 h-3" />{stop.arrivalSoC || '?'}%</span>
                          {stop.chargeTime && <span className="flex items-center gap-1"><FiClock className="w-3 h-3" />{Math.round(stop.chargeTime / 60)} min</span>}
                          <span className="flex items-center gap-1"><FiDollarSign className="w-3 h-3" />{formatCurrency(stopCost)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {route.stops.length === 0 && (
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

      <div className="flex-1">
        <MapContainer center={[20, 78]} zoom={6} className="h-full w-full">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
          {route && route.route && route.route.length > 1 && (
            <>
              <Polyline positions={route.route} pathOptions={{ color: '#22c55e', weight: 4, opacity: 0.7 }} />
              <Marker position={route.route[0]} icon={startIcon}><Popup>{route.originName}</Popup></Marker>
              <Marker position={route.route[route.route.length - 1]} icon={endIcon}><Popup>{route.destName}</Popup></Marker>
              {route.stops.map(function (stop, i) {
                if (!stop.lat || !stop.lng) return null
                return <Marker key={i} position={[stop.lat, stop.lng]} icon={stopIcon}><Popup><div className="text-sm"><strong className="text-gray-900">{stop.name || 'Stop ' + (i + 1)}</strong><p className="text-xs text-gray-500 mt-1">Battery on arrival: {stop.arrivalSoC || '?'}%</p></div></Popup></Marker>
              })}
            </>
          )}
          {(!route || !route.route) && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] text-center pointer-events-none">
              <FiNavigation className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-400 dark:text-gray-500">Plan a trip to see the route on the map</p>
            </div>
          )}
        </MapContainer>
      </div>
    </div>
  )
}

function findChargingStops(routeCoords, totalDistanceM, vehicle, batteryPercent, stations) {
  if (!stations || stations.length === 0 || !vehicle) return []
  var totalKm = totalDistanceM / 1000
  var usableKwh = vehicle.battery_kwh * (batteryPercent / 100) * 0.9
  var rangeKm = (usableKwh / vehicle.consumption_wh_per_km) * 1000
  if (rangeKm >= totalKm * 1.1) return []
  var numStops = Math.ceil(totalKm / (rangeKm * 0.7))
  if (numStops < 1) numStops = 1
  var stops = []
  var interval = numStops > 1 ? totalKm / numStops : totalKm * 0.5
  for (var i = 1; i <= numStops; i++) {
    var targetKm = interval * i
    var fraction = targetKm / totalKm
    if (fraction > 0.95) break
    var idx = Math.floor(fraction * (routeCoords.length - 1))
    var point = routeCoords[idx]
    if (!point) continue
    var nearest = findNearestStation(point, stations, 20)
    if (nearest) {
      var stopDist = Math.round(targetKm)
      var arrivalSoC = Math.max(10, Math.round(100 - (interval * vehicle.consumption_wh_per_km / (vehicle.battery_kwh * 9))))
      var chargeSeconds = 0
      if (vehicle.fast_charge_kw > 0) {
        var kwhNeeded = vehicle.battery_kwh * (0.8 - arrivalSoC / 100)
        chargeSeconds = (kwhNeeded / vehicle.fast_charge_kw) * 3600
      }
      stops.push({ station: nearest, name: nearest.name || nearest.address, address: nearest.address, lat: nearest.latitude, lng: nearest.longitude, distanceKm: stopDist, arrivalSoC: arrivalSoC, chargeTime: chargeSeconds, cost: chargeSeconds > 0 ? (chargeSeconds / 3600) * 10 : 0 })
    }
  }
  return stops
}

function findNearestStation(point, stations, maxKm) {
  var minDist = Infinity, nearest = null, lat1 = point[0], lng1 = point[1]
  stations.forEach(function (s) {
    if (!s.latitude || !s.longitude) return
    var d = haversine(lat1, lng1, s.latitude, s.longitude)
    if (d < minDist && d <= maxKm) { minDist = d; nearest = s }
  })
  return nearest
}

function haversine(lat1, lng1, lat2, lng2) {
  var R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
