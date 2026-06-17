import { useState, useRef } from 'react'
import { FiNavigation, FiMapPin, FiZap, FiClock, FiX, FiChevronLeft, FiCheck, FiSearch } from 'react-icons/fi'
import VehicleSelector from './VehicleSelector'
import { getEstimatedRange } from '../../data/vehicleProfiles'
import { searchLocations } from '../../api/geocode'
import { getStations, getStationsBatch } from '../../api/stations'
import { generateRouteOptions, findChargingStops, fetchStationsAlongRoute } from '../../utils/route'

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
  var { vehicle, setVehicle, vehicles, stations, batteryPercent, onRoutePlan, routePlan, onClose } = props

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
  var [routeOptions, setRouteOptions] = useState([])
  var [selectedOptionId, setSelectedOptionId] = useState(null)
  var originTimer = useRef(null)
  var destTimer = useRef(null)

  async function doSearch(query, type) {
    if (!query.trim()) {
      if (type === 'origin') { setOriginSuggestions([]); setShowOriginResults(false) }
      else { setDestSuggestions([]); setShowDestResults(false) }
      return
    }
    var data = await searchLocations(query, 5)
    if (type === 'origin') {
      setOriginSuggestions(data)
      setShowOriginResults(data.length > 0)
    } else {
      setDestSuggestions(data)
      setShowDestResults(data.length > 0)
    }
  }

  function handleOriginInput(value) {
    setOrigin(value)
    setOriginCoords(null)
    if (originTimer.current) clearTimeout(originTimer.current)
    originTimer.current = setTimeout(function () { doSearch(value, 'origin') }, 100)
  }

  function handleDestInput(value) {
    setDestination(value)
    setDestCoords(null)
    if (destTimer.current) clearTimeout(destTimer.current)
    destTimer.current = setTimeout(function () { doSearch(value, 'destination') }, 100)
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

      var routeStations = []
      try {
        routeStations = await fetchStationsAlongRoute(coordinates, distanceM / 1000, 20, getStations)
      } catch (e) {
        console.warn('Route station fetch failed, using existing', e)
        routeStations = stations || []
      }

      var allStations = routeStations.length > 0 ? routeStations : stations
      var routeOptions = generateRouteOptions(coordinates, distanceM, vehicle, batteryPercent, allStations)
      var selectedOption = routeOptions[0] || { stops: [] }

      var plan = {
        route: coordinates,
        distance: distanceM,
        duration: durationS,
        stops: selectedOption.stops,
        stations: allStations,
        routeOptions: routeOptions,
        selectedOptionId: selectedOption.id,
        origin: originCoords,
        destination: destCoords,
        originName: origin,
        destName: destination,
      }

      setRouteOptions(routeOptions)
      setSelectedOptionId(selectedOption.id)
      onRoutePlan(plan)
      setLoading(false)
    } catch (e) {
      console.error('Route planning error:', e)
      setError('Route planning failed. Please try again.')
      setLoading(false)
    }
  }

  function selectRouteOption(optionId) {
    var option = routeOptions.find(function (o) { return o.id === optionId })
    if (!option) return
    setSelectedOptionId(optionId)
    var plan = {
      route: routePlan.route,
      distance: routePlan.distance,
      duration: routePlan.duration,
      stops: option.stops,
      stations: routePlan.stations || [],
      routeOptions: routeOptions,
      selectedOptionId: optionId,
      origin: routePlan.origin,
      destination: routePlan.destination,
      originName: routePlan.originName,
      destName: routePlan.destName,
    }
    onRoutePlan(plan)
  }

  function clearRoute() {
    onRoutePlan(null)
    setOrigin('')
    setDestination('')
    setOriginCoords(null)
    setDestCoords(null)
    setRouteOptions([])
    setSelectedOptionId(null)
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
          <VehicleSelector vehicle={vehicle} onSelect={setVehicle} vehicles={vehicles} />
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
              {routePlan.stations && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Stations on route</span>
                  <span className="flex items-center gap-1 text-blue-400 font-medium">
                    <FiSearch className="w-3 h-3" />
                    {routePlan.stations.length}
                  </span>
                </div>
              )}
              {(function () {
                var totalChargeSec = routePlan.stops.reduce(function (s, stop) { return s + (stop.chargeTime || 0) }, 0)
                if (totalChargeSec <= 0) return null
                return (
                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-emerald-500/10">
                    <span className="text-gray-400">Total trip time</span>
                    <span className="text-white font-medium">
                      {formatDuration(routePlan.duration + totalChargeSec)}
                      <span className="text-gray-500 font-normal"> (drive + {formatDuration(totalChargeSec)} charge)</span>
                    </span>
                  </div>
                )
              })()}
            </div>

            {/* Route options */}
            {routeOptions.length > 1 && (
              <div>
                <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2 block">Route Options</label>
                <div className="space-y-1.5">
                  {routeOptions.map(function (opt) {
                    var active = opt.id === selectedOptionId
                    return (
                      <button
                        key={opt.id}
                        onClick={function () { selectRouteOption(opt.id) }}
                        className={
                          'w-full text-left p-2.5 rounded-lg border text-xs transition-all ' +
                          (active
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750 hover:border-gray-600')
                        }
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {active && <FiCheck className="w-3 h-3 text-emerald-400" />}
                            <span className={'font-medium ' + (active ? 'text-white' : '')}>{opt.label}</span>
                          </div>
                          <span className="text-gray-500">{opt.totalTime > 0 ? formatDuration(opt.totalTime * 3600) : ''}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-gray-500">
                          <span>{opt.description}</span>
                          {opt.totalChargeTime > 0 && <span>{formatDuration(opt.totalChargeTime * 3600)} charging</span>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

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


