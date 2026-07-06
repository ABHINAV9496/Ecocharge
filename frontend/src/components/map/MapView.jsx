import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap, LayersControl, Polyline } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'

import L from 'leaflet'
import { FiSearch, FiCrosshair, FiBatteryCharging, FiRefreshCw, FiArrowRight, FiX, FiClock, FiDollarSign, FiZap, FiInfo, FiFilter, FiMap, FiExternalLink, FiBookOpen } from 'react-icons/fi'
import { getStations, searchStations } from '../../api/stations'
import { searchLocations } from '../../api/geocode'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useVehicle } from '../../context/VehicleContext'
import { formatDistance, formatDuration } from '../../utils/formatters'
import 'leaflet/dist/leaflet.css'

delete L.Icon.Default.prototype._getIconUrl

function createStationIcon(statusCode, isSelected) {
  var colors = { ACTIVE: { fill: '#22c55e', stroke: '#16a34a' }, MAINTENANCE: { fill: '#f59e0b', stroke: '#d97706' }, INACTIVE: { fill: '#94a3b8', stroke: '#64748b' } }
  var c = colors[statusCode] || colors.ACTIVE
  var s = isSelected ? 32 : 26
  var svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="', s, '" height="', s, '">',
    isSelected ? '<circle cx="14" cy="14" r="18" fill="none" stroke="' + c.stroke + '" stroke-width="2" opacity="0.3"><animate attributeName="r" values="15;21;15" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite"/></circle>' : '',
    '  <g filter="url(#s)">', '    <circle cx="14" cy="14" r="12" fill="', c.fill, '" stroke="white" stroke-width="2"/>', '    <path d="M13 5l-6 10h5l-1 8 7-11h-5l4-7z" fill="white"/>', '  </g>',
    '  <defs><filter id="s"><feDropShadow dx="0" dy="1.5" stdDeviation="2.5" flood-opacity="0.35"/></filter></defs>', '</svg>',
  ].join('')
  return L.divIcon({ html: svg, className: '', iconSize: [s, s], iconAnchor: [s / 2, s / 2] })
}

function createRouteMarkerIcon(color, label) {
  var size = 28
  var svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="', size, '" height="', Math.round(size * 1.5), '">',
    '  <path d="M12 2C6 2 2 7 2 13C2 20 8 28 12 34C16 28 22 20 22 13C22 7 18 2 12 2Z" fill="', color, '" stroke="white" stroke-width="1.5"/>',
    '  <text x="12" y="14" text-anchor="middle" fill="white" font-size="10" font-weight="bold">', label, '</text>', '</svg>',
  ].join('')
  return L.divIcon({ html: svg, className: '', iconSize: [size, Math.round(size * 1.5)], iconAnchor: [size / 2, Math.round(size * 1.5)] })
}

function createStopIcon(number) {
  var size = 28
  var svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="', size, '" height="', Math.round(size * 1.5), '">',
    '  <path d="M12 2C6 2 2 7 2 13C2 20 8 28 12 34C16 28 22 20 22 13C22 7 18 2 12 2Z" fill="#f59e0b" stroke="white" stroke-width="1.5"/>',
    '  <text x="12" y="14" text-anchor="middle" fill="white" font-size="9" font-weight="bold">', number, '</text>', '</svg>',
  ].join('')
  return L.divIcon({ html: svg, className: '', iconSize: [size, Math.round(size * 1.5)], iconAnchor: [size / 2, Math.round(size * 1.5)] })
}

function ViewportWatcher({ onViewportChange }) {
  useMapEvents({ moveend: function () { onViewportChange() } })
  return null
}

function FitBoundsOnRoute({ routePlan }) {
  var map = useMapEvents({})
  useEffect(function () {
    if (!routePlan) return
    var wg = routePlan.waypointGeometry || (routePlan.backendPlan && routePlan.backendPlan.waypoint_geometry)
    var coords = wg && wg.length > 1 ? wg : (routePlan.route && routePlan.route.length > 1 ? routePlan.route : null)
    if (coords) { map.fitBounds(L.latLngBounds(coords.map(function (c) { return [c[0], c[1]] })), { padding: [80, 80] }) }
  }, [routePlan])
  return null
}

