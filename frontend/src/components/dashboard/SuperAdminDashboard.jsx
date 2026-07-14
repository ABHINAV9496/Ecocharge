import { useState, useEffect } from 'react'
import { FiUsers, FiMapPin, FiCalendar, FiDollarSign, FiTrendingUp, FiChevronLeft, FiChevronRight, FiSearch, FiZap, FiClock } from 'react-icons/fi'
import { getStations, getStationStats } from '../../api/stations'
import { getBookings } from '../../api/bookings'
import { formatCurrency, formatDate, shortPlace } from '../../utils/formatters'
import { SkeletonStats, SkeletonTable } from '../layout/Skeleton'
import { LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer, Line } from 'recharts'
import NotificationBell from './NotificationBell'

function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null
  function getPages() {
    var pages = []
    var addPage = function (p) { if (pages.indexOf(p) === -1) pages.push(p) }
    addPage(1)
    if (page > 3) addPage('...')
    for (var i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) { addPage(i) }
    if (page < totalPages - 2) addPage('...')
    addPage(totalPages)
    return pages
  }
  return (
    <div className="flex items-center justify-center gap-1 pt-3">
      <button onClick={function () { onPageChange(Math.max(1, page - 1)) }} disabled={page <= 1} className="p-1.5 text-gray-500 hover:text-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed"><FiChevronLeft className="w-3.5 h-3.5" /></button>
      {getPages().map(function (p, i) {
        if (p === '...') return <span key={'dots-' + i} className="w-7 h-7 text-xs text-gray-400 flex items-center justify-center">...</span>
        return <button key={p} onClick={function () { onPageChange(p) }} className={'w-7 h-7 text-xs font-medium rounded-lg ' + (p === page ? 'bg-emerald-500 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700')}>{p}</button>
      })}
      <button onClick={function () { onPageChange(Math.min(totalPages, page + 1)) }} disabled={page >= totalPages} className="p-1.5 text-gray-500 hover:text-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed"><FiChevronRight className="w-3.5 h-3.5" /></button>
    </div>
  )
}

