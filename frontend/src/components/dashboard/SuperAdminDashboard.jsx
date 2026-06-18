/*
  Super Admin Dashboard
  ---------------------
  For SUPER_ADMIN users — the highest access level.

  What it shows:
  1. High-level platform stats — total stations, slots, bookings, revenue, active drivers
  2. A list of all stations with availability indicators
  3. A list of recent bookings with driver names and amounts

  Note: This is a read-only dashboard. Station management is done
  through the Station Owner dashboard.
*/

import { useState, useEffect } from 'react'
import { FiUsers, FiMapPin, FiCalendar, FiDollarSign, FiTrendingUp, FiRefreshCw } from 'react-icons/fi'
import { getStations } from '../../api/stations'
import { getBookings } from '../../api/bookings'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { SkeletonStats, SkeletonTable } from '../layout/Skeleton'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

// ----------------------------------------------------------------
// MAIN COMPONENT: Super Admin Dashboard
// ----------------------------------------------------------------
export default function SuperAdminDashboard() {
  // ---- STATE ----
  var [stations, setStations] = useState([])   // All stations on the platform
  var [bookings, setBookings] = useState([])    // All bookings on the platform
  var [loading, setLoading] = useState(true)    // Loading indicator
  var [error, setError] = useState('')          // Error message
  var [bookingError, setBookingError] = useState('')  // Error fetching bookings


  // ---- FETCH DATA ON MOUNT ----
  useEffect(function () {
    async function loadData() {
      try {
        var stationsResponse = await getStations()
        setStations(stationsResponse.data)
      } catch (error) {
        console.error('Failed to load stations:', error)
        setError('Could not load stations.')
      }

      try {
        var bookingsResponse = await getBookings()
        setBookings(bookingsResponse.data)
      } catch (error) {
        console.error('Failed to load bookings:', error)
        setBookingError('Could not load bookings.')
      }

      setLoading(false)
    }

    loadData()
  }, [])
  // ---- COMPUTED STATS ----
  var stats = {
    totalStations: stations.length,
    totalSlots: stations.reduce(function (sum, station) {
      return sum + (station.slots ? station.slots.length : 0)
    }, 0),
    totalBookings: bookings.length,
    revenue: bookings.reduce(function (sum, booking) {
      return sum + parseFloat(booking.amount_charged || 0)
    }, 0),
    activeDrivers: new Set(bookings.map(function (b) { return b.driver_username })).size,
    availableSlots: stations.reduce(function (sum, station) {
      var slots = station.slots || []
      return sum + slots.filter(function (s) { return s.status === 'AVAILABLE' }).length
    }, 0),
  }

  // ---- LOADING STATE ----
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="h-8 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mb-6" />
        <SkeletonStats count={4} />
        <SkeletonTable rows={3} />
      </div>
    )
  }

  // ---- MAIN RENDER ----
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">

      {/* Error banners */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl">
          {error}
        </div>
      )}
      {bookingError && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 text-sm rounded-xl">
          {bookingError}
        </div>
      )}

      {/* ---- PAGE HEADER ---- */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center">
          <FiTrendingUp className="w-5 h-5 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Platform-wide overview and statistics</p>
        </div>
      </div>

      {/* ---- STATS CARDS ---- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Stations', value: stats.totalStations, icon: FiMapPin, color: 'text-emerald-500' },
          { label: 'Total Slots', value: stats.totalSlots, icon: FiTrendingUp, color: 'text-blue-500' },
          { label: 'Available', value: stats.availableSlots, icon: FiTrendingUp, color: 'text-green-500' },
          { label: 'Bookings', value: stats.totalBookings, icon: FiCalendar, color: 'text-purple-500' },
          { label: 'Active Drivers', value: stats.activeDrivers, icon: FiUsers, color: 'text-orange-500' },
          { label: 'Revenue', value: formatCurrency(stats.revenue), icon: FiDollarSign, color: 'text-pink-500' },
        ].map(function (stat) {
          var StatIcon = stat.icon
          return (
            <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {stat.label}
                </span>
                <StatIcon className={'w-4 h-4 ' + stat.color} />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
            </div>
          )
        })}
      </div>

      {/* ---- CHARTS SECTION ---- */}
      {(function () {
        var revenueByDate = {}
        bookings.forEach(function (b) {
          var date = formatDate(b.created_at).split(',')[0]
          revenueByDate[date] = (revenueByDate[date] || 0) + parseFloat(b.amount_charged || 0)
        })
        var revenueData = Object.entries(revenueByDate).map(function (e) { return { date: e[0], revenue: e[1] } })

        var statusCount = { PENDING: 0, CONFIRMED: 0, COMPLETED: 0, CANCELLED: 0 }
        bookings.forEach(function (b) { statusCount[b.status] = (statusCount[b.status] || 0) + 1 })
        var pieData = Object.entries(statusCount).filter(function (e) { return e[1] > 0 }).map(function (e) { return { name: e[0], value: e[1] } })
        var PIE_COLORS = { PENDING: '#f59e0b', CONFIRMED: '#3b82f6', COMPLETED: '#10b981', CANCELLED: '#ef4444' }

        var hasAnyData = revenueData.length > 0 || pieData.length > 0

        return (
          <div className="grid md:grid-cols-2 gap-4">
            {revenueData.length > 1 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Revenue Over Time</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={revenueData}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#6b7280" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" />
                    <Tooltip />
                    <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Revenue Over Time</h3>
                <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
                  <FiTrendingUp className="w-8 h-8 mb-2" />
                  <p className="text-sm">{hasAnyData ? 'Not enough data for trend' : 'No revenue data yet'}</p>
                  <p className="text-xs mt-1">Need at least 2 bookings with revenue to show a trend</p>
                </div>
              </div>
            )}
            {pieData.length > 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Booking Status</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {pieData.map(function (e) { return <Cell key={e.name} fill={PIE_COLORS[e.name] || '#6b7280'} /> })}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Booking Status</h3>
                <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
                  <FiTrendingUp className="w-8 h-8 mb-2" />
                  <p className="text-sm">No booking data yet</p>
                  <p className="text-xs mt-1">Booking status distribution will appear once drivers make bookings</p>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* ---- TWO-COLUMN DETAILS ---- */}
      <div className="grid md:grid-cols-2 gap-6">

        {/* ---- COLUMN 1: All Stations ---- */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FiMapPin className="w-4 h-4 text-gray-400" />
            All Stations
          </h2>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {stations.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">No stations registered</p>
            ) : (
              stations.map(function (station) {
                var availSlots = station.slots
                  ? station.slots.filter(function (s) { return s.status === 'AVAILABLE' }).length
                  : 0
                var totalSlots = station.slots ? station.slots.length : 0

                return (
                  <div key={station.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{station.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Owner: {station.owner_username || 'N/A'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={'text-sm font-medium ' + (availSlots > 0 ? 'text-emerald-500' : 'text-red-500')}>
                        {availSlots}/{totalSlots}
                      </p>
                      <p className="text-xs text-gray-400">available</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ---- COLUMN 2: Recent Bookings ---- */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FiCalendar className="w-4 h-4 text-gray-400" />
            Recent Bookings
          </h2>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {bookings.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">No bookings yet</p>
            ) : (
              bookings.slice(0, 20).map(function (booking) {
                return (
                  <div key={booking.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {booking.driver_username || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{booking.status}</p>
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {formatCurrency(booking.amount_charged)}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
