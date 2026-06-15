import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, LayersControl, Polyline } from 'react-leaflet'
import L from 'leaflet'
import { FiSearch, FiCrosshair, FiBatteryCharging, FiRefreshCw, FiSettings, FiNavigation, FiChevronRight } from 'react-icons/fi'
import { getStations } from '../../api/stations'
import { useWebSocket } from '../../context/WebSocketContext'
import { useAuth } from '../../context/AuthContext'
import VehicleSelector from './VehicleSelector'
import VehicleInfoPanel from './VehicleInfoPanel'
import StationSidebar from './StationSidebar'
import 'leaflet/dist/leaflet.css'

delete L.Icon.Default.prototype._getIconUrl

function createStationIcon(statusCode, isSelected) {
  var colors = {
    ACTIVE: { from: '#22c55e', to: '#16a34a' },
    MAINTENANCE: { from: '#f59e0b', to: '#d97706' },
    INACTIVE: { from: '#9ca3af', to: '#6b7280' },
  }

  var c = colors[statusCode] || colors.ACTIVE
  var size = isSelected ? 44 : 36
  var gradId = 'pin-grad-' + statusCode + (isSelected ? '-sel' : '')

  var svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="', size, '" height="', Math.round(size * 1.5), '">',
    '  <defs>',
    '    <linearGradient id="', gradId, '" x1="0" y1="0" x2="0" y2="1">',
    '      <stop offset="0%" stop-color="', c.from, '" />',
    '      <stop offset="100%" stop-color="', c.to, '" />',
    '    </linearGradient>',
    '    <filter id="pin-shadow">',
    '      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-opacity="0.35" />',
    '    </filter>',
    '  </defs>',
    isSelected ? '  <circle cx="12" cy="13" r="16" fill="none" stroke="' + c.from + '" stroke-width="2" opacity="0.2"><animate attributeName="r" values="14;20;14" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite"/></circle>' : '',
    '  <path d="M12 2C6 2 2 7 2 13C2 20 8 28 12 34C16 28 22 20 22 13C22 7 18 2 12 2Z" fill="url(#', gradId, ')" filter="url(#pin-shadow)" stroke="rgba(255,255,255,0.3)" stroke-width="0.5"/>',
    '  <path d="M12 8L7 15h3.8l-1 6.5 5.2-9h-4l1-6.5z" fill="white" stroke="rgba(0,0,0,0.08)" stroke-width="0.3"/>',
    '</svg>',
  ].join('')

  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [size, Math.round(size * 1.5)],
    iconAnchor: [size / 2, Math.round(size * 1.5)],
  })
}

function createRouteMarkerIcon(color, label) {
  var size = 28
  var svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="', size, '" height="', Math.round(size * 1.5), '">',
    '  <path d="M12 2C6 2 2 7 2 13C2 20 8 28 12 34C16 28 22 20 22 13C22 7 18 2 12 2Z" fill="', color, '" stroke="white" stroke-width="1.5"/>',
    '  <text x="12" y="14" text-anchor="middle" fill="white" font-size="10" font-weight="bold">', label, '</text>',
    '</svg>',
  ].join('')
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [size, Math.round(size * 1.5)],
    iconAnchor: [size / 2, Math.round(size * 1.5)],
  })
}

function createStopIcon(number) {
  var size = 28
  var svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="', size, '" height="', Math.round(size * 1.5), '">',
    '  <path d="M12 2C6 2 2 7 2 13C2 20 8 28 12 34C16 28 22 20 22 13C22 7 18 2 12 2Z" fill="#f59e0b" stroke="white" stroke-width="1.5"/>',
    '  <text x="12" y="14" text-anchor="middle" fill="white" font-size="9" font-weight="bold">', number, '</text>',
    '</svg>',
  ].join('')
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [size, Math.round(size * 1.5)],
    iconAnchor: [size / 2, Math.round(size * 1.5)],
  })
}

function LocationFinder(props) {
  var onLocationFound = props.onLocationFound
  useMapEvents({
    locationfound: function (event) {
      onLocationFound([event.latlng.lat, event.latlng.lng])
      event.target.flyTo(event.latlng, 13)
    },
  })
  return null
}

