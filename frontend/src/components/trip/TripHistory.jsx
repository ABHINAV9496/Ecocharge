import { useState, useEffect } from 'react'
import { FiCalendar, FiMapPin, FiNavigation, FiBatteryCharging, FiDollarSign, FiPlay, FiBarChart2 } from 'react-icons/fi'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { getTrips } from '../../api/trips'

export default function TripHistory() {
  var [trips, setTrips] = useState([])
  var [isLoading, setIsLoading] = useState(true)
  var [error, setError] = useState('')
  var [replayTripId, setReplayTripId] = useState(null)

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

  var stats = {
    total: trips.length,
    totalDistance: trips.reduce(function (sum, t) { return sum + t.distance_km }, 0),
    totalCost: trips.reduce(function (sum, t) { return sum + parseFloat(t.total_cost || 0) }, 0),
  }

  function toggleReplay(tripId) {
    if (replayTripId === tripId) { setReplayTripId(null) } else { setReplayTripId(tripId) }
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
            var isReplaying = replayTripId === trip.id
            return (
              <div key={trip.id} className={'rounded-2xl border p-5 transition-all shadow-sm ' + (isReplaying ? 'border-emerald-200 dark:border-emerald-800 bg-white dark:bg-gray-800' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md')}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <FiCalendar className="w-3.5 h-3.5" />
                    {formatDate(trip.created_at)}
                  </div>
                  <button onClick={function () { toggleReplay(trip.id) }}
                    className={'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl transition-all ' + (isReplaying ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400')}>
                    <FiPlay className="w-3 h-3" />
                    {isReplaying ? 'Hide' : 'Replay'}
                  </button>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg flex items-center justify-center shrink-0"><FiMapPin className="w-3 h-3 text-emerald-500" /></div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{trip.origin}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-red-100 dark:bg-red-900/40 rounded-lg flex items-center justify-center shrink-0"><FiNavigation className="w-3 h-3 text-red-500" /></div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{trip.destination}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-xl px-3 py-2">
                  <span className="font-medium">{trip.distance_km ? trip.distance_km.toFixed(1) : '-'} km</span>
                  <span className="flex items-center gap-1"><FiBatteryCharging className="w-3 h-3" />{trip.battery_start_percent}% → {trip.battery_end_percent || '?'}%</span>
                  <span className="flex items-center gap-1 font-semibold text-gray-700 dark:text-gray-300"><FiDollarSign className="w-3 h-3" />{formatCurrency(trip.total_cost)}</span>
                </div>

                {isReplaying && <TripReplayVisualization trip={trip} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TripReplayVisualization(props) {
  var trip = props.trip
  var [progress, setProgress] = useState(0)

  useEffect(function () {
    var interval = setInterval(function () {
      setProgress(function (current) {
        if (current >= 100) return 0
        return current + 1
      })
    }, 100)
    return function () { clearInterval(interval) }
  }, [])

  var predictedReadings = trip.predicted_battery_readings || []
  var batteryStart = trip.battery_start_percent || 80
  var batteryEnd = trip.battery_end_percent || 20
  var batteryDiff = batteryStart - batteryEnd
  var currentBattery = Math.round(batteryStart - batteryDiff * progress / 100)

  var barData = predictedReadings.length > 0 ? predictedReadings : (function () {
    var result = []
    for (var i = 0; i < 20; i++) { result.push(batteryStart - batteryDiff * i / 19) }
    return result
  })()

  var maxBarValue = Math.max.apply(null, barData)

  return (
    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1.5"><FiBarChart2 className="w-3 h-3" />Battery Consumption Replay</h4>
      <div className="relative h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-100" style={{ width: progress + '%' }} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-400">Start: {batteryStart}%</span>
        <span className="text-[10px] font-bold text-emerald-500">{currentBattery}%</span>
        <span className="text-[10px] text-gray-400">End: {batteryEnd}%</span>
      </div>
      <div className="h-24 bg-gray-50 dark:bg-gray-900 rounded-xl p-2 flex items-end gap-[2px] overflow-hidden">
        {barData.map(function (value, index) {
          var barHeight = maxBarValue > 0 ? (value / maxBarValue) * 100 : 50
          var isActive = Math.floor(progress / (100 / barData.length)) === index
          return <div key={index} className={'flex-1 rounded-t transition-all duration-100 ' + (isActive ? 'bg-emerald-500' : 'bg-emerald-300 dark:bg-emerald-700')} style={{ height: barHeight + '%' }} title={value ? value.toFixed(1) + '%' : ''} />
        })}
      </div>
      <p className="text-[10px] text-gray-400 text-center">Predicted battery drain over distance</p>
    </div>
  )
}
