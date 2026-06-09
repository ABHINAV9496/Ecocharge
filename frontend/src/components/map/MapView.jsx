/*
  Map View
  --------
  The main map page showing all charging stations on an interactive Leaflet map.

  How it works:
  1. When the page loads, it tries to get the user's location (GPS)
  2. Then it fetches all charging stations near that location from the backend
  3. Each station is shown as a colored marker on the map
  4. Green marker = has available slots, Orange = maintenance, Gray = inactive
  5. User can click a marker to see station details in the sidebar
  6. User can filter by radius (5/10/25/50 km) or by availability
  7. Live WebSocket updates change marker colors in real-time

  What-If Simulator is also available in the Trip Planner page.
*/

import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { FiSearch, FiCrosshair, FiBatteryCharging, FiMapPin, FiSliders } from 'react-icons/fi'
import { getStations } from '../../api/stations'
import { useWebSocket } from '../../context/WebSocketContext'
import { useAuth } from '../../context/AuthContext'
import StationSidebar from './StationSidebar'
import 'leaflet/dist/leaflet.css'

// ----------------------------------------------------------------
// SETUP: Leaflet marker icons (fix missing default icons)
// ----------------------------------------------------------------
delete L.Icon.Default.prototype._getIconUrl

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ----------------------------------------------------------------
// HELPER: Create a custom marker icon based on station status
// ----------------------------------------------------------------
function createStationIcon(statusCode, isSelected) {
  // Different colors for different station statuses
  var colorMap = {
    ACTIVE: '#22c55e',       // Green - has available slots
    INACTIVE: '#6b7280',     // Gray - no slots at all
    MAINTENANCE: '#f59e0b',  // Orange - under maintenance
  }

  var markerColor = colorMap[statusCode] || '#3b82f6'
  var markerSize = isSelected ? 36 : 30

  // Create a custom HTML marker using a div (not the default marker icon)
  var html = `
    <div style="
      width: ${markerSize}px;
      height: ${markerSize}px;
      background: white;
      border: 3px solid ${markerColor};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 0 ${isSelected ? '8px' : '0px'} rgba(34,197,94,0.15);
      transition: all 0.2s;
    ">
      <div style="
        width: 10px;
        height: 10px;
        background: ${markerColor};
        border-radius: 50%;
      "></div>
    </div>
  `

  return L.divIcon({
    html: html,
    className: '',           // Remove default Leaflet styles
    iconSize: [markerSize, markerSize],
    iconAnchor: [markerSize / 2, markerSize / 2],
  })
}

// ----------------------------------------------------------------
// COMPONENT: Handles finding the user's location on the map
// ----------------------------------------------------------------
function LocationFinder(props) {
  var onLocationFound = props.onLocationFound

  useMapEvents({
    locationfound: function (event) {
      var lat = event.latlng.lat
      var lng = event.latlng.lng
      onLocationFound([lat, lng])
      event.target.flyTo(event.latlng, 13)
    },
  })

  return null  // This component doesn't render anything visually
}

