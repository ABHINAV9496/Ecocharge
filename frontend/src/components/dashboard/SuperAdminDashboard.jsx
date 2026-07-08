import { useState, useEffect } from 'react'
import { FiUsers, FiMapPin, FiCalendar, FiDollarSign, FiTrendingUp, FiRefreshCw, FiChevronLeft, FiChevronRight, FiSearch } from 'react-icons/fi'
import { getStations, getStationStats, getOwnerRevenue } from '../../api/stations'
import { getBookings } from '../../api/bookings'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { SkeletonStats, SkeletonTable } from '../layout/Skeleton'
import { LineChart, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
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
  var [allBookings, setAllBookings] = useState([])
  var [recentBookings, setRecentBookings] = useState([])
  var [stats, setStats] = useState(null)
  var [revenueByStation, setRevenueByStation] = useState([])
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
    async function loadData() {
      try {
        var [statsRes, bookingsRes, revRes] = await Promise.all([
          getStationStats(),
          getBookings(),
          getOwnerRevenue(),
        ])
        setStats(statsRes.data)
        setAllBookings(bookingsRes.data)
        setRevenueByStation(revRes.data || [])
      } catch (error) {
        console.error('Failed to load dashboard data:', error)
        setError('Could not load dashboard data.')
      }
      setLoading(false)
    }
    loadData()
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
    { label: 'Stations', value: stations.length, icon: FiMapPin, color: 'text-emerald-500' },
    { label: 'Total Slots', value: stations.reduce(function (s, st) { return s + (st.slots ? st.slots.length : 0) }, 0), icon: FiTrendingUp, color: 'text-blue-500' },
    { label: 'Available', value: stations.reduce(function (s, st) { return s + (st.slots ? st.slots.filter(function (x) { return x.status === 'AVAILABLE' }).length : 0) }, 0), icon: FiTrendingUp, color: 'text-green-500' },
    { label: 'Bookings', value: allBookings.length, icon: FiCalendar, color: 'text-purple-500' },
    { label: 'Active Drivers', value: new Set(allBookings.map(function (b) { return b.driver_username })).size, icon: FiUsers, color: 'text-orange-500' },
    { label: 'Revenue', value: formatCurrency(allBookings.reduce(function (s, b) { return s + parseFloat(b.amount_charged || 0) }, 0)), icon: FiDollarSign, color: 'text-pink-500' },
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
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

      <div className="grid md:grid-cols-2 gap-4">
        {(function () {
          var revenueByDate = {}
          allBookings.forEach(function (b) {
            var date = formatDate(b.created_at).split(',')[0]
            revenueByDate[date] = (revenueByDate[date] || 0) + parseFloat(b.amount_charged || 0)
          })
          var revenueData = Object.entries(revenueByDate).map(function (e) { return { date: e[0], revenue: e[1] } })

          var statusCount = { PENDING: 0, CONFIRMED: 0, COMPLETED: 0, CANCELLED: 0 }
          allBookings.forEach(function (b) { statusCount[b.status] = (statusCount[b.status] || 0) + 1 })
          var pieData = Object.entries(statusCount).filter(function (e) { return e[1] > 0 }).map(function (e) { return { name: e[0], value: e[1] } })
          var PIE_COLORS = { PENDING: '#f59e0b', CONFIRMED: '#3b82f6', COMPLETED: '#10b981', CANCELLED: '#ef4444' }

          var hasAnyData = revenueData.length > 0 || pieData.length > 0

          return (
            <>
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
                  </div>
                </div>
              )}
            </>
          )
        })()}

        {revenueByStation.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Revenue by Station</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueByStation.slice(0, 12)}>
                <XAxis dataKey="station_name" tick={{ fontSize: 8 }} stroke="#6b7280" />
                <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" />
                <Tooltip />
                <Bar dataKey="total_revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {stations.some(function (s) { return (s.slots || []).length > 0 }) && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Slot Occupancy %</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stations.filter(function (s) { return (s.slots || []).length > 0 }).map(function (s) {
                var total = s.slots.length
                var occupied = s.slots.filter(function (sl) { return sl.status === 'OCCUPIED' || sl.status === 'FAULT' }).length
                return { name: s.name.length > 12 ? s.name.slice(0, 12) + '...' : s.name, occupancy: Math.round((occupied / total) * 100) }
              })}>
                <XAxis dataKey="name" tick={{ fontSize: 8 }} stroke="#6b7280" />
                <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="occupancy" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

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
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{station.name}</p>
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
                return (
                  <div key={booking.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{booking.driver_username || 'Unknown'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{booking.status}</p>
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(booking.amount_charged)}</span>
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
