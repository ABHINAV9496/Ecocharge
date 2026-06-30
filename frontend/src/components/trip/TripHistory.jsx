import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiCalendar, FiNavigation, FiBatteryCharging, FiDollarSign, FiTrash2, FiMap, FiClock, FiZap } from 'react-icons/fi'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { getTrips, deleteTrip } from '../../api/trips'
import { useToast } from '../../context/ToastContext'

export default function TripHistory(props) {
  var showToast = useToast()
  var navigate = useNavigate()
  var [trips, setTrips] = useState([])
  var [isLoading, setIsLoading] = useState(true)
  var [error, setError] = useState('')

  useEffect(function () {
    loadTrips()
  }, [])

  useEffect(function () {
    if (!isLoading && props.highlightId && trips.length > 0) {
      var el = document.getElementById('trip-' + props.highlightId)
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('ring-2', 'ring-emerald-500', 'ring-offset-2', 'dark:ring-offset-gray-950'); setTimeout(function () { el.classList.remove('ring-2', 'ring-emerald-500', 'ring-offset-2', 'dark:ring-offset-gray-950') }, 3000) }
    }
  }, [isLoading, trips, props.highlightId])

  async function loadTrips() {
    setIsLoading(true)
    try {
      var res = await getTrips()
      setTrips(res.data || [])
    } catch (e) {
      console.error('Failed to load trips:', e)
      setError('Could not load trip history.')
    }
    setIsLoading(false)
  }

  async function handleDeleteTrip(id) {
    if (!window.confirm('Are you sure you want to delete this trip?')) return
    try {
      await deleteTrip(id)
      setTrips(trips.filter(function (t) { return t.id !== id }))
      showToast('Trip deleted successfully', 'success')
    } catch (e) {
      console.error('Failed to delete trip:', e)
      showToast('Could not delete trip', 'error')
    }
  }

  var stats = {
    total: trips.length,
    totalDistance: trips.reduce(function (sum, t) { return sum + t.distance_km }, 0),
    totalCost: trips.reduce(function (sum, t) { return sum + parseFloat(t.total_cost || 0) }, 0),
  }

  function truncate(text, max) {
    if (!text) return ''
    return text.length > max ? text.slice(0, max) + '…' : text
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-500 border-t-transparent" /></div>
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center">
          <FiCalendar className="w-5 h-5 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trip History</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">View your past planned trips</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl">{error}</div>
      )}

      {trips.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Trips</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.total}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Distance</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.totalDistance.toFixed(0)} km</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Cost</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(stats.totalCost)}</p>
          </div>
        </div>
      )}

      {trips.length === 0 && !error ? (
        <div className="text-center py-16">
          <FiNavigation className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-500 dark:text-gray-400">No trips yet</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Plan a trip using the Trip Planner and it will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {trips.map(function (trip) {
            var durationHrs = trip.duration_minutes ? Math.floor(trip.duration_minutes / 60) + 'h ' + Math.round(trip.duration_minutes % 60) + 'm' : null
            return (
              <div id={'trip-' + trip.id} key={trip.id} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2.5">
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <FiCalendar className="w-3.5 h-3.5" />
                    {formatDate(trip.created_at)}
                    {durationHrs && <><span className="text-gray-300 dark:text-gray-600">|</span><FiClock className="w-3 h-3" />{durationHrs}</>}
                  </div>
                  <button onClick={function () { handleDeleteTrip(trip.id) }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all" title="Delete trip">
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-6 h-6 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg flex items-center justify-center shrink-0"><FiNavigation className="w-3 h-3 text-emerald-500" /></div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white min-w-0">
                    <span className="text-emerald-600 dark:text-emerald-400" title={trip.origin}>{truncate(trip.origin, 27)}</span>
                    <span className="text-gray-400 mx-1">→</span>
                    <span className="text-red-600 dark:text-red-400" title={trip.destination}>{truncate(trip.destination, 27)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-2.5">
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl px-2.5 py-2 text-center">
                    <div className="text-[10px] text-gray-400 dark:text-gray-500">Distance</div>
                    <div className="text-xs font-semibold text-gray-900 dark:text-white">{trip.distance_km ? trip.distance_km.toFixed(1) : '-'} km</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl px-2.5 py-2 text-center">
                    <div className="text-[10px] text-gray-400 dark:text-gray-500">Battery</div>
                    <div className="text-xs font-semibold text-gray-900 dark:text-white">{trip.battery_start_percent || '?'}% → {trip.battery_end_percent || '?'}%</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl px-2.5 py-2 text-center">
                    <div className="text-[10px] text-gray-400 dark:text-gray-500">Cost</div>
                    <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(trip.total_cost)}</div>
                  </div>
                </div>

                <div className="flex gap-1.5">
                  <button onClick={function () {
                    if (trip.route_geometry && trip.route_geometry.length > 0) {
                      navigate('/map', { state: { routePlan: { route: trip.route_geometry, originName: trip.origin, destName: trip.destination, origin: { lat: trip.origin_lat, lng: trip.origin_lng }, destination: { lat: trip.dest_lat, lng: trip.dest_lng }, distance: (trip.distance_km || 0) * 1000, duration: (trip.duration_minutes || 0) * 60 } } })
                    } else {
                      navigate('/map', { state: { tripId: trip.id } })
                    }
                  }} className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-medium rounded-lg transition-all flex items-center justify-center gap-1"><FiMap className="w-3 h-3" /> View on Map</button>
                  <button onClick={function () { navigate('/trips', { state: { tripId: trip.id } }) }} className="flex-1 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-[11px] font-medium rounded-lg transition-all flex items-center justify-center gap-1"><FiZap className="w-3 h-3" /> Details</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