// ----------------------------------------------------------------
// MAIN COMPONENT: Map View
// ----------------------------------------------------------------
export default function MapView() {
  // ---- STATE ----
  var [stations, setStations] = useState([])
  var [selectedStation, setSelectedStation] = useState(null)
  var [userLocation, setUserLocation] = useState([9.9312, 76.2673])  // Default: Kochi
  var [searchRadius, setSearchRadius] = useState(10)  // km
  var [searchQuery, setSearchQuery] = useState('')
  var [isLoading, setIsLoading] = useState(true)
  var [statusFilter, setStatusFilter] = useState('all')  // 'all', 'available', 'occupied'
  var [bookingMessage, setBookingMessage] = useState(null)

  var { statuses: liveStatuses } = useWebSocket()
  var { user } = useAuth()
  var mapRef = useRef(null)

  // ---- FETCH STATIONS FROM BACKEND ----
  // This function calls the Django API to get charging stations
  // If lat/lng is provided, it filters by radius
  async function loadStations(lat, lng, radiusKm) {
    setIsLoading(true)

    try {
      var params = {}

      // Only add location params if we have coordinates
      if (lat && lng) {
        params.lat = lat
        params.lng = lng
        params.radius = radiusKm
      }

      var response = await getStations(params)
      var stationData = response.data
      setStations(stationData)

    } catch (error) {
      console.error('Failed to load charging stations:', error)
      alert('Could not load stations. Make sure the backend server is running.')
    } finally {
      setIsLoading(false)
    }
  }

  // Load stations when the search radius changes or user moves
  useEffect(function () {
    loadStations(userLocation[0], userLocation[1], searchRadius)
  }, [searchRadius, userLocation])

  // On first load, try to get the user's GPS location
  useEffect(function () {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        function (position) {
          var currentLat = position.coords.latitude
          var currentLng = position.coords.longitude
          setUserLocation([currentLat, currentLng])
          loadStations(currentLat, currentLng, searchRadius)
        },
        function (error) {
          console.warn('Could not get GPS location:', error.message)
          // Fall back to default location (Kochi)
          loadStations(userLocation[0], userLocation[1], searchRadius)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
        }
      )
    }
  }, [])

  // ---- EVENT HANDLERS ----

  // Called after a successful booking
  function handleBookingSuccess(message) {
    setBookingMessage(message)
    // Clear the success message after 3 seconds
    setTimeout(function () {
      setBookingMessage(null)
    }, 3000)
    // Refresh the stations to show updated slot statuses
    loadStations(userLocation[0], userLocation[1], searchRadius)
  }

  // Find my location using GPS
  function findMyLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function (position) {
        var currentLat = position.coords.latitude
        var currentLng = position.coords.longitude
        setUserLocation([currentLat, currentLng])

        // Fly the map to the user's location
        if (mapRef.current) {
          mapRef.current.flyTo([currentLat, currentLng], 13)
        }
      })
    }
  }

  // ---- FILTER STATIONS ----
  // Step 1: Filter by availability status
  function filterByStatus(station) {
    if (statusFilter === 'available') {
      return station.slots && station.slots.some(function (slot) {
        return slot.status === 'AVAILABLE'
      })
    }
    if (statusFilter === 'occupied') {
      return station.slots && station.slots.some(function (slot) {
        return slot.status === 'OCCUPIED'
      })
    }
    return true  // 'all' filter
  }

  // Step 2: Filter by search text (name or address)
  function filterBySearch(station) {
    if (!searchQuery) return true

    var searchText = searchQuery.toLowerCase()
    var stationName = (station.name || '').toLowerCase()
    var stationAddress = (station.address || '').toLowerCase()

    return stationName.indexOf(searchText) !== -1 ||
           stationAddress.indexOf(searchText) !== -1
  }

  // Apply both filters
  var visibleStations = stations.filter(function (station) {
    return filterByStatus(station) && filterBySearch(station)
  })

  // ---- RENDER ----
  return (
    <div className="flex h-[calc(100vh-4rem)]">

      {/* LEFT SIDE: Map */}
      <div className="flex-1 relative">

        {/* Success message toast */}
        {bookingMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg animate-fadeIn backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <FiBatteryCharging className="w-4 h-4" />
              {bookingMessage}
            </div>
          </div>
        )}

        {/* TOP CONTROLS: Search + Filters (glass-morphism overlay) */}
        <div className="absolute top-4 left-4 right-4 z-[1000] flex items-center gap-2 max-w-2xl">
          {/* Search bar */}
          <div className="flex-1 flex items-center bg-white/90 dark:bg-gray-900/90 backdrop-blur-md rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 px-4 py-2.5">
            <FiSearch className="w-4 h-4 text-gray-400 mr-3 shrink-0" />
            <input
              type="text"
              placeholder="Search stations by name or address..."
              value={searchQuery}
              onChange={function (e) { setSearchQuery(e.target.value) }}
              className="flex-1 bg-transparent outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>

          {/* Radius selector */}
          <select
            value={searchRadius}
            onChange={function (e) { setSearchRadius(Number(e.target.value)) }}
            className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 outline-none shadow-lg"
          >
            <option value={5}>5 km</option>
            <option value={10}>10 km</option>
            <option value={25}>25 km</option>
            <option value={50}>50 km</option>
          </select>

          {/* Availability filter chips */}
          <div className="flex gap-1">
            {['all', 'available', 'occupied'].map(function (filterOption) {
              var isActive = statusFilter === filterOption
              return (
                <button
                  key={filterOption}
                  onClick={function () { setStatusFilter(filterOption) }}
                  className={`
                    px-3 py-2 text-xs font-medium rounded-xl transition-all
                    ${isActive
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                      : 'bg-white/90 dark:bg-gray-900/90 backdrop-blur-md text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }
                  `}
                >
                  {filterOption === 'all' ? 'All' :
                   filterOption === 'available' ? 'Available' : 'Occupied'}
                </button>
              )
            })}
          </div>

          {/* Locate me button */}
          <button
            onClick={findMyLocation}
            className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 shadow-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Find my location"
          >
            <FiCrosshair className="w-5 h-5 text-emerald-500" />
          </button>
        </div>

        {/* THE MAP */}
        <MapContainer
          center={userLocation}
          zoom={12}
          className="h-full w-full z-0"
          ref={mapRef}
        >
          {/* OpenStreetMap tiles */}
          <TileLayer
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* GPS location finder */}
          <LocationFinder onLocationFound={function (loc) { setUserLocation(loc) }} />

          {/* Station markers */}
          {visibleStations.map(function (station) {
            var lat = station.latitude
            var lng = station.longitude

            // Skip stations without valid coordinates
            if (!lat || !lng) return null

            // Calculate availability stats for this station
            var availableSlots = 0
            if (station.slots) {
              availableSlots = station.slots.filter(function (s) {
                return s.status === 'AVAILABLE'
              }).length
            }
            var totalSlots = station.slots ? station.slots.length : 0

            // Determine the marker color based on availability
            var markerStatus
            if (availableSlots > 0) {
              markerStatus = 'ACTIVE'
            } else if (totalSlots > 0) {
              markerStatus = 'MAINTENANCE'
            } else {
              markerStatus = 'INACTIVE'
            }

            var isSelected = selectedStation && selectedStation.id === station.id

            return (
              <Marker
                key={station.id}
                position={[lat, lng]}
                icon={createStationIcon(markerStatus, isSelected)}
              >
                <Popup>
                  <div className="min-w-[220px]">
                    <h3 className="font-semibold text-base text-gray-900 dark:text-white">
                      {station.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {station.address}
                    </p>
                    <div className="flex items-center gap-2 mt-3 mb-2">
                      <FiMapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium">
                        {availableSlots > 0 ? (
                          <span className="text-emerald-600">{availableSlots}/{totalSlots} Available</span>
                        ) : (
                          <span className="text-red-500">No slots available</span>
                        )}
                      </span>
                    </div>
                    <button
                      onClick={function () { setSelectedStation(station) }}
                      className="w-full py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-medium rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/20"
                    >
                      View Details
                    </button>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>

        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 dark:bg-gray-900/90 backdrop-blur-md px-5 py-2.5 rounded-xl shadow-lg text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2.5 border border-gray-200 dark:border-gray-700">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-emerald-500 border-t-transparent" />
            Loading stations...
          </div>
        )}

        {/* Station count badge */}
        {!isLoading && stations.length > 0 && (
          <div className="absolute bottom-6 left-4 z-[1000] bg-white/90 dark:bg-gray-900/90 backdrop-blur-md px-4 py-2 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
            {visibleStations.length} station{visibleStations.length !== 1 ? 's' : ''} found
            {visibleStations.length !== stations.length
              ? ' (filtered from ' + stations.length + ')'
              : ''}
          </div>
        )}
      </div>

      {/* RIGHT SIDE: Station Details Sidebar */}
      {selectedStation && (
        <StationSidebar
          station={selectedStation}
          onClose={function () { setSelectedStation(null) }}
          onBookSuccess={handleBookingSuccess}
          statuses={liveStatuses}
          user={user}
        />
      )}
    </div>
  )
}
