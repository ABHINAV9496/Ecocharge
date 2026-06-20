import { useState, useEffect } from 'react'
import { FiCalendar, FiNavigation, FiBatteryCharging, FiDollarSign, FiTrash2 } from 'react-icons/fi'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { getTrips, deleteTrip } from '../../api/trips'
import { useToast } from '../../context/ToastContext'

export default function TripHistory() {
  var showToast = useToast()
  var [trips, setTrips] = useState([])
  var [isLoading, setIsLoading] = useState(true)
  var [error, setError] = useState('')

  useEffect(function () {
    loadTrips()
  }, [])

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
            return (
              <div key={trip.id} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <FiCalendar className="w-3.5 h-3.5" />
                    {formatDate(trip.created_at)}
                  </div>
                  <button onClick={function () { handleDeleteTrip(trip.id) }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all" title="Delete trip">
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg flex items-center justify-center shrink-0"><FiNavigation className="w-3 h-3 text-emerald-500" /></div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white" title={trip.origin + ' → ' + trip.destination}>
                    {truncate(trip.origin, 30)} → {truncate(trip.destination, 30)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-xl px-3 py-2">
                  <span className="font-medium">{trip.distance_km ? trip.distance_km.toFixed(1) : '-'} km</span>
                  <span className="flex items-center gap-1"><FiBatteryCharging className="w-3 h-3" />{trip.battery_start_percent}% → {trip.battery_end_percent || '?'}%</span>
                  <span className="flex items-center gap-1 font-semibold text-gray-700 dark:text-gray-300"><FiDollarSign className="w-3 h-3" />{formatCurrency(trip.total_cost)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