function FitBoundsOnRoute(props) {
  var routePlan = props.routePlan
  var map = useMapEvents({})
  useEffect(function () {
    if (routePlan && routePlan.route && routePlan.route.length > 1) {
      var bounds = L.latLngBounds(routePlan.route.map(function (c) { return [c[0], c[1]] }))
      map.fitBounds(bounds, { padding: [80, 80] })
    }
  }, [routePlan])
  return null
}

export default function MapView(props) {
  var {
    onRoutePlan,
    routePlan,
    vehicle,
    batteryPercent,
    onVehicleChange,
    onBatteryChange,
    onStationsLoad,
    onTogglePlanner,
    showPlanner,
  } = props || {}

  var [stations, setStations] = useState([])
  var [selectedStation, setSelectedStation] = useState(null)
  var [userLocation, setUserLocation] = useState([9.9312, 76.2673])
  var [searchQuery, setSearchQuery] = useState('')
  var [locationQuery, setLocationQuery] = useState('')
  var [searchRadius, setSearchRadius] = useState('all')
  var [isLoading, setIsLoading] = useState(true)
  var [isError, setIsError] = useState(false)
  var [errorMessage, setErrorMessage] = useState('')
  var [statusFilter, setStatusFilter] = useState('all')
  var [bookingMessage, setBookingMessage] = useState(null)
  var [searchSuggestions, setSearchSuggestions] = useState([])
  var [showSearchSuggestions, setShowSearchSuggestions] = useState(false)
  var [showSettings, setShowSettings] = useState(false)
  var [showUserMenu, setShowUserMenu] = useState(false)
  var searchTimer = useRef(null)
  var settingsRef = useRef(null)
  var userMenuRef = useRef(null)

  var { statuses: liveStatuses } = useWebSocket()
  var { user, logoutUser } = useAuth()
  var mapRef = useRef(null)

  var loadStations = useCallback(async function (lat, lng, radius) {
    setIsLoading(true)
    setIsError(false)
    setErrorMessage('')
    try {
      radius = radius || searchRadius
      var params = { include_ocm: 'true' }
      if (lat && lng && radius !== 'all') {
        params.lat = lat
        params.lng = lng
        params.radius = radius
      }
      var response = await getStations(params)
      var data = response.data || []
      setStations(data)
      if (onStationsLoad) onStationsLoad(data)
    } catch (error) {
      console.error('Failed to load charging stations:', error)
      setIsError(true)
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        setErrorMessage('Could not connect to the server. The backend may be down.')
      } else if (error.response && error.response.status === 401) {
        setErrorMessage('Please log in to view charging stations.')
      } else {
        setErrorMessage('Failed to load stations. Please try again.')
      }
      setStations([])
      if (onStationsLoad) onStationsLoad([])
    } finally {
      setIsLoading(false)
    }
  }, [searchRadius, onStationsLoad])

  useEffect(function () {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        function (position) {
          var loc = [position.coords.latitude, position.coords.longitude]
          setUserLocation(loc)
          loadStations(loc[0], loc[1], searchRadius)
        },
        function () {
          loadStations(userLocation[0], userLocation[1], searchRadius)
        },
        { enableHighAccuracy: true, timeout: 10000 }
      )
    } else {
      loadStations(userLocation[0], userLocation[1], searchRadius)
    }
  }, [])

  useEffect(function () {
    if (stations.length > 0) {
      loadStations(userLocation[0], userLocation[1], searchRadius)
    }
  }, [searchRadius])

  useEffect(function () {
    function handleClick(e) {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) setShowSettings(false)
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return function () { document.removeEventListener('mousedown', handleClick) }
  }, [])

  function handleBookingSuccess(message) {
    setBookingMessage(message)
    setTimeout(function () { setBookingMessage(null) }, 3000)
    loadStations(userLocation[0], userLocation[1], searchRadius)
  }

  function findMyLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function (position) {
        var loc = [position.coords.latitude, position.coords.longitude]
        setUserLocation(loc)
        loadStations(loc[0], loc[1], searchRadius)
        if (mapRef.current) mapRef.current.flyTo(loc, 13)
      })
    }
  }

  function handleRetry() {
    loadStations(userLocation[0], userLocation[1], searchRadius)
  }

  var filteredStations = useMemo(function () {
    return stations.filter(function (station) {
      var passesStatus = true
      if (statusFilter === 'available') {
        passesStatus = station.slots && station.slots.some(function (s) { return s.status === 'AVAILABLE' })
      } else if (statusFilter === 'occupied') {
        passesStatus = station.slots && station.slots.some(function (s) { return s.status === 'OCCUPIED' })
      }
      var passesSearch = true
      if (searchQuery) {
        var q = searchQuery.toLowerCase()
        passesSearch = (station.name || '').toLowerCase().indexOf(q) !== -1 ||
                       (station.address || '').toLowerCase().indexOf(q) !== -1
      }
      return passesStatus && passesSearch
    })
  }, [stations, statusFilter, searchQuery])

  async function searchLocation() {
    if (!locationQuery.trim()) return
    try {
      var res = await fetch('/api/geocode/?q=' + encodeURIComponent(locationQuery) + '&limit=1')
      var data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        var lat = parseFloat(data[0].lat)
        var lng = parseFloat(data[0].lon)
        setUserLocation([lat, lng])
        loadStations(lat, lng, searchRadius)
        if (mapRef.current) mapRef.current.flyTo([lat, lng], 12)
      }
    } catch (error) {
      console.error('Location search failed:', error)
    }
  }

  async function geocodeSearch(query) {
    if (!query.trim()) { setSearchSuggestions([]); setShowSearchSuggestions(false); return }
    try {
      var res = await fetch('/api/geocode/?q=' + encodeURIComponent(query) + '&limit=5')
      if (!res.ok) return
      var data = await res.json()
      if (!Array.isArray(data)) return
      setSearchSuggestions(data)
      setShowSearchSuggestions(data.length > 0)
    } catch (e) { console.error('Search geocode error:', e) }
  }

  function handleLocationInput(value) {
    setLocationQuery(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(function () { geocodeSearch(value) }, 600)
  }

  function selectSearchSuggestion(s) {
    setLocationQuery(s.display_name)
    setShowSearchSuggestions(false)
    var lat = parseFloat(s.lat)
    var lng = parseFloat(s.lon)
    setUserLocation([lat, lng])
    loadStations(lat, lng, searchRadius)
    if (mapRef.current) mapRef.current.flyTo([lat, lng], 12)
  }

  function handleLocationKeyDown(e) {
    if (e.key === 'Enter') searchLocation()
  }

  return (
    <div className="h-full w-full relative">
      {/* Booking toast */}
      {bookingMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000] bg-emerald-600 text-white px-5 py-2.5 rounded-xl shadow-lg backdrop-blur-sm text-sm">
          <div className="flex items-center gap-2">
            <FiBatteryCharging className="w-4 h-4" />
            {bookingMessage}
          </div>
        </div>
      )}

      {/* Error banner */}
      {isError && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000] bg-red-600/90 backdrop-blur-md text-white px-4 py-2.5 rounded-xl shadow-lg border border-red-400/50 flex items-center gap-3 max-w-md">
          <span className="text-sm">{errorMessage || 'Something went wrong'}</span>
          <button onClick={handleRetry} className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium transition-colors shrink-0 flex items-center gap-1">
            <FiRefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {/* Top bar — ABRP style */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex items-start gap-2">
        <div className="flex items-center gap-2">
          {!showPlanner && (
            <button
              onClick={onTogglePlanner}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-900/90 backdrop-blur-md border border-gray-700 rounded-xl text-sm text-white hover:bg-gray-800 transition-colors shadow-lg"
              title="Open route planner"
            >
              <FiNavigation className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Route</span>
              <FiChevronRight className="w-3 h-3 text-gray-400" />
            </button>
          )}
          <VehicleSelector vehicle={vehicle} onSelect={onVehicleChange} />
        </div>

        <div className="flex-1 max-w-xl mx-auto relative">
          <div className="flex items-center bg-gray-900/90 backdrop-blur-md border border-gray-700 rounded-xl px-3 py-2.5 shadow-lg">
            <FiSearch className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search destination or location..."
              value={locationQuery}
              onChange={function (e) { handleLocationInput(e.target.value) }}
              onKeyDown={handleLocationKeyDown}
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder-gray-500"
            />
            <button onClick={searchLocation} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors shrink-0 ml-2">
              Go
            </button>
          </div>
          {showSearchSuggestions && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 max-h-40 overflow-y-auto">
              {searchSuggestions.map(function (s, i) {
                return (
                  <button
                    key={i}
                    onClick={function () { selectSearchSuggestion(s) }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 border-b border-gray-700/50 last:border-0 truncate"
                  >
                    {s.display_name}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <select
            value={searchRadius}
            onChange={function (e) { setSearchRadius(e.target.value) }}
            className="bg-gray-900/90 backdrop-blur-md border border-gray-700 rounded-xl px-2.5 py-2.5 text-xs text-gray-300 outline-none shadow-lg cursor-pointer"
          >
            <option value="all">All India</option>
            <option value={50}>50 km</option>
            <option value={25}>25 km</option>
            <option value={10}>10 km</option>
            <option value={5}>5 km</option>
          </select>

          <button
            onClick={findMyLocation}
            className="bg-gray-900/90 backdrop-blur-md border border-gray-700 rounded-xl p-2.5 shadow-lg hover:bg-gray-800 transition-colors"
            title="My location"
          >
            <FiCrosshair className="w-4 h-4 text-emerald-400" />
          </button>

          <div ref={settingsRef} className="relative">
            <button
              onClick={function () { setShowSettings(!showSettings); setShowUserMenu(false) }}
              className="bg-gray-900/90 backdrop-blur-md border border-gray-700 rounded-xl p-2.5 shadow-lg hover:bg-gray-800 transition-colors"
              title="Settings"
            >
              <FiSettings className="w-4 h-4 text-gray-400" />
            </button>
            {showSettings && (
              <div className="absolute top-full right-0 mt-1 w-48 bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="px-3 py-2.5 border-b border-gray-800">
                  <div className="text-xs font-semibold text-white">EcoCharge</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">v1.0.0</div>
                </div>
                <div className="px-3 py-2 text-[11px] text-gray-400 leading-relaxed">
                  Map layers can be toggled via the control panel in the bottom-right corner.
                </div>
              </div>
            )}
          </div>

          <div ref={userMenuRef} className="relative">
            {user ? (
              <>
                <button
                  onClick={function () { setShowUserMenu(!showUserMenu); setShowSettings(false) }}
                  className="w-8 h-8 rounded-xl bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center shadow-lg transition-colors"
                  title={user.username || user.email || 'User'}
                >
                  <span className="text-white text-xs font-bold">
                    {(user.username || user.email || 'U')[0].toUpperCase()}
                  </span>
                </button>
                {showUserMenu && (
                  <div className="absolute top-full right-0 mt-1 w-48 bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="px-3 py-2.5 border-b border-gray-800">
                      <div className="text-xs font-semibold text-white truncate">{user.username || 'User'}</div>
                      <div className="text-[10px] text-gray-500 truncate">{user.email || ''}</div>
                    </div>
                    <button
                      onClick={function () {
                        logoutUser()
                        window.location.href = '/login'
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </>
            ) : (
              <a
                href="/login"
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-xl shadow-lg transition-colors"
              >
                Login
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="absolute top-16 left-4 z-[1000] flex items-center gap-1.5">
        {['all', 'available', 'occupied'].map(function (opt) {
          var active = statusFilter === opt
          return (
            <button
              key={opt}
              onClick={function () { setStatusFilter(opt) }}
              className={
                'px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-all ' +
                (active
                  ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                  : 'bg-gray-900/80 backdrop-blur-md text-gray-400 border border-gray-700 hover:bg-gray-800')
              }
            >
              {opt === 'all' ? 'All' : opt === 'available' ? 'Free' : 'Busy'}
            </button>
          )
        })}
      </div>

      {/* Vehicle info panel — left side (only when no planner) */}
      {!showPlanner && (
        <VehicleInfoPanel
          vehicle={vehicle}
          batteryPercent={batteryPercent}
          onBatteryChange={onBatteryChange}
        />
      )}

      {/* Map */}
      <MapContainer
        center={userLocation}
        zoom={12}
        className="h-full w-full"
        ref={mapRef}
      >
        <LayersControl position="bottomright">
          <LayersControl.BaseLayer checked name="Light">
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Dark">
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              attribution='&copy; <a href="https://esa.int">ESA</a>'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}.png"
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        <LocationFinder onLocationFound={function (loc) { setUserLocation(loc) }} />

        <FitBoundsOnRoute routePlan={routePlan} />

        {/* Route polyline */}
        {routePlan && routePlan.route && routePlan.route.length > 1 && (
          <Polyline
            positions={routePlan.route}
            pathOptions={{ color: '#10b981', weight: 4, opacity: 0.8 }}
          />
        )}

        {/* Route start marker */}
        {routePlan && routePlan.origin && (
          <Marker position={[routePlan.origin.lat, routePlan.origin.lng]} icon={createRouteMarkerIcon('#10b981', 'S')} />
        )}

        {/* Route destination marker */}
        {routePlan && routePlan.destination && (
          <Marker position={[routePlan.destination.lat, routePlan.destination.lng]} icon={createRouteMarkerIcon('#ef4444', 'E')} />
        )}

        {/* Charging stop markers */}
        {routePlan && routePlan.stops && routePlan.stops.map(function (stop, i) {
          if (!stop.lat || !stop.lng) return null
          return (
            <Marker key={'stop-' + i} position={[stop.lat, stop.lng]} icon={createStopIcon(i + 1)}>
              <Popup>
                <div className="min-w-[180px]">
                  <h3 className="font-semibold text-sm mb-1">{stop.name || 'Charging Stop'}</h3>
                  <p className="text-xs text-gray-500 mb-1">{stop.address || ''}</p>
                  <div className="text-xs text-amber-600 font-medium">Charging stop #{i + 1}</div>
                </div>
              </Popup>
            </Marker>
          )
        })}

        {filteredStations.map(function (station) {
          var lat = station.latitude
          var lng = station.longitude
          if (!lat || !lng) return null

          var available = station.slots ? station.slots.filter(function (s) { return s.status === 'AVAILABLE' }).length : 0
          var total = station.slots ? station.slots.length : 0
          var mStatus = available > 0 ? 'ACTIVE' : total > 0 ? 'MAINTENANCE' : 'INACTIVE'
          var isSelected = selectedStation && selectedStation.id === station.id

          return (
            <Marker key={station.id} position={[lat, lng]} icon={createStationIcon(mStatus, isSelected)}>
              <Popup>
                <div className="min-w-[200px]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={'w-2 h-2 rounded-full shrink-0 ' + (available > 0 ? 'bg-emerald-500' : total > 0 ? 'bg-amber-500' : 'bg-gray-400')} />
                    <h3 className="font-semibold text-sm">{station.name}</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-2 truncate">{station.address}</p>
                  <div className="flex items-center gap-2 text-xs mb-3">
                    <span className={'px-2 py-0.5 rounded-full font-medium ' + (available > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200')}>
                      {available > 0 ? available + '/' + total + ' Available' : 'No slots free'}
                    </span>
                  </div>
                  <button
                    onClick={function () { setSelectedStation(station) }}
                    className="w-full py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-medium rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-md"
                  >
                    View Details
                  </button>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      {/* Loading */}
      {isLoading && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000] bg-gray-900/90 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-lg border border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-emerald-500 border-t-transparent" />
            Loading stations...
          </div>
        </div>
      )}

      {/* Bottom bar */}
      {!isLoading && stations.length > 0 && !isError && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000]">
          <div className="bg-gray-900/90 backdrop-blur-md px-4 py-2 rounded-xl shadow-lg border border-gray-800 text-xs text-gray-400 flex items-center gap-3">
            <span>{filteredStations.length} of {stations.length} stations</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Active
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Maint
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-500" /> Off
            </span>
          </div>
        </div>
      )}

      {/* Station sidebar */}
      {selectedStation && (
        <StationSidebar
          station={selectedStation}
          onClose={function () { setSelectedStation(null) }}
          onBookSuccess={handleBookingSuccess}
          statuses={liveStatuses}
          user={user}
        />
      )}

      <style>{`
        .leaflet-control-zoom {
          border: 1px solid #374151 !important;
          border-radius: 12px !important;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.4) !important;
          margin-top: 8px !important;
        }
        .leaflet-control-zoom a {
          background: rgba(17, 24, 39, 0.95) !important;
          color: #9ca3af !important;
          border-bottom: 1px solid #374151 !important;
          width: 36px !important;
          height: 36px !important;
          line-height: 36px !important;
          font-size: 18px !important;
          transition: background 0.15s, color 0.15s !important;
        }
        .leaflet-control-zoom a:hover {
          background: rgba(31, 41, 55, 0.95) !important;
          color: #10b981 !important;
        }
        .leaflet-control-zoom a.leaflet-disabled {
          color: #4b5563 !important;
        }
      `}</style>
    </div>
  )
}