export default function MapView({ routePlan }) {
  var { vehicle } = useVehicle()
  var navigate = useNavigate()
  var [stations, setStations] = useState([])
  var [userLocation, setUserLocation] = useState([20.5937, 78.9629])
  var [locationQuery, setLocationQuery] = useState('')
  var [isLoading, setIsLoading] = useState(true)
  var [isError, setIsError] = useState(false)
  var [errorMessage, setErrorMessage] = useState('')
  var [statusFilter, setStatusFilter] = useState('all')
  var [searchSuggestions, setSearchSuggestions] = useState([])
  var [showSearchSuggestions, setShowSearchSuggestions] = useState(false)
  var [showUserMenu, setShowUserMenu] = useState(false)
  var [isLocating, setIsLocating] = useState(false)
  var [slotTypeFilter, setSlotTypeFilter] = useState([])
  var [showFilterPanel, setShowFilterPanel] = useState(false)
  var [showRoutePopup, setShowRoutePopup] = useState(false)
  var searchTimer = useRef(null)
  var filterRef = useRef(null)
  var userMenuRef = useRef(null)
  var { user, logoutUser } = useAuth()
  var mapRef = useRef(null)
  var showToast = useToast()
  var debounceTimer = useRef(null)
  var initialLoadDone = useRef(null)
  var stationCache = useRef({})
  var bp = routePlan ? routePlan.backendPlan : null

  function getBoundsCell(bounds) {
    if (!bounds) return null
    var digits = 1
    var key = (Math.round(bounds.getSouth() * digits) / digits) + ',' +
              (Math.round(bounds.getWest() * digits) / digits) + ',' +
              (Math.round(bounds.getNorth() * digits) / digits) + ',' +
              (Math.round(bounds.getEast() * digits) / digits)
    return key
  }

  var loadStations = useCallback(async function (explicitBounds) {
    if (debounceTimer.current) { clearTimeout(debounceTimer.current); debounceTimer.current = null }
    var bounds
    if (explicitBounds) { bounds = explicitBounds }
    else if (mapRef.current) { bounds = mapRef.current.getBounds() }
    if (!bounds) return
    var cellKey = getBoundsCell(bounds)
    if (cellKey && stationCache.current[cellKey]) {
      setStations(stationCache.current[cellKey]); return
    }
    setIsLoading(true); setIsError(false); setErrorMessage('')
    try {
      var params = {}
      params.bounds = bounds.getSouth() + ',' + bounds.getWest() + ',' + bounds.getNorth() + ',' + bounds.getEast()
      var response = await getStations(params); var data = response.data || []
      setStations(data)
      if (cellKey) stationCache.current[cellKey] = data
    } catch (error) {
      console.error('Failed to load charging stations:', error); setIsError(true)
      setErrorMessage(error.code === 'ERR_NETWORK' || error.message === 'Network Error' ? 'Could not connect to the server. The backend may be down.' : error.response && error.response.status === 401 ? 'Please log in to view charging stations.' : 'Failed to load stations. Please try again.')
      setStations([])
    } finally { setIsLoading(false) }
  }, [])

  useEffect(function () {
    if (!routePlan && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function (position) {
        var loc = [position.coords.latitude, position.coords.longitude]; setUserLocation(loc)
        if (mapRef.current) mapRef.current.setView(loc, 13)
      }, function () { }, { enableHighAccuracy: true, timeout: 10000 })
    }
  }, [routePlan])

  function MapInitLoader() {
    var map = useMap()
    useEffect(function () {
      if (!initialLoadDone.current) {
        initialLoadDone.current = true
        mapRef.current = map
        loadStations()
      }
    }, [])
    return null
  }

  useEffect(function () {
    function handleClick(e) {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilterPanel(false)
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false)
    }
    document.addEventListener('mousedown', handleClick); return function () { document.removeEventListener('mousedown', handleClick) }
  }, [])

  function findMyLocation() {
    if (navigator.geolocation) { setIsLocating(true); navigator.geolocation.getCurrentPosition(function (position) { var loc = [position.coords.latitude, position.coords.longitude]; setUserLocation(loc); loadStations(); if (mapRef.current) mapRef.current.flyTo(loc, 13); setIsLocating(false) }, function () { setIsLocating(false) }) }
  }

  function handleRetry() { loadStations() }
  function handleViewportChange() { if (debounceTimer.current) clearTimeout(debounceTimer.current); debounceTimer.current = setTimeout(function () { loadStations() }, 800) }

  async function searchLocation() {
    if (!locationQuery.trim()) return; var data = await searchLocations(locationQuery, 1)
    if (data && data.length > 0) { var lat = parseFloat(data[0].lat), lng = parseFloat(data[0].lon); if (!isNaN(lat) && !isNaN(lng)) { setUserLocation([lat, lng]); loadStations(); if (mapRef.current) mapRef.current.flyTo([lat, lng], 12) } }
  }

  async function suggestSearch(query) {
    if (!query.trim()) { setSearchSuggestions([]); setShowSearchSuggestions(false); return }
    var [locData, stationData] = await Promise.all([
      searchLocations(query, 5),
      searchStations(query).then(function (r) { return r.data || [] }).catch(function () { return [] }),
    ])
    var locResults = (locData || []).map(function (item) { return { _type: 'location', display_name: item.display_name, lat: item.lat, lon: item.lon } })
    var stationResults = stationData.map(function (s) { return { _type: 'station', display_name: s.name + (s.address ? ' — ' + s.address : ''), lat: s.latitude, lng: s.longitude, station: s } })
    var merged = locResults.concat(stationResults).slice(0, 8)
    setSearchSuggestions(merged); setShowSearchSuggestions(merged.length > 0)
  }

  function handleLocationInput(value) { setLocationQuery(value); if (searchTimer.current) clearTimeout(searchTimer.current); searchTimer.current = setTimeout(function () { suggestSearch(value) }, 400) }

  function selectSearchSuggestion(s) {
    setLocationQuery(s.display_name); setShowSearchSuggestions(false)
    if (s._type === 'station') {
      var lat = parseFloat(s.lat), lng = parseFloat(s.lng)
      if (!isNaN(lat) && !isNaN(lng)) { setUserLocation([lat, lng]); if (mapRef.current) mapRef.current.flyTo([lat, lng], 15) }
    } else {
      var lat = parseFloat(s.lat), lng = parseFloat(s.lon)
      if (!isNaN(lat) && !isNaN(lng)) { setUserLocation([lat, lng]); loadStations(); if (mapRef.current) mapRef.current.flyTo([lat, lng], 12) }
    }
  }
  function handleLocationKeyDown(e) { if (e.key === 'Enter') searchLocation() }

  var filteredStations = useMemo(function () {
    return stations.filter(function (station) {
      var passesStatus = true
      if (statusFilter === 'available') passesStatus = station.slots && station.slots.some(function (s) { return s.status === 'AVAILABLE' })
      else if (statusFilter === 'occupied') passesStatus = station.slots && station.slots.some(function (s) { return s.status === 'OCCUPIED' })
      var passesSlotType = true
      if (slotTypeFilter.length > 0 && station.slots) { passesSlotType = station.slots.some(function (s) { return slotTypeFilter.indexOf(s.slot_type) !== -1 }) }
      return passesStatus && passesSlotType
    })
  }, [stations, statusFilter, slotTypeFilter])

  var routeCoordsForPolyline = (function () {
    if (!routePlan) return null; var wg = routePlan.waypointGeometry || (routePlan.backendPlan && routePlan.backendPlan.waypoint_geometry)
    return wg && wg.length > 1 ? wg : (routePlan.route && routePlan.route.length > 1 ? routePlan.route : null)
  })()

  var filterCount = (statusFilter !== 'all' ? 1 : 0) + slotTypeFilter.length

  return (
    <div className="h-full w-full relative">
      {isError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-red-600/90 backdrop-blur-md text-white px-4 py-2.5 rounded-xl shadow-lg border border-red-400/50 flex items-center gap-3 max-w-md">
          <span className="text-sm">{errorMessage || 'Something went wrong'}</span>
          <button onClick={handleRetry} className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium transition-colors shrink-0 flex items-center gap-1"><FiRefreshCw className="w-3 h-3" /> Retry</button>
        </div>
      )}

      <div className="absolute top-4 left-4 right-4 z-[1000] flex items-start gap-2 pointer-events-none">
        <div className="flex-1 max-w-xl mx-auto relative pointer-events-auto">
          <div className="flex items-center bg-gray-900/90 backdrop-blur-md border border-gray-700 rounded-xl px-3 py-2.5 shadow-lg">
            <FiSearch className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
            <input type="text" placeholder="Search destination or location..." value={locationQuery}
              onChange={function (e) { handleLocationInput(e.target.value) }} onKeyDown={handleLocationKeyDown}
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder-gray-500" />
            <button onClick={searchLocation} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors shrink-0 ml-2">Go</button>
          </div>
          {showSearchSuggestions && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 max-h-40 overflow-y-auto">
              {searchSuggestions.map(function (s, i) {
                return <button key={i} onClick={function () { selectSearchSuggestion(s) }}
                  className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 border-b border-gray-700/50 last:border-0 flex items-center gap-2 truncate">
                  <span className={'shrink-0 text-[10px] font-medium px-1 py-0.5 rounded ' + (s._type === 'station' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-blue-900/30 text-blue-400')}>{s._type === 'station' ? 'Station' : 'Location'}</span>
                  <span className="truncate">{s.display_name}</span>
                </button>
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button onClick={findMyLocation} className={'bg-gray-900/90 backdrop-blur-md border rounded-xl p-2.5 shadow-lg hover:bg-gray-800 transition-all ' + (isLocating ? 'border-emerald-400 ring-2 ring-emerald-400/50' : 'border-gray-700')} title={isLocating ? 'Locating...' : 'My location'}>
            <FiCrosshair className={'w-4 h-4 transition-colors ' + (isLocating ? 'text-emerald-300' : 'text-emerald-400') + (isLocating ? ' animate-pulse' : '')} />
          </button>
          <div ref={filterRef} className="relative">
            <button onClick={function () { setShowFilterPanel(!showFilterPanel); setShowUserMenu(false) }}
              className={'bg-gray-900/90 backdrop-blur-md border rounded-xl p-2.5 shadow-lg hover:bg-gray-800 transition-colors ' + (filterCount > 0 ? 'border-emerald-600' : 'border-gray-700')} title="Filters">
              <FiFilter className={'w-4 h-4 ' + (filterCount > 0 ? 'text-emerald-400' : 'text-gray-400')} />
            </button>
            {showFilterPanel && (
              <div className="absolute top-full right-0 mt-1 w-64 bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="px-3 py-2.5 border-b border-gray-800">
                  <span className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">Status</span>
                </div>
                <div className="px-3 py-2 flex gap-1.5">
                  {['all', 'available', 'occupied'].map(function (opt) {
                    var active = statusFilter === opt
                    return <button key={opt} onClick={function () { setStatusFilter(opt) }}
                      className={'px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-all ' + (active ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700')}>{opt === 'all' ? 'All' : opt === 'available' ? 'Free' : 'Busy'}</button>
                  })}
                </div>
                <div className="px-3 py-2 border-t border-gray-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">Charger Type</span>
                    {slotTypeFilter.length > 0 && <button onClick={function () { setSlotTypeFilter([]) }} className="text-[10px] text-gray-500 hover:text-gray-300">Clear</button>}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {[{ id: 'AC_SLOW', label: 'AC Slow' }, { id: 'AC_FAST', label: 'AC Fast' }, { id: 'DC_FAST', label: 'DC Fast' }, { id: 'DC_ULTRA', label: 'DC Ultra' }].map(function (t) {
                      var active = slotTypeFilter.indexOf(t.id) !== -1
                      return <button key={t.id} onClick={function () { setSlotTypeFilter(active ? slotTypeFilter.filter(function (x) { return x !== t.id }) : slotTypeFilter.concat([t.id])) }}
                        className={'px-2 py-1 text-[10px] font-medium rounded-lg transition-all ' + (active ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700')}>{t.label}</button>
                    })}
                  </div>
              </div>
            </div>
          )}
          </div>
          <button onClick={function () { navigate('/trips') }}
            className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl px-3 py-2.5 shadow-lg hover:from-emerald-600 hover:to-emerald-700 transition-all flex items-center gap-1.5 text-xs font-medium" title="Plan a Trip">
            <FiMap className="w-4 h-4" />
            <span className="hidden sm:inline">Plan Trip</span>
          </button>
          <div ref={userMenuRef} className="relative">
            {user ? (
              <>
                <button onClick={function () { setShowUserMenu(!showUserMenu); setShowFilterPanel(false) }}
                  className="w-8 h-8 rounded-xl bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center shadow-lg transition-colors" title={user.username || user.email || 'User'}>
                  <span className="text-white text-xs font-bold">{(user.username || user.email || 'U')[0].toUpperCase()}</span>
                </button>
                {showUserMenu && (
                  <div className="absolute top-full right-0 mt-1 w-48 bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="px-3 py-2.5 border-b border-gray-800"><div className="text-xs font-semibold text-white truncate">{user.username || 'User'}</div><div className="text-[10px] text-gray-500 truncate">{user.email || ''}</div></div>
                    <button onClick={function () { logoutUser(); window.location.href = '/login' }} className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors">Sign Out</button>
                  </div>
                )}
              </>
            ) : (
              <a href="/login" className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-xl shadow-lg transition-colors">Login</a>
            )}
          </div>
        </div>
      </div>

      <MapContainer center={userLocation} zoom={5} minZoom={5} maxBounds={[[-90, -180], [90, 180]]} maxBoundsViscosity={1.0} worldCopyJump={false} preferCanvas={true} className="h-full w-full" ref={mapRef}>
        <LayersControl position="bottomright">
          <LayersControl.BaseLayer checked name="Roadmap">
            <TileLayer attribution='&copy; <a href="https://openstreetmap.org/copyright">OSM</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer attribution='&copy; <a href="https://esa.int">ESA</a>' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}.png" />
          </LayersControl.BaseLayer>
        </LayersControl>
        <MapInitLoader />
        <FitBoundsOnRoute routePlan={routePlan} />
        <ViewportWatcher onViewportChange={handleViewportChange} />
        {routeCoordsForPolyline && <Polyline positions={routeCoordsForPolyline} pathOptions={{ color: '#10b981', weight: 4, opacity: 0.8 }} />}
        {routePlan && routePlan.origin && <Marker position={[routePlan.origin.lat, routePlan.origin.lng]} icon={createRouteMarkerIcon('#10b981', 'S')} />}
        {routePlan && routePlan.destination && <Marker position={[routePlan.destination.lat, routePlan.destination.lng]} icon={createRouteMarkerIcon('#ef4444', 'E')} />}
        {routePlan && routePlan.stops && routePlan.stops.map(function (stop, i) {
          var stopLat = stop.projected_lat || stop.lat
          var stopLng = stop.projected_lng || stop.lng
          if (!stopLat || !stopLng) return null
          return <Marker key={'stop-' + i} position={[stopLat, stopLng]} icon={createStopIcon(i + 1)}>
            <Popup><div className="min-w-[200px]">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-1">{stop.station_name || stop.name || 'Charging Stop'}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{stop.address || ''}</p>
              {stop.arrival_soc_percent != null && <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 mb-1.5">
                <span className="bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded text-amber-600 dark:text-amber-400 font-medium">Arrive {stop.arrival_soc_percent}%</span>
                <FiArrowRight className="w-2.5 h-2.5" />
                <span className="bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded text-emerald-600 dark:text-emerald-400 font-medium">Depart {stop.departure_soc_percent}%</span>
              </div>}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400 mb-2">
                {stop.charger_power_kw != null && <span className="flex items-center gap-1"><FiZap className="w-3 h-3 text-amber-400" />{stop.charger_power_kw} kW</span>}
                {stop.slot_type && <span className="flex items-center gap-1"><FiInfo className="w-3 h-3 text-blue-400" />{stop.slot_type === 'DC_ULTRA' ? 'DC Ultra' : stop.slot_type === 'DC_FAST' ? 'DC Fast' : stop.slot_type === 'AC_FAST' ? 'AC Fast' : stop.slot_type}</span>}
                {stop.charge_time_seconds && <span className="flex items-center gap-1"><FiClock className="w-3 h-3 text-amber-400" />{formatDuration(stop.charge_time_seconds)}</span>}
                {stop.cost != null && <span className="flex items-center gap-1"><FiDollarSign className="w-3 h-3 text-emerald-400" />{'\u20B9' + Math.round(stop.cost).toLocaleString('en-IN')}</span>}
              </div>
              {stop.charge_kwh != null && <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1.5">Energy: {stop.charge_kwh.toFixed(1)} kWh</p>}
              <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mb-2">Charging stop #{i + 1}</div>
              <div className="flex gap-1.5">
                <button onClick={function () { navigate('/stations/' + stop.station_id + '?book=true') }} className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1"><FiBookOpen className="w-3 h-3" /> Book Now</button>
                <button onClick={function () { navigate('/stations/' + stop.station_id) }} className="flex-1 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1"><FiExternalLink className="w-3 h-3" /> Details</button>
              </div>
            </div></Popup>
          </Marker>
        })}
        <MarkerClusterGroup chunkedLoading maxClusterRadius={90} showCoverageOnHover={false} disableClusteringAtZoom={14}>
          {filteredStations.map(function (station) {
            var lat = station.latitude, lng = station.longitude; if (!lat || !lng) return null
            var rawStatus = (station.status || '').toUpperCase()
            var mStatus = rawStatus === 'ACTIVE' || rawStatus === 'AVAILABLE' ? 'ACTIVE' : rawStatus === 'MAINTENANCE' ? 'MAINTENANCE' : 'INACTIVE'
            return <Marker key={station.id} position={[lat, lng]} icon={createStationIcon(mStatus, false)}>
              <Popup><div className="min-w-[220px]">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className={'w-2 h-2 rounded-full shrink-0 ' + (mStatus === 'ACTIVE' ? 'bg-emerald-500' : mStatus === 'MAINTENANCE' ? 'bg-amber-500' : 'bg-gray-400')} />
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-white">{station.name}</h3>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 leading-relaxed">{station.address}</p>
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {station.slots && station.slots.slice(0, 3).map(function (s, si) {
                    var connColors = { DC_ULTRA: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400', DC_FAST: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400', AC_FAST: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400', AC_SLOW: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' }
                    var cls = connColors[s.slot_type] || 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    return <span key={si} className={'text-[10px] font-medium px-1.5 py-0.5 rounded ' + cls}>{s.slot_type === 'DC_ULTRA' ? 'DC Ultra' : s.slot_type === 'DC_FAST' ? 'DC Fast' : s.slot_type === 'AC_FAST' ? 'AC Fast' : s.slot_type === 'AC_SLOW' ? 'AC Slow' : s.slot_type} {s.power_kw ? '(' + s.power_kw + 'kW)' : ''}</span>
                  })}
                  {station.slots && station.slots.length > 3 && <span className="text-[10px] text-gray-400 dark:text-gray-500">+{station.slots.length - 3} more</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-2.5">
                  <span className="flex items-center gap-1"><FiZap className="w-3 h-3" />{station.slots ? station.slots.filter(function (s) { return s.status === 'AVAILABLE' || s.status === 'AVAILABLE' }).length : 0} free</span>
                </div>
                <button onClick={function () { navigate('/stations/' + station.id + '?book=true') }} className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1"><FiBookOpen className="w-3 h-3" /> Book Now</button>
              </div></Popup>
            </Marker>
          })}
        </MarkerClusterGroup>
      </MapContainer>

      {isLoading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-gray-900/90 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-lg border border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-400"><div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-emerald-500 border-t-transparent" />Loading stations...</div>
        </div>
      )}

      {!isLoading && stations.length > 0 && !isError && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000]">
          <div className="bg-gray-900/90 backdrop-blur-md px-4 py-2 rounded-xl shadow-lg border border-gray-800 text-xs text-gray-400 flex items-center gap-3">
            <span>{filteredStations.length} of {stations.length} stations</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Active</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Maint</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-500" /> Off</span>
          </div>
        </div>
      )}

      {routePlan && !showRoutePopup && (
        <div className="absolute top-20 left-4 z-[1000]">
          <button onClick={function () { setShowRoutePopup(true) }}
            className="bg-gray-900/90 backdrop-blur-md border border-emerald-600/50 rounded-xl px-4 py-2.5 shadow-lg hover:bg-gray-800 transition-colors flex items-center gap-2">
            <FiInfo className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-medium text-white">Route Details</span>
          </button>
        </div>
      )}

      {showRoutePopup && routePlan && (
        <div className="absolute inset-0 z-[2000] flex items-start justify-center pt-12 pointer-events-none">
          <div className="bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto mx-4 pointer-events-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h3 className="text-sm font-bold text-white">Trip Route</h3>
              <button onClick={function () { setShowRoutePopup(false) }} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-800 text-gray-400 transition-colors"><FiX className="w-4 h-4" /></button>
            </div>
            {vehicle && (
              <div className="px-5 py-2 border-b border-gray-800 flex items-center gap-2">
                <FiZap className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-gray-400">Vehicle:</span>
                <span className="text-xs font-medium text-white">{vehicle.make} {vehicle.model}</span>
              </div>
            )}
            <div className="px-5 py-3 border-b border-gray-800">
              <div className="flex items-center gap-2 text-sm">
                <div className="flex items-center gap-1.5 text-emerald-400 max-w-[40%] truncate"><div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /><span className="truncate">{routePlan.originName || 'Origin'}</span></div>
                <FiArrowRight className="w-4 h-4 text-gray-500 shrink-0" />
                <div className="flex items-center gap-1.5 text-red-400 max-w-[40%] truncate"><div className="w-2 h-2 rounded-full bg-red-500 shrink-0" /><span className="truncate">{routePlan.destName || 'Destination'}</span></div>
              </div>
            </div>
            <div className="px-5 py-3 border-b border-gray-800 space-y-2">
              <div className="flex items-center justify-between text-xs"><span className="text-gray-500">Total Distance</span><span className="font-semibold text-white">{(routePlan.distance / 1000).toFixed(1)} km</span></div>
              <div className="flex items-center justify-between text-xs"><span className="text-gray-500">Driving Time</span><span className="font-semibold text-white"><FiClock className="w-3 h-3 inline mr-1 text-emerald-400" />{formatDuration(routePlan.duration)}</span></div>
              {bp && <>
                <div className="flex items-center justify-between text-xs"><span className="text-gray-500">Charging Stops</span><span className="font-semibold text-amber-400"><FiZap className="w-3 h-3 inline mr-1" />{bp.stops ? bp.stops.length : 0}</span></div>
                {bp.total_charge_time_seconds > 0 && <div className="flex items-center justify-between text-xs"><span className="text-gray-500">Charge Time</span><span className="font-semibold text-amber-400">{formatDuration(bp.total_charge_time_seconds)}</span></div>}
                {bp.total_cost > 0 && <div className="flex items-center justify-between text-xs"><span className="text-gray-500">Total Cost</span><span className="font-semibold text-emerald-400"><FiDollarSign className="w-3 h-3 inline mr-0.5" />{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(bp.total_cost)}</span></div>}
              </>}
            </div>
            {bp && bp.stops && bp.stops.length > 0 && (
              <div className="px-5 py-3 space-y-2">
                <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Charging Stops</h4>
                {bp.stops.map(function (stop, i) {
                  return <div key={i} className="flex items-center gap-2.5 bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2.5">
                    <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0"><span className="text-[10px] font-bold text-amber-400">{i + 1}</span></div>
                    <div className="flex-1 min-w-0"><div className="text-xs font-medium text-white truncate">{stop.station_name || 'Station ' + (i + 1)}</div><div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5"><span>Arrive {stop.arrival_soc_percent}%</span><FiArrowRight className="w-2.5 h-2.5" /><span className="text-emerald-400">{formatDuration(stop.charge_time_seconds)}</span></div></div>
                    <span className="text-[11px] font-medium text-emerald-400 whitespace-nowrap">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(stop.cost)}</span>
                  </div>
                })}
              </div>
            )}
            {bp && bp.stops && bp.stops.length === 0 && (
              <div className="px-5 py-4 text-center"><FiBatteryCharging className="w-5 h-5 text-emerald-400 mx-auto mb-1" /><p className="text-xs text-emerald-400">No charging stops needed!</p></div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .leaflet-control-zoom { border: 1px solid #374151 !important; border-radius: 12px !important; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.4) !important; }
        .leaflet-control-zoom a { background: rgba(17, 24, 39, 0.95) !important; color: #9ca3af !important; border-bottom: 1px solid #374151 !important; width: 36px !important; height: 36px !important; line-height: 36px !important; font-size: 18px !important; transition: background 0.15s, color 0.15s !important; }
        .leaflet-control-zoom a:hover { background: rgba(31, 41, 55, 0.95) !important; color: #10b981 !important; }
        .leaflet-control-zoom a.leaflet-disabled { color: #4b5563 !important; }
        .leaflet-control-container .leaflet-top.leaflet-left { top: auto !important; bottom: 20px !important; left: 12px !important; }
        .leaflet-popup-content-wrapper { background: #1f2937 !important; color: #f3f4f6 !important; border-radius: 12px !important; box-shadow: 0 8px 24px rgba(0,0,0,0.5) !important; }
        .leaflet-popup-tip { background: #1f2937 !important; }
        .leaflet-popup-close-button { color: #9ca3af !important; }
        .leaflet-popup-close-button:hover { color: #10b981 !important; }
      `}</style>
    </div>
  )
}
