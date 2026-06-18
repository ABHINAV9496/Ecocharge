import { useState, useRef } from 'react'
import { FiNavigation, FiMapPin, FiZap, FiClock, FiX, FiChevronLeft, FiCheck, FiSearch, FiInfo, FiDollarSign, FiBattery, FiArrowRight } from 'react-icons/fi'
import VehicleSelector from './VehicleSelector'
import { getEstimatedRange } from '../../data/vehicleProfiles'
import { searchLocations } from '../../api/geocode'
import { planRoute } from '../../api/routePlanner'

var OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0m'
  var h = Math.floor(seconds / 3600)
  var m = Math.round((seconds % 3600) / 60)
  if (h > 0) return h + 'h ' + m + 'm'
  return m + 'm'
}

function formatDistance(meters) {
  var km = Math.round(meters / 1000)
  return km + ' km'
}

function batteryColor(pct) {
  if (pct >= 50) return 'text-emerald-400'
  if (pct >= 20) return 'text-amber-400'
  return 'text-red-400'
}

function chargeTimeLabel(seconds) {
  if (seconds < 60) return '<1m'
  return formatDuration(seconds)
}

export default function RoutePlanner(props) {
  var { vehicle, setVehicle, vehicles, batteryPercent, onRoutePlan, routePlan, onClose, onBatteryChange } = props

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

  async function planRouteAction() {
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

      var plan = {
        route: coordinates,
        distance: distanceM,
        duration: durationS,
        backendPlan: backendPlan,
        origin: originCoords,
        destination: destCoords,
        originName: origin,
        destName: destination,
        stops: backendPlan.stops || [],
      }

      onRoutePlan(plan)
      setLoading(false)
    } catch (e) {
      console.error('Route planning error:', e)
      var msg = 'Route planning failed.'
      if (e.response) {
        if (e.response.status === 401) msg = 'Please log in to plan routes.'
        else if (e.response.status === 403) msg = 'You need a driver account to plan routes.'
        else if (e.response.data && e.response.data.detail) msg = e.response.data.detail
        else if (e.response.data && typeof e.response.data === 'object') msg = JSON.stringify(Object.values(e.response.data).flat().slice(0, 2))
      } else if (e.message) {
        msg = e.message.slice(0, 100)
      }
      setError(msg)
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
          <VehicleSelector vehicle={vehicle} onSelect={setVehicle} vehicles={vehicles} />
        </div>

        {/* Battery */}
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
              onChange={function (e) { onBatteryChange(parseInt(e.target.value)) }}
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
            onClick={planRouteAction}
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
            {/* Summary card */}
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
              {routePlan.backendPlan && (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Charging stops</span>
                    <span className="flex items-center gap-1 text-emerald-400 font-medium">
                      <FiZap className="w-3 h-3" />
                      {routePlan.backendPlan.stops.length}
                    </span>
                  </div>
                  {routePlan.backendPlan.total_charge_time_seconds > 0 && (
                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-emerald-500/10">
                      <span className="text-gray-400">Total trip time</span>
                      <span className="text-white font-medium">
                        {formatDuration(routePlan.duration + routePlan.backendPlan.total_charge_time_seconds)}
                        <span className="text-gray-500 font-normal"> (drive + {formatDuration(routePlan.backendPlan.total_charge_time_seconds)} charge)</span>
                      </span>
                    </div>
                  )}
                  {routePlan.backendPlan.total_cost > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">Est. total cost</span>
                      <span className="flex items-center gap-1 text-emerald-400 font-medium">
                        <FiDollarSign className="w-3 h-3" />
                        ₹{routePlan.backendPlan.total_cost}
                      </span>
                    </div>
                  )}
                  {routePlan.backendPlan.total_energy_consumed_kwh > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">Energy consumed</span>
                      <span className="text-white font-medium">{routePlan.backendPlan.total_energy_consumed_kwh} kWh</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Legs (segments between stops) */}
            {routePlan.backendPlan && routePlan.backendPlan.legs && routePlan.backendPlan.legs.length > 0 && (
              <div>
                <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2 block">Trip Segments</label>
                <div className="space-y-1.5">
                  {routePlan.backendPlan.legs.map(function (leg, i) {
                    return (
                      <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-2.5">
                        <div className="flex items-center gap-2 text-xs">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span className="text-gray-300 truncate flex-1">{leg.start_name}</span>
                          <FiArrowRight className="w-3 h-3 text-gray-600 shrink-0" />
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                          <span className="text-gray-300 truncate flex-1">{leg.end_name}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500">
                          <span>{leg.distance_km} km</span>
                          <span>{formatDuration(leg.drive_time_seconds)}</span>
                          <span className={batteryColor(leg.start_soc_percent)}>
                            <FiBattery className="w-3 h-3 inline mr-0.5" />
                            {leg.start_soc_percent}% → {leg.end_soc_percent}%
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Charging stops */}
            {routePlan.backendPlan && routePlan.backendPlan.stops && routePlan.backendPlan.stops.length > 0 && (
              <div>
                <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2 block">Charging Stops</label>
                <div className="space-y-2">
                  {routePlan.backendPlan.stops.map(function (stop, i) {
                    return (
                      <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center gap-2 p-2.5 bg-gray-800/50 border-b border-gray-700">
                          <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-emerald-400">{i + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-white truncate">{stop.station_name || 'Charging Station'}</div>
                            <div className="text-[11px] text-gray-500 truncate">{stop.address || ''}</div>
                          </div>
                          <span className="text-[11px] font-medium text-emerald-400 whitespace-nowrap">
                            {stop.slot_type.replace('_', ' ')}
                          </span>
                        </div>

                        {/* Details grid */}
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 p-2.5 text-[11px]">
                          <div className="text-gray-500">Arrival</div>
                          <div className={'text-right font-medium ' + batteryColor(stop.arrival_soc_percent)}>
                            {stop.arrival_soc_percent}%
                          </div>

                          <div className="text-gray-500">Charge to</div>
                          <div className="text-right font-medium text-emerald-400">
                            {stop.departure_soc_percent}%
                          </div>

                          <div className="text-gray-500">Energy</div>
                          <div className="text-right font-medium text-white">
                            {stop.charge_kwh} kWh
                          </div>

                          <div className="text-gray-500">Charge time</div>
                          <div className="text-right font-medium text-amber-400">
                            {chargeTimeLabel(stop.charge_time_seconds)}
                          </div>

                          <div className="text-gray-500">Cost</div>
                          <div className="text-right font-medium text-white">
                            ₹{stop.cost}
                          </div>

                          <div className="text-gray-500">Charger</div>
                          <div className="text-right font-medium text-blue-400">
                            {stop.charger_power_kw} kW
                          </div>

                          <div className="text-gray-500">Detour</div>
                          <div className="text-right font-medium text-gray-300">
                            {stop.detour_km} km
                          </div>

                          <div className="text-gray-500">Distance</div>
                          <div className="text-right font-medium text-gray-300">
                            {stop.distance_from_start_km} km
                          </div>
                        </div>

                        {/* Alternatives */}
                        {stop.alternatives && stop.alternatives.length > 0 && (
                          <div className="border-t border-gray-700 p-2.5">
                            <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-1.5">
                              <FiInfo className="w-3 h-3" />
                              Alternatives
                            </div>
                            <div className="space-y-1">
                              {stop.alternatives.map(function (alt, ai) {
                                return (
                                  <div key={ai} className="flex items-center justify-between text-[10px] bg-gray-750 rounded px-2 py-1">
                                    <span className="text-gray-400 truncate flex-1">{alt.station_name}</span>
                                    <span className="text-blue-400 ml-2">{alt.charger_power_kw}kW</span>
                                    <span className="text-gray-500 ml-2">{alt.detour_km}km</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* No stops needed */}
            {routePlan.backendPlan && routePlan.backendPlan.stops && routePlan.backendPlan.stops.length === 0 && (
              routePlan.backendPlan.note && routePlan.backendPlan.note.indexOf('Insufficient') !== -1 ? (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
                  <FiZap className="w-6 h-6 text-red-400 mx-auto mb-2" />
                  <div className="text-sm text-white font-medium">Insufficient range</div>
                  <div className="text-xs text-gray-400 mt-1">{routePlan.backendPlan.note}</div>
                </div>
              ) : (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
                  <FiZap className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                  <div className="text-sm text-white font-medium">No charging stops needed</div>
                  <div className="text-xs text-gray-400 mt-1">Your vehicle has enough range for this trip.</div>
                  {routePlan.backendPlan.final_soc_percent > 0 && (
                    <div className="text-xs text-emerald-400 mt-1">
                      Arriving with {routePlan.backendPlan.final_soc_percent}% battery remaining
                    </div>
                  )}
                </div>
              )
            )}

            {/* Note/warning */}
            {routePlan.backendPlan && routePlan.backendPlan.note && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-400">
                {routePlan.backendPlan.note}
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
