import { useState, useRef } from 'react'
import { FiNavigation, FiMapPin, FiZap, FiClock, FiX, FiChevronLeft } from 'react-icons/fi'
import VehicleSelector from './VehicleSelector'
import { getEstimatedRange, getVehicleById } from '../../data/vehicleProfiles'

var OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'

function formatDuration(seconds) {
  var h = Math.floor(seconds / 3600)
  var m = Math.round((seconds % 3600) / 60)
  if (h > 0) return h + 'h ' + m + 'm'
  return m + 'm'
}

function formatDistance(meters) {
  var km = Math.round(meters / 1000)
  return km + ' km'
}

export default function RoutePlanner(props) {
  var { vehicle, setVehicle, stations, batteryPercent, onRoutePlan, routePlan, onClose } = props

  var [origin, setOrigin] = useState('')
  var [destination, setDestination] = useState('')
  var [originCoords, setOriginCoords] = useState(null)
  var [destCoords, setDestCoords] = useState(null)
  var [loading, setLoading] = useState(false)
  var [error, setError] = useState('')
  var [showOriginResults, setShowOriginResults] = useState(false)
  var [showDestResults, setShowDestResults] = useState(false)
  var [originSuggestions, setOriginSuggestions] = useState([])
  var [destSuggestions, setDestSuggestions] = useState([])
  var originTimer = useRef(null)
  var destTimer = useRef(null)

  async function geocode(query, type) {
    if (!query.trim()) {
      if (type === 'origin') { setOriginSuggestions([]); setShowOriginResults(false) }
      else { setDestSuggestions([]); setShowDestResults(false) }
      return
    }
    try {
      var res = await fetch('/api/geocode/?q=' + encodeURIComponent(query) + '&limit=5')
      if (!res.ok) return
      var data = await res.json()
      if (!Array.isArray(data)) return
      if (type === 'origin') {
        setOriginSuggestions(data)
        setShowOriginResults(data.length > 0)
      } else {
        setDestSuggestions(data)
        setShowDestResults(data.length > 0)
      }
    } catch (e) {
      console.error('Geocode error:', e)
    }
  }

  function handleOriginInput(value) {
    setOrigin(value)
    setOriginCoords(null)
    if (originTimer.current) clearTimeout(originTimer.current)
    originTimer.current = setTimeout(function () { geocode(value, 'origin') }, 600)
  }

  function handleDestInput(value) {
    setDestination(value)
    setDestCoords(null)
    if (destTimer.current) clearTimeout(destTimer.current)
    destTimer.current = setTimeout(function () { geocode(value, 'destination') }, 600)
  }

  function selectOrigin(suggestion) {
    setOrigin(suggestion.display_name)
    setOriginCoords({ lat: parseFloat(suggestion.lat), lng: parseFloat(suggestion.lon) })
    setShowOriginResults(false)
  }

  function selectDest(suggestion) {
    setDestination(suggestion.display_name)
    setDestCoords({ lat: parseFloat(suggestion.lat), lng: parseFloat(suggestion.lon) })
    setShowDestResults(false)
  }

  async function planRoute() {
    if (!originCoords || !destCoords) {
      setError('Please select a valid origin and destination from the suggestions.')
      return
    }
    if (!vehicle) {
      setError('Please select a vehicle.')
      return
    }
    setLoading(true)
    setError('')
    try {
      var url = OSRM_BASE + '/' +
        originCoords.lng + ',' + originCoords.lat + ';' +
        destCoords.lng + ',' + destCoords.lat +
        '?geometries=geojson&overview=full&steps=true'
      var res = await fetch(url)
      var data = await res.json()

      if (!data.routes || data.routes.length === 0) {
        setError('Could not find a route between these locations.')
        setLoading(false)
        return
      }

      var route = data.routes[0]
      var coordinates = route.geometry.coordinates.map(function (c) {
        return [c[1], c[0]]
      })
      var distanceM = route.distance
      var durationS = route.duration

      var stops = findChargingStops(coordinates, distanceM, vehicle, batteryPercent, stations)

      var plan = {
        route: coordinates,
        distance: distanceM,
        duration: durationS,
        stops: stops,
        origin: originCoords,
        destination: destCoords,
        originName: origin,
        destName: destination,
      }

      onRoutePlan(plan)
      setLoading(false)
    } catch (e) {
      console.error('Route planning error:', e)
      setError('Route planning failed. Please try again.')
      setLoading(false)
    }
  }

  function clearRoute() {
    onRoutePlan(null)
    setOrigin('')
    setDestination('')
    setOriginCoords(null)
    setDestCoords(null)
  }

  return (
    <div className="h-full flex flex-col bg-gray-900/95 backdrop-blur-xl border-r border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <FiNavigation className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-white">Route Planner</span>
        </div>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-800 text-gray-400 transition-colors">
          <FiChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Origin */}
        <div className="relative">
          <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1.5 block">From</label>
          <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <input
              type="text"
              placeholder="Starting location..."
              value={origin}
              onChange={function (e) { handleOriginInput(e.target.value) }}
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder-gray-500"
            />
            {originCoords && <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />}
          </div>
          {showOriginResults && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 max-h-40 overflow-y-auto">
              {originSuggestions.map(function (s, i) {
                return (
                  <button
                    key={i}
                    onClick={function () { selectOrigin(s) }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 border-b border-gray-700/50 last:border-0 truncate"
                  >
                    {s.display_name}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Destination */}
        <div className="relative">
          <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1.5 block">To</label>
          <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
            <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            <input
              type="text"
              placeholder="Destination..."
              value={destination}
              onChange={function (e) { handleDestInput(e.target.value) }}
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder-gray-500"
            />
            {destCoords && <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 animate-pulse" />}
          </div>
          {showDestResults && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 max-h-40 overflow-y-auto">
              {destSuggestions.map(function (s, i) {
                return (
                  <button
                    key={i}
                    onClick={function () { selectDest(s) }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 border-b border-gray-700/50 last:border-0 truncate"
                  >
                    {s.display_name}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Vehicle */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1.5 block">Vehicle</label>
          <VehicleSelector vehicle={vehicle} onSelect={setVehicle} />
        </div>

        {/* Battery (compact) */}
        {vehicle && (
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-500">Starting battery</span>
              <span className="text-white font-medium">{batteryPercent}%</span>
            </div>
            <input
              type="range"
              min={5}
              max={100}
              value={batteryPercent}
              onChange={function (e) { props.onBatteryChange(parseInt(e.target.value)) }}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{
                background: 'linear-gradient(to right, #10b981 ' + batteryPercent + '%, #374151 ' + batteryPercent + '%)',
              }}
            />
            <div className="text-xs text-emerald-400 mt-1">
              Range: {getEstimatedRange(vehicle, batteryPercent)} km
            </div>
          </div>
        )}

        {/* Plan button or route summary */}
        {!routePlan ? (
          <button
            onClick={planRoute}
            disabled={loading}
            className={
              'w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ' +
              (loading
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20')
            }
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-emerald-400 border-t-transparent" />
                Planning...
              </>
            ) : (
              <>
                <FiNavigation className="w-4 h-4" />
                Plan Route
              </>
            )}
          </button>
        ) : (
          <div className="space-y-3">
            {/* Status indicator */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Distance</span>
                <span className="text-white font-medium">{formatDistance(routePlan.distance)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Est. driving time</span>
                <span className="flex items-center gap-1 text-white font-medium">
                  <FiClock className="w-3 h-3 text-emerald-400" />
                  {formatDuration(routePlan.duration)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Charging stops</span>
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <FiZap className="w-3 h-3" />
                  {routePlan.stops.length}
                </span>
              </div>
            </div>

            {/* Charging stops */}
            {routePlan.stops.length > 0 && (
              <div>
                <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2 block">Charging Stops</label>
                <div className="space-y-2">
                  {routePlan.stops.map(function (stop, i) {
                    return (
                      <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-[10px] font-bold text-emerald-400">{i + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-white truncate">{stop.name || 'Charging Station'}</div>
                            <div className="text-[11px] text-gray-500 truncate mt-0.5">{stop.address || ''}</div>
                            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
                              <span>{stop.distanceKm} km from start</span>
                              {stop.chargeTime && (
                                <span className="flex items-center gap-1 text-emerald-400">
                                  <FiZap className="w-2.5 h-2.5" />
                                  {formatDuration(stop.chargeTime)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {routePlan.stops.length === 0 && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
                <FiZap className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                <div className="text-sm text-white font-medium">No charging stops needed</div>
                <div className="text-xs text-gray-400 mt-1">Your vehicle has enough range for this trip.</div>
              </div>
            )}

            <button
              onClick={clearRoute}
              className="w-full py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-700 transition-colors"
            >
              Clear Route
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}
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
      stops.push({
        station: nearest,
        name: nearest.name || nearest.address,
        address: nearest.address,
        lat: nearest.latitude,
        lng: nearest.longitude,
        distanceKm: stopDist,
        arrivalSoC: arrivalSoC,
        chargeTime: chargeSeconds,
      })
    }
  }

  return stops
}

function findNearestStation(point, stations, maxKm) {
  var minDist = Infinity
  var nearest = null
  var lat1 = point[0]
  var lng1 = point[1]

  stations.forEach(function (s) {
    if (!s.latitude || !s.longitude) return
    var d = haversine(lat1, lng1, s.latitude, s.longitude)
    if (d < minDist && d <= maxKm) {
      minDist = d
      nearest = s
    }
  })

  return nearest
}

function haversine(lat1, lng1, lat2, lng2) {
  var R = 6371
  var dLat = (lat2 - lat1) * Math.PI / 180
  var dLng = (lng2 - lng1) * Math.PI / 180
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}
