import { useState, useEffect, useRef } from 'react'
import { FiPlus, FiMapPin, FiTrendingUp, FiCalendar, FiZap, FiDollarSign, FiEdit2, FiTrash2, FiCrosshair, FiChevronLeft, FiChevronRight, FiXCircle, FiCheckCircle, FiSearch, FiEdit3, FiBarChart2 } from 'react-icons/fi'
import { getMyStations, createStation, updateStation, deleteStation, createSlot, getOwnerRevenue } from '../../api/stations'
import { getBookings, ownerCompleteBooking, ownerNoShowBooking } from '../../api/bookings'
import { formatCurrency, formatDate, SLOT_TYPE_LABELS } from '../../utils/formatters'
import { useToast } from '../../context/ToastContext'
import { SkeletonStats } from '../layout/Skeleton'
import { LineChart, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import NotificationBell from './NotificationBell'
import StationReviews from './StationReviews'
import SlotEditForm from './SlotEditForm'
import MaintenanceScheduleForm from './MaintenanceScheduleForm'

export default function StationOwnerDashboard() {
  var [stations, setStations] = useState([])
  var [bookings, setBookings] = useState([])
  var [showForm, setShowForm] = useState(false)
  var [editingStation, setEditingStation] = useState(null)
  var [form, setForm] = useState({ name: '', address: '', latitude: '', longitude: '', amenities: '', status: 'ACTIVE' })
  var [loading, setLoading] = useState(true)
  var [page, setPage] = useState(1)
  var [totalPages, setTotalPages] = useState(1)
  var [slotForm, setSlotForm] = useState({ stationId: null, slot_type: 'AC_FAST', rate_per_kwh: '', off_peak_rate: '' })
  var [error, setError] = useState('')
  var [bookingError, setBookingError] = useState('')
  var [formError, setFormError] = useState('')
  var [slotError, setSlotError] = useState('')
  var [showMapPicker, setShowMapPicker] = useState(false)
  var [editingSlotId, setEditingSlotId] = useState(null)

  var [bookingSearch, setBookingSearch] = useState('')
  var [bookingStatus, setBookingStatus] = useState('ALL')
  var [bookingPage, setBookingPage] = useState(1)
  var [bookingTotalPages, setBookingTotalPages] = useState(1)

  var [revenueByStation, setRevenueByStation] = useState([])
  var [showRevenueChart, setShowRevenueChart] = useState(false)

  var showToast = useToast()

  function loadStations() {
    getMyStations({ page: page, page_size: 10 }).then(function (res) {
      setStations(res.data.results || [])
      setTotalPages(Math.ceil((res.data.count || 0) / 10) || 1)
    }).catch(function (error) {
      console.error('Failed to load stations:', error)
      setError('Could not load your stations.')
    })
  }

  function loadBookings(p, q, s) {
    var params = {}
    if (p > 1) params.page = p
    if (q) params.q = q
    if (s && s !== 'ALL') params.status = s
    getBookings(params).then(function (res) {
      var data = res.data.results || res.data
      var arr = Array.isArray(data) ? data : []
      setBookings(arr)
      if (res.data.count !== undefined) setBookingTotalPages(Math.ceil((res.data.count || 0) / 10) || 1)
    }).catch(function (error) {
      console.error('Failed to load bookings:', error)
      setBookingError('Could not load bookings.')
    })
  }

  function loadRevenue() {
    getOwnerRevenue().then(function (res) { setRevenueByStation(res.data || []) }).catch(function () {})
  }

  useEffect(function () {
    async function loadData() {
      setLoading(true)
      await Promise.all([loadStations(), loadBookings(1, '', 'ALL'), loadRevenue()])
      setLoading(false)
    }
    loadData()
  }, [page])

  function handleBookingSearch(v) { setBookingSearch(v); setBookingPage(1); loadBookings(1, v, bookingStatus) }
  function handleBookingStatus(s) { setBookingStatus(s); setBookingPage(1); loadBookings(1, bookingSearch, s) }
  useEffect(function () { if (!loading) loadBookings(bookingPage, bookingSearch, bookingStatus) }, [bookingPage])

  var stationCount = stations.length
  var slotCount = stations.reduce(function (sum, station) {
    return sum + (station.slots ? station.slots.length : 0)
  }, 0)
  var revenue = bookings
    .filter(function (b) { return ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(b.status) })
    .reduce(function (sum, b) { return sum + parseFloat(b.amount_charged || 0) }, 0)
  var activeBookings = bookings.filter(function (b) { return ['CONFIRMED', 'IN_PROGRESS'].includes(b.status) }).length

  async function handleSaveStation() {
    setFormError('')
    try {
      var payload = {
        name: form.name, address: form.address,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        status: form.status,
        amenities: form.amenities ? form.amenities.split(',').map(function (a) { return a.trim() }) : [],
      }
      if (editingStation) { await updateStation(editingStation.id, payload) } else { await createStation(payload) }
      loadStations()
      resetStationForm()
      showToast(editingStation ? 'Station updated successfully' : 'Station created successfully', 'success')
    } catch (error) {
      var errorMsg = 'Failed to save station'
      if (error.response && error.response.data) { errorMsg = Object.values(error.response.data).flat().join(', ') || errorMsg }
      setFormError(errorMsg)
      showToast(errorMsg, 'error')
    }
  }

  async function handleDeleteStation(stationId) {
    if (!window.confirm('Are you sure you want to delete this station? This action cannot be undone.')) return
    try {
      await deleteStation(stationId)
      loadStations()
      showToast('Station deleted successfully', 'success')
    } catch (error) {
      showToast('Could not delete station. It may have active bookings.', 'error')
    }
  }

  async function handleOwnerComplete(bookingId) {
    try {
      await ownerCompleteBooking(bookingId)
      showToast('Booking marked as completed', 'success')
      loadBookings(bookingPage, bookingSearch, bookingStatus)
    } catch (error) {
      showToast('Could not complete booking.', 'error')
    }
  }

  async function handleOwnerNoShow(bookingId) {
    if (!window.confirm('Mark this booking as no show? The slot will be released and the booking cancelled.')) return
    try {
      await ownerNoShowBooking(bookingId)
      showToast('Booking marked as no show', 'success')
      loadBookings(bookingPage, bookingSearch, bookingStatus)
    } catch (error) {
      showToast('Could not mark booking as no show.', 'error')
    }
  }

  async function handleAddSlot(stationId) {
    setSlotError('')
    if (!slotForm.rate_per_kwh) { setSlotError('Please enter a rate per kWh'); return }
    try {
      await createSlot(stationId, {
        slot_type: slotForm.slot_type,
        rate_per_kwh: parseFloat(slotForm.rate_per_kwh),
        off_peak_rate: slotForm.off_peak_rate ? parseFloat(slotForm.off_peak_rate) : null,
      })
      showToast('Slot added successfully', 'success')
      setSlotForm({ stationId: null, slot_type: 'AC_FAST', rate_per_kwh: '', off_peak_rate: '' })
      loadStations()
    } catch (error) {
      var errorMsg = 'Failed to add slot'
      if (error.response && error.response.data) { errorMsg = Object.values(error.response.data).flat().join(', ') || errorMsg }
      setSlotError(errorMsg)
    }
  }

  function startEditStation(station) {
    setEditingStation(station)
    setForm({
      name: station.name || '', address: station.address || '',
      latitude: station.latitude || '', longitude: station.longitude || '',
      amenities: (station.amenities || []).join(', '), status: station.status || 'ACTIVE',
    })
    setShowForm(true)
  }

  function resetStationForm() {
    setShowForm(false); setEditingStation(null)
    setForm({ name: '', address: '', latitude: '', longitude: '', amenities: '', status: 'ACTIVE' })
    setFormError('')
  }

  function Pagination({ page, totalPages, onPageChange }) {
    if (totalPages <= 1) return null
    function getPages() { var p = []; var add = function (x) { if (p.indexOf(x) === -1) p.push(x) }; add(1); if (page > 3) add('...'); for (var i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) add(i); if (page < totalPages - 2) add('...'); add(totalPages); return p }
    return (
      <div className="flex items-center justify-center gap-1 pt-3">
        <button onClick={function () { onPageChange(Math.max(1, page - 1)) }} disabled={page <= 1} className="p-1.5 text-gray-500 hover:text-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed"><FiChevronLeft className="w-3.5 h-3.5" /></button>
        {getPages().map(function (p, i) {
          if (p === '...') return <span key={'d' + i} className="w-7 h-7 text-xs text-gray-400 flex items-center justify-center">...</span>
          return <button key={p} onClick={function () { onPageChange(p) }} className={'w-7 h-7 text-xs font-medium rounded-lg ' + (p === page ? 'bg-emerald-500 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700')}>{p}</button>
        })}
        <button onClick={function () { onPageChange(Math.min(totalPages, page + 1)) }} disabled={page >= totalPages} className="p-1.5 text-gray-500 hover:text-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed"><FiChevronRight className="w-3.5 h-3.5" /></button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="h-8 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mb-6" />
        <SkeletonStats count={4} />
      </div>
    )
  }

  var SLOT_STATUS_COLORS = { AVAILABLE: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20', OCCUPIED: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20', FAULT: 'text-red-500 bg-red-50 dark:bg-red-900/20' }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {error && <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl">{error}</div>}
      {bookingError && <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 text-sm rounded-xl">{bookingError}</div>}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center">
            <FiMapPin className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Station Owner Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Manage your charging stations and slots</p>
          </div>
        </div>
        <NotificationBell />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'My Stations', value: stationCount, icon: FiMapPin, color: 'text-emerald-500' },
          { label: 'Total Slots', value: slotCount, icon: FiZap, color: 'text-blue-500' },
          { label: 'Revenue', value: formatCurrency(revenue), icon: FiDollarSign, color: 'text-purple-500' },
          { label: 'Active Bookings', value: activeBookings, icon: FiCalendar, color: 'text-orange-500' },
        ].map(function (stat) {
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
          bookings.filter(function (b) { return ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(b.status) }).forEach(function (b) {
            var date = formatDate(b.created_at).split(',')[0]
            revenueByDate[date] = (revenueByDate[date] || 0) + parseFloat(b.amount_charged || 0)
          })
          var revenueData = Object.entries(revenueByDate).map(function (e) { return { date: e[0], revenue: e[1] } })

          var slotTypeCount = {}
          stations.forEach(function (s) {
            (s.slots || []).forEach(function (sl) {
              var label = SLOT_TYPE_LABELS[sl.slot_type] || sl.slot_type
              slotTypeCount[label] = (slotTypeCount[label] || 0) + 1
            })
          })
          var pieData = Object.entries(slotTypeCount).map(function (e) { return { name: e[0], value: e[1] } })
          var PIE_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b']

          var hasSlots = stations.some(function (s) { return (s.slots || []).length > 0 })
          var hasBookings = bookings.length > 0

          return (
            <>
              {revenueData.length > 1 ? (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Revenue Trend</h3>
                  <ResponsiveContainer width="100%" height={200}>
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
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Revenue Trend</h3>
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
                    <FiTrendingUp className="w-8 h-8 mb-2" />
                    <p className="text-sm">{hasBookings ? 'Not enough data for trend' : 'No revenue data yet'}</p>
                  </div>
                </div>
              )}

              {pieData.length > 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Slot Distribution</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={function (e) { return e.name.split('(')[0].trim() }}>
                        {pieData.map(function (e, i) { return <Cell key={e.name} fill={PIE_COLORS[i % PIE_COLORS.length]} /> })}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Slot Distribution</h3>
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
                    <FiZap className="w-8 h-8 mb-2" />
                    <p className="text-sm">No slots configured</p>
                  </div>
                </div>
              )}
            </>
          )
        })()}

        {(function () {
          if (revenueByStation.length === 0) return null
          return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Revenue by Station</h3>
                <button onClick={function () { setShowRevenueChart(!showRevenueChart) }} className="text-[10px] font-medium text-emerald-500 hover:text-emerald-600">
                  {showRevenueChart ? 'Hide' : 'Show'}
                </button>
              </div>
              {showRevenueChart && (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={revenueByStation.slice(0, 10)}>
                    <XAxis dataKey="station_name" tick={{ fontSize: 8 }} stroke="#6b7280" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" />
                    <Tooltip />
                    <Bar dataKey="total_revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )
        })()}

        {(function () {
          var stationsWithSlots = stations.filter(function (s) { return (s.slots || []).length > 0 })
          if (stationsWithSlots.length === 0) return null
          var occData = stationsWithSlots.map(function (s) {
            var total = s.slots.length
            var occupied = s.slots.filter(function (sl) { return sl.status === 'OCCUPIED' || sl.status === 'FAULT' }).length
            return { name: s.name.length > 12 ? s.name.slice(0, 12) + '...' : s.name, occupancy: Math.round((occupied / total) * 100) }
          })
          return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Slot Occupancy %</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={occData}>
                  <XAxis dataKey="name" tick={{ fontSize: 8 }} stroke="#6b7280" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="occupancy" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )
        })()}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">My Stations</h2>
          <button onClick={function () { resetStationForm(); setShowForm(!showForm) }}
            className={['flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl transition-all',
              showForm ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-emerald-700'].join(' ')}>
            <FiPlus className="w-4 h-4" />{showForm ? 'Cancel' : 'Add Station'}
          </button>
        </div>

        {showForm && (
          <div className="p-5 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">{editingStation ? 'Edit Station' : 'New Station'}</h3>
            {formError && <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl">{formError}</div>}
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="Station Name" value={form.name} onChange={function (e) { setForm(Object.assign({}, form, { name: e.target.value })) }} className="px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" />
              <input type="text" placeholder="Address" value={form.address} onChange={function (e) { setForm(Object.assign({}, form, { address: e.target.value })) }} className="px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" />
              <input type="number" step="any" placeholder="Latitude" value={form.latitude} onChange={function (e) { setForm(Object.assign({}, form, { latitude: e.target.value })) }} className="px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" />
              <div className="flex items-center gap-2">
                <input type="number" step="any" placeholder="Longitude" value={form.longitude} onChange={function (e) { setForm(Object.assign({}, form, { longitude: e.target.value })) }} className="flex-1 px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" />
                <button type="button" onClick={function () { setShowMapPicker(!showMapPicker) }} className="shrink-0 px-3 py-2.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 transition-all flex items-center gap-1"><FiCrosshair className="w-3.5 h-3.5" /> Map</button>
              </div>
              {showMapPicker && (
                <div className="col-span-2">
                  <MapPinPicker lat={form.latitude ? parseFloat(form.latitude) : 12.9716} lng={form.longitude ? parseFloat(form.longitude) : 77.5946}
                    onPick={function (lat, lng) { setForm(Object.assign({}, form, { latitude: lat.toString(), longitude: lng.toString() })); setShowMapPicker(false) }}
                    onClose={function () { setShowMapPicker(false) }} />
                </div>
              )}
              <input type="text" placeholder="Amenities (comma-separated)" value={form.amenities} onChange={function (e) { setForm(Object.assign({}, form, { amenities: e.target.value })) }} className="px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" />
              <select value={form.status} onChange={function (e) { setForm(Object.assign({}, form, { status: e.target.value })) }} className="px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="MAINTENANCE">Maintenance</option>
              </select>
            </div>
            <button onClick={handleSaveStation} className="mt-3 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-medium rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/20">{editingStation ? 'Update Station' : 'Create Station'}</button>
          </div>
        )}

        {stations.length === 0 ? (
          <div className="text-center py-12">
            <FiMapPin className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No stations yet. Add your first station above!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {stations.map(function (station) {
              var slots = station.slots || []
              var availableSlots = slots.filter(function (s) { return s.status === 'AVAILABLE' }).length
              var occupiedSlots = slots.filter(function (s) { return s.status === 'OCCUPIED' }).length
              var faultSlots = slots.filter(function (s) { return s.status === 'FAULT' }).length

              return (
                <div key={station.id} className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{station.name}</h3>
                        <span className={['px-2 py-0.5 text-xs font-medium rounded-full',
                          station.status === 'ACTIVE' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' :
                          station.status === 'MAINTENANCE' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400' :
                          'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'].join(' ')}>{station.status}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{station.address}</p>
                      {slots.length > 0 && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-medium text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">{availableSlots} Available</span>
                          {occupiedSlots > 0 && <span className="text-[10px] font-medium text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">{occupiedSlots} Occupied</span>}
                          {faultSlots > 0 && <span className="text-[10px] font-medium text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">{faultSlots} Fault</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={function () { startEditStation(station) }} className="p-2 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all" title="Edit station"><FiEdit2 className="w-4 h-4" /></button>
                      <button onClick={function () { handleDeleteStation(station.id) }} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all" title="Delete station"><FiTrash2 className="w-4 h-4" /></button>
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-3">
                    {slots.map(function (slot) {
                      var sc = SLOT_STATUS_COLORS[slot.status] || SLOT_STATUS_COLORS.AVAILABLE
                      var isEditing = editingSlotId === slot.id
                      return (
                        <div key={slot.id}>
                          <div className="flex items-center justify-between px-3.5 py-2 bg-gray-50 dark:bg-gray-900 rounded-xl text-sm">
                            <span className="font-medium text-gray-700 dark:text-gray-300">{SLOT_TYPE_LABELS[slot.slot_type] || slot.slot_type}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-gray-500 dark:text-gray-400 text-xs">{'\u20B9'}{slot.rate_per_kwh}</span>
                              {slot.off_peak_rate && <span className="text-emerald-500 dark:text-emerald-400 text-xs">{'\u20B9'}{slot.off_peak_rate} off-peak</span>}
                              <span className={'px-2 py-0.5 text-xs font-medium rounded-full ' + sc}>{slot.status}</span>
                              <button onClick={function () { setEditingSlotId(isEditing ? null : slot.id) }}
                                className={'p-1 rounded-lg transition-all ' + (isEditing ? 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30' : 'text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20')}
                                title="Edit slot"><FiEdit3 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                          {isEditing && (
                            <SlotEditForm slot={slot} stationId={station.id}
                              onClose={function () { setEditingSlotId(null) }}
                              onSaved={function () { setEditingSlotId(null); loadStations() }} />
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    {slotForm.stationId === station.id ? (function () {
                      return (
                        <div className="flex-1">
                          {slotError && <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded-xl">{slotError}</div>}
                          <div className="flex items-center gap-2">
                            <select value={slotForm.slot_type} onChange={function (e) { setSlotForm(Object.assign({}, slotForm, { slot_type: e.target.value })) }} className="flex-1 px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none">
                              <option value="AC_SLOW">AC Slow</option><option value="AC_FAST">AC Fast</option><option value="DC_FAST">DC Fast</option><option value="DC_ULTRA">DC Ultra</option>
                            </select>
                            <input type="number" placeholder="Rate" value={slotForm.rate_per_kwh} onChange={function (e) { setSlotForm(Object.assign({}, slotForm, { rate_per_kwh: e.target.value })) }} className="w-20 px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none" title="Rate per kWh" />
                            <input type="number" placeholder="Off-peak" value={slotForm.off_peak_rate} onChange={function (e) { setSlotForm(Object.assign({}, slotForm, { off_peak_rate: e.target.value })) }} className="w-20 px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none" title="Off-peak rate" />
                            <button onClick={function () { handleAddSlot(station.id) }} className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700">Add</button>
                            <button onClick={function () { setSlotForm({ stationId: null, slot_type: 'AC_FAST', rate_per_kwh: '', off_peak_rate: '' }) }} className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700">Cancel</button>
                          </div>
                        </div>
                      )
                    })() : (
                      <div className="flex items-center gap-3">
                        <button onClick={function () { setSlotForm(Object.assign({}, slotForm, { stationId: station.id })) }} className="flex items-center gap-1 text-xs font-medium text-emerald-500 hover:text-emerald-600 transition-colors"><FiPlus className="w-3 h-3" /> Add Slot</button>
                        <StationReviews stationId={station.id} />
                      </div>
                    )}
                  </div>
                  <MaintenanceScheduleForm station={station} onSaved={loadStations} />
                </div>
              )
            })}
          </div>
        )}

        {stations.length > 0 && totalPages > 1 && (
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Station Bookings</h2>
        </div>

        <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
              {['ALL', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(function (s) {
                return <button key={s} onClick={function () { handleBookingStatus(s) }}
                  className={'px-3 py-1.5 text-xs font-medium rounded-lg transition-all ' + (bookingStatus === s ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300')}>{s === 'ALL' ? 'All' : s}</button>
              })}
            </div>
            <div className="relative flex-1 min-w-[180px]">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input type="text" placeholder="Search by ID, driver, or station..." value={bookingSearch} onChange={function (e) { handleBookingSearch(e.target.value) }}
                className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
        </div>

        {bookings.length === 0 ? (
          <div className="text-center py-8">
            <FiCalendar className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No bookings for your stations yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {bookings.map(function (booking) {
              var isConfirmed = booking.status === 'CONFIRMED'
              var isInProgress = booking.status === 'IN_PROGRESS'
              var stationName = booking.slot_details ? booking.slot_details.station_name : 'Slot #' + booking.slot

              return (
                <div key={booking.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{booking.driver_username}</span>
                      <span className="text-xs text-gray-500">at {stationName}</span>
                      <span className={['px-2 py-0.5 text-xs font-medium rounded-full',
                        isConfirmed ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' :
                        isInProgress ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' :
                        booking.status === 'COMPLETED' ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' :
                        'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'].join(' ')}>{booking.status}</span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {formatDate(booking.created_at)} | {formatCurrency(booking.amount_charged)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isConfirmed && (
                      <button onClick={function () { handleOwnerNoShow(booking.id) }}
                        className="px-3 py-1.5 text-xs font-medium text-amber-500 hover:text-white hover:bg-amber-500 border border-amber-200 dark:border-amber-800 rounded-lg hover:border-amber-500 transition-all flex items-center gap-1">
                        <FiXCircle className="w-3.5 h-3.5" /> No Show
                      </button>
                    )}
                    {isInProgress && (
                      <button onClick={function () { handleOwnerComplete(booking.id) }}
                        className="px-3 py-1.5 text-xs font-medium text-blue-500 hover:text-white hover:bg-blue-500 border border-blue-200 dark:border-blue-800 rounded-lg hover:border-blue-500 transition-all flex items-center gap-1">
                        <FiCheckCircle className="w-3.5 h-3.5" /> Force Complete
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <Pagination page={bookingPage} totalPages={bookingTotalPages} onPageChange={setBookingPage} />
      </div>
    </div>
  )
}

function MapPinPicker(props) {
  var mapRef = useRef(null)
  var mapInstanceRef = useRef(null)
  var markerRef = useRef(null)
  var initialLat = props.lat || 12.9716
  var initialLng = props.lng || 77.5946

  useEffect(function () {
    if (mapInstanceRef.current) return
    var L = window.L
    if (!L) {
      var script = document.createElement('script')
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.onload = initMap
      document.head.appendChild(script)
      var link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    } else { initMap() }

    function initMap() {
      var L = window.L
      var map = L.map(mapRef.current, { zoomControl: true }).setView([initialLat, initialLng], 13)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(map)
      var marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map)
      markerRef.current = marker
      marker.on('dragend', function () { var pos = marker.getLatLng(); props.onPick(pos.lat, pos.lng) })
      map.on('click', function (e) { marker.setLatLng(e.latlng); props.onPick(e.latlng.lat, e.latlng.lng) })
      mapInstanceRef.current = map
    }
    return function () { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null } }
  }, [])

  return (
    <div className="rounded-xl overflow-hidden border border-gray-300 dark:border-gray-700">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900">
        <span className="text-xs text-gray-500">Click the map or drag the pin to set location</span>
        <button onClick={props.onClose} className="text-xs text-gray-500 hover:text-gray-700">Done</button>
      </div>
      <div ref={mapRef} style={{ height: '250px', width: '100%' }} />
    </div>
  )
}
