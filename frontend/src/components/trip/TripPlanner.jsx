/*
  Trip Planner (What-If Simulator)
  ---------------------------------
  Plan an EV trip and see predicted battery consumption.

  How it works:
  1. Enter origin and destination (city names or addresses)
  2. Set your starting battery percentage
  3. Click "Plan Trip" to call the FastAPI AI service
  4. The route is shown on the map with a green polyline
  5. Charging stops are listed with estimated battery, time, and cost

  What-If Simulator:
  - After a route is planned, you can adjust the battery slider
  - The route is recalculated to show how different starting charge affects stops
  - Green markers = origin, Red = destination, Blue = charging stops
*/

import { useState } from 'react'
import { FiSearch, FiMapPin, FiBatteryCharging, FiNavigation, FiDollarSign, FiClock } from 'react-icons/fi'
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet'
import L from 'leaflet'
import { planRoute } from '../../api/ai'
import { formatCurrency } from '../../utils/formatters'
import 'leaflet/dist/leaflet.css'

// ----------------------------------------------------------------
// SETUP: Leaflet marker icons
// ----------------------------------------------------------------
delete L.Icon.Default.prototype._getIconUrl

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ----------------------------------------------------------------
// CUSTOM MARKER ICONS for route visualization
// ----------------------------------------------------------------
var startIcon = L.divIcon({
  html: '<div style="width: 24px; height: 24px; background: #22c55e; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>',
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

var endIcon = L.divIcon({
  html: '<div style="width: 24px; height: 24px; background: #ef4444; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>',
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

var stopIcon = L.divIcon({
  html: '<div style="width: 20px; height: 20px; background: #3b82f6; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>',
  className: '',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

// ----------------------------------------------------------------
// MAIN COMPONENT: Trip Planner
// ----------------------------------------------------------------
export default function TripPlanner() {
  // ---- STATE ----
  var [origin, setOrigin] = useState('')              // Starting location
  var [destination, setDestination] = useState('')     // Ending location
  var [batteryPercent, setBatteryPercent] = useState(80)  // Starting battery %
  var [route, setRoute] = useState(null)               // Route data from API
  var [isLoading, setIsLoading] = useState(false)       // Loading indicator
  var [error, setError] = useState('')                  // Error message

  // ---- HANDLE: Plan the route ----
  async function handlePlanRoute() {
    // Guard clause: must provide both origin and destination
    if (!origin || !destination) return

    setIsLoading(true)
    setError('')

    try {
      var response = await planRoute({
        origin: origin,
        destination: destination,
        battery_percent: batteryPercent,
      })

      setRoute(response.data)

    } catch (error) {
      console.error('Route planning error:', error)
      setError('Route planning service unavailable. Make sure FastAPI is running.')
    }

    setIsLoading(false)
  }

  // ---- COMPUTED: Map center and polyline from route data ----
  var mapCenter
  if (route && route.route_coords && route.route_coords.length > 0) {
    mapCenter = [route.route_coords[0][1], route.route_coords[0][0]]
  } else {
    mapCenter = [20, 78]  // Default: center of India
  }

  var polylinePositions = []
  if (route && route.route_coords) {
    polylinePositions = route.route_coords.map(function (coord) {
      return [coord[1], coord[0]]  // Leaflet uses [lat, lng], API returns [lng, lat]
    })
  }

  // ---- HANDLE: What-If slider change ----
  function handleBatteryChange(newValue) {
    setBatteryPercent(newValue)

    // Auto-replan if a route is already showing
    if (route) {
      // Debounce: use setTimeout to avoid too many API calls
      setTimeout(function () {
        planRouteWithBattery(newValue)
      }, 500)
    }
  }

  async function planRouteWithBattery(batteryValue) {
    if (!origin || !destination) return

    try {
      var response = await planRoute({
        origin: origin,
        destination: destination,
        battery_percent: batteryValue,
      })
      setRoute(response.data)
    } catch (error) {
      console.error('What-If replanning error:', error)
    }
  }

  // ---- CALCULATE: Arrival battery percentage indicator ----
  var arrivalBattery = route ? (route.arrival_battery || 0) : 0
  var batteryColor = arrivalBattery > 20 ? 'text-emerald-500' : 'text-red-500'

  // ---- RENDER ----
  return (
    <div className="flex h-[calc(100vh-4rem)]">

      {/* ---- LEFT SIDEBAR: Trip planner controls ---- */}
      <div className="w-full md:w-96 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 overflow-y-auto p-5 space-y-5">

        {/* Page Header */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center">
            <FiNavigation className="w-5 h-5 text-emerald-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Trip Planner</h2>
        </div>

        {/* ---- FORM: Origin, Destination, Battery ---- */}
        <div className="space-y-3.5">

          {/* Origin input */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Origin
            </label>
            <div className="relative">
              <FiMapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={origin}
                onChange={function (e) { setOrigin(e.target.value) }}
                placeholder="e.g. Kochi, Kerala"
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* Destination input */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Destination
            </label>
            <div className="relative">
              <FiNavigation className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={destination}
                onChange={function (e) { setDestination(e.target.value) }}
                placeholder="e.g. Munnar, Kerala"
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* Battery slider */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Starting Battery: <span className="font-bold text-emerald-500">{batteryPercent}%</span>
            </label>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={batteryPercent}
              onChange={function (e) { setBatteryPercent(Number(e.target.value)) }}
              className="w-full accent-emerald-500"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>10%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Plan button */}
          <button
            onClick={handlePlanRoute}
            disabled={isLoading || !origin || !destination}
            className={[
              'w-full py-2.5 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2',
              isLoading || !origin || !destination
                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-emerald-700',
            ].join(' ')}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Planning...
              </>
            ) : (
              <>
                <FiSearch className="w-4 h-4" />
                Plan Trip
              </>
            )}
          </button>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl">
              {error}
            </div>
          )}
        </div>

        {/* ---- WHAT-IF SIMULATOR ----
            Appears after a route is planned.
            Adjust the slider to see how battery % affects charging stops. */}
        {route && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-800 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FiBatteryCharging className="w-4 h-4 text-emerald-500" />
              What-If Simulator
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Adjust the battery slider to see how it affects charging stops
            </p>
            <input
              type="range"
              min="10"
              max="100"
              step="1"
              value={batteryPercent}
              onChange={function (e) { handleBatteryChange(Number(e.target.value)) }}
              className="w-full accent-emerald-500"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>10%</span>
              <span className="font-bold text-emerald-500">{batteryPercent}%</span>
              <span>100%</span>
            </div>
          </div>
        )}

        {/* ---- ROUTE SUMMARY ---- */}
        {route && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-800 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Route Summary</h3>

            <div className="space-y-2 bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Distance</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {route.distance_km ? route.distance_km.toFixed(1) : '-'} km
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Arrival Battery</span>
                <span className={'font-semibold ' + batteryColor}>
                  {route.arrival_battery ? route.arrival_battery.toFixed(0) : '-'}%
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Total Cost</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {route.total_cost ? formatCurrency(route.total_cost) : '-'}
                </span>
              </div>
            </div>

            {/* Charging stops list */}
            {route.stops && route.stops.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2.5">
                  Charging Stops ({route.stops.length})
                </h4>
                <div className="space-y-2">
                  {route.stops.map(function (stop, index) {
                    return (
                      <div key={index} className="p-3.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {stop.name || 'Stop ' + (index + 1)}
                          </span>
                          <span className="text-xs text-gray-500">{stop.distance ? stop.distance.toFixed(1) : '-'} km</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <FiBatteryCharging className="w-3 h-3" />
                            {stop.battery_on_arrival ? stop.battery_on_arrival.toFixed(0) : '-'}%
                          </span>
                          <span className="flex items-center gap-1">
                            <FiClock className="w-3 h-3" />
                            {stop.charge_time || '-'} min
                          </span>
                          <span className="flex items-center gap-1">
                            <FiDollarSign className="w-3 h-3" />
                            {stop.cost ? formatCurrency(stop.cost) : '-'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* No stops needed */}
            {(!route.stops || route.stops.length === 0) && (
              <div className="text-center py-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                <FiBatteryCharging className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  No charging stops needed — enough battery to reach destination!
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---- RIGHT: Map ---- */}
      <div className="flex-1">
        <MapContainer center={mapCenter} zoom={6} className="h-full w-full">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />

          {/* Route polyline + markers */}
          {route && route.route_coords && polylinePositions.length > 0 && (
            <>
              <Polyline
                positions={polylinePositions}
                pathOptions={{ color: '#22c55e', weight: 4, opacity: 0.7 }}
              />

              {/* Origin marker (green) */}
              <Marker position={polylinePositions[0]} icon={startIcon}>
                <Popup>{origin}</Popup>
              </Marker>

              {/* Destination marker (red) */}
              <Marker position={polylinePositions[polylinePositions.length - 1]} icon={endIcon}>
                <Popup>{destination}</Popup>
              </Marker>

              {/* Charging stop markers (blue) */}
              {route.stops && route.stops.map(function (stop, index) {
                if (!stop.lat || !stop.lng) return null

                return (
                  <Marker key={index} position={[stop.lat, stop.lng]} icon={stopIcon}>
                    <Popup>
                      <div className="text-sm">
                        <strong className="text-gray-900">{stop.name || 'Charging Stop ' + (index + 1)}</strong>
                        <p className="text-xs text-gray-500 mt-1">
                          Battery: {stop.battery_on_arrival ? stop.battery_on_arrival.toFixed(0) : '-'}%
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                )
              })}
            </>
          )}

          {/* No route placeholder */}
          {(!route || !route.route_coords) && (
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