export default function SuperAdminDashboard() {
  var [stations, setStations] = useState([])
  var [recentBookings, setRecentBookings] = useState([])
  var [stats, setStats] = useState(null)
  var [loading, setLoading] = useState(true)
  var [error, setError] = useState('')
  var [bookingError, setBookingError] = useState('')

  var [stationPage, setStationPage] = useState(1)
  var [stationTotalPages, setStationTotalPages] = useState(1)
  var [stationSearch, setStationSearch] = useState('')

  var [bookingPage, setBookingPage] = useState(1)
  var [bookingTotalPages, setBookingTotalPages] = useState(1)
  var [bookingSearch, setBookingSearch] = useState('')

  useEffect(function () {
    getStationStats().then(function (res) {
      setStats(res.data)
    }).catch(function () {
      setError('Could not load dashboard data.')
    }).finally(function () {
      setLoading(false)
    })
  }, [])

  function loadStations(p, q) {
    var params = { page: p, page_size: 10 }
    if (q) params.q = q
    getStations(params).then(function (res) {
      setStations(res.data.results || [])
      setStationTotalPages(Math.ceil((res.data.count || 0) / 10) || 1)
    }).catch(function () { })
  }

  function loadRecentBookings(p, q) {
    var params = { page: p, page_size: 10 }
    if (q) params.q = q
    getBookings(params).then(function (res) {
      var data = res.data.results || res.data
      setRecentBookings(Array.isArray(data) ? data : [])
      if (res.data.count !== undefined) setBookingTotalPages(Math.ceil((res.data.count || 0) / 10) || 1)
    }).catch(function () { })
  }

  useEffect(function () { loadStations(stationPage, stationSearch) }, [stationPage])
  useEffect(function () { loadRecentBookings(bookingPage, bookingSearch) }, [bookingPage])

  function handleStationSearch(v) { setStationSearch(v); setStationPage(1); loadStations(1, v) }
  function handleBookingSearch(v) { setBookingSearch(v); setBookingPage(1); loadRecentBookings(1, v) }

  var displayStats = stats ? [
    { label: 'Stations', value: stats.total_stations, icon: FiMapPin, color: 'text-emerald-500' },
    { label: 'Total Slots', value: stats.total_slots, icon: FiTrendingUp, color: 'text-blue-500' },
    { label: 'Available', value: stats.available_slots, icon: FiTrendingUp, color: 'text-green-500' },
    { label: 'Bookings', value: stats.total_bookings, icon: FiCalendar, color: 'text-purple-500' },
    { label: 'Active Drivers', value: stats.active_drivers, icon: FiUsers, color: 'text-orange-500' },
    { label: 'Revenue', value: formatCurrency(stats.revenue), icon: FiDollarSign, color: 'text-pink-500' },
  ] : [
    { label: 'Stations', value: 0, icon: FiMapPin, color: 'text-emerald-500' },
    { label: 'Total Slots', value: 0, icon: FiTrendingUp, color: 'text-blue-500' },
    { label: 'Available', value: 0, icon: FiTrendingUp, color: 'text-green-500' },
    { label: 'Bookings', value: 0, icon: FiCalendar, color: 'text-purple-500' },
    { label: 'Active Drivers', value: 0, icon: FiUsers, color: 'text-orange-500' },
    { label: 'Revenue', value: formatCurrency(0), icon: FiDollarSign, color: 'text-pink-500' },
  ]

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="h-8 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mb-6" />
        <SkeletonStats count={4} />
        <SkeletonTable rows={3} />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {error && <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl">{error}</div>}
      {bookingError && <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 text-sm rounded-xl">{bookingError}</div>}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center">
            <FiTrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Platform-wide overview and statistics</p>
          </div>
        </div>
        <NotificationBell />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {displayStats.map(function (stat) {
          var StatIcon = stat.icon
          return (
            <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{stat.label}</span>
                <StatIcon className={'w-4 h-4 ' + stat.color} />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
            </div>
          )
        })}
      </div>

      {(stats.revenue_by_date && stats.revenue_by_date.length > 1) ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Revenue Over Time</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats.revenue_by_date}>
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
            <p className="text-sm">No revenue data yet</p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FiMapPin className="w-4 h-4 text-gray-400" />
            All Stations
          </h2>

          <div className="mb-3">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input type="text" placeholder="Search stations..." value={stationSearch} onChange={function (e) { handleStationSearch(e.target.value) }}
                className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {stations.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">No stations found</p>
            ) : (
              stations.map(function (station) {
                var slots = station.slots || []
                var availSlots = slots.filter(function (s) { return s.status === 'AVAILABLE' }).length
                var occSlots = slots.filter(function (s) { return s.status === 'OCCUPIED' }).length
                var faultSlots = slots.filter(function (s) { return s.status === 'FAULT' }).length
                var totalSlots = slots.length || 0

                return (
                  <div key={station.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{station.name}{station.address ? ' · ' + shortPlace(station.address) : ''}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Owner: {station.owner_username || 'N/A'}</p>
                      {totalSlots > 0 && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[10px] font-medium text-emerald-500">{availSlots} avail</span>
                          {occSlots > 0 && <span className="text-[10px] font-medium text-amber-500">· {occSlots} occ</span>}
                          {faultSlots > 0 && <span className="text-[10px] font-medium text-red-500">· {faultSlots} fault</span>}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className={'text-sm font-medium ' + (availSlots > 0 ? 'text-emerald-500' : 'text-red-500')}>{availSlots}/{totalSlots}</p>
                      <p className="text-xs text-gray-400">available</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          <Pagination page={stationPage} totalPages={stationTotalPages} onPageChange={setStationPage} />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FiCalendar className="w-4 h-4 text-gray-400" />
            Recent Bookings
          </h2>
          <div className="mb-3">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input type="text" placeholder="Search by ID, driver, or station..." value={bookingSearch} onChange={function (e) { handleBookingSearch(e.target.value) }}
                className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {recentBookings.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">No bookings yet</p>
            ) : (
              recentBookings.map(function (booking) {
                var stationName = booking.slot_details ? booking.slot_details.station_name : 'Slot #' + booking.slot
                var durationStr = ''
                if (booking.start_time && booking.end_time) {
                  var diffMs = new Date(booking.end_time) - new Date(booking.start_time)
                  var diffH = Math.round(diffMs / 3600000 * 10) / 10
                  durationStr = diffH >= 1 ? diffH + 'h' : Math.round(diffMs / 60000) + 'm'
                }
                return (
                  <div key={booking.id} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                    <div className="flex items-start justify-between mb-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{stationName}</p>
                      <span className="text-sm font-bold text-gray-900 dark:text-white shrink-0 ml-2">{formatCurrency(booking.amount_charged)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 flex-wrap">
                      <span>{booking.driver_username || 'Unknown'}</span>
                      <span className="text-gray-300 dark:text-gray-600">|</span>
                      <span className={'px-1.5 py-0.5 rounded font-medium ' + (booking.status === 'CONFIRMED' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30' : booking.status === 'IN_PROGRESS' ? 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30' : 'text-gray-500 bg-gray-200 dark:bg-gray-700')}>{booking.status}</span>
                      {booking.vehicle_details && (
                        <><span className="text-gray-300 dark:text-gray-600">|</span>
                          <FiZap className="w-3 h-3 text-emerald-400" />
                          <span>{booking.vehicle_details.make} {booking.vehicle_details.model}</span></>
                      )}
                      {durationStr && (
                        <><span className="text-gray-300 dark:text-gray-600">|</span>
                          <FiClock className="w-3 h-3" />{durationStr}</>
                      )}
                    </div>
                    {booking.start_time && (
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{formatDate(booking.start_time)}</p>
                    )}
                  </div>
                )
              })
            )}
          </div>
          <Pagination page={bookingPage} totalPages={bookingTotalPages} onPageChange={setBookingPage} />
        </div>
      </div>
    </div>
  )
}
