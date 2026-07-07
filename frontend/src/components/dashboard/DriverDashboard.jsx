import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiUser, FiTruck, FiBatteryCharging, FiCalendar, FiX, FiBarChart2, FiMap, FiNavigation, FiBell, FiDollarSign, FiPlus, FiArrowRight, FiPhone, FiPlay, FiCheckCircle } from 'react-icons/fi'
import { getProfile, updateProfile } from '../../api/auth'
import { getBookings, cancelBooking, startCharging, completeCharging } from '../../api/bookings'
import { getTrips } from '../../api/trips'
import { getNotifications } from '../../api/notifications'
import { formatCurrency, getSlotTypeColor } from '../../utils/formatters'
import { useToast } from '../../context/ToastContext'
import { SkeletonStats } from '../layout/Skeleton'
import PaymentHistoryCard from '../payments/PaymentHistoryCard'
import CurrentWeatherWidget from '../weather/CurrentWeatherWidget'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

function formatDateShort(dateStr) {
  if (!dateStr) return ''
  var d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(dateStr) {
  if (!dateStr) return ''
  var d = new Date(dateStr)
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export default function DriverDashboard() {
  var [profile, setProfile] = useState(null)
  var [bookings, setBookings] = useState([])
  var [editing, setEditing] = useState(false)
  var [form, setForm] = useState({})
  var [loading, setLoading] = useState(true)
  var [trips, setTrips] = useState([])
  var [unreadCount, setUnreadCount] = useState(0)

  var navigate = useNavigate()
  var showToast = useToast()
  var [profileError, setProfileError] = useState('')
  var [bookingError, setBookingError] = useState('')
  var [updateError, setUpdateError] = useState('')

  useEffect(function () {
    async function loadData() {
      try {
        var profileResponse = await getProfile()
        setProfile(profileResponse.data)
        setForm(profileResponse.data)
      } catch (error) {
        console.error('Failed to load profile:', error)
        setProfileError('Could not load your profile. Make sure the backend is running.')
      }

      try {
        var bookingResponse = await getBookings()
        setBookings(bookingResponse.data)
      } catch (error) {
        console.error('Failed to load bookings:', error)
        setBookingError('Could not load bookings.')
      }

      try {
        var tripsRes = await getTrips()
        setTrips(tripsRes.data || [])
      } catch (e) { /* ignore */ }

      try {
        var notifRes = await getNotifications({ page: 1, page_size: 1 })
        setUnreadCount(notifRes.data.unread_count || 0)
      } catch (e) { /* ignore */ }

      setLoading(false)
    }

    loadData()
  }, [])

  async function handleUpdate() {
    try {
      var response = await updateProfile(form)
      setProfile(response.data)
      setEditing(false)
      setUpdateError('')
      showToast('Profile updated successfully', 'success')
    } catch (error) {
      var errorMsg = 'Failed to update profile'
      if (error.response && error.response.data) {
        var apiErrors = error.response.data
        errorMsg = Object.values(apiErrors).flat().join(', ') || errorMsg
      }
      setUpdateError(errorMsg)
      console.error('Profile update error:', errorMsg)
    }
  }

  async function handleCancel(bookingId) {
    try {
      await cancelBooking(bookingId)
      setBookings(bookings.filter(function (b) { return b.id !== bookingId }))
      showToast('Booking cancelled successfully', 'success')
    } catch (error) {
      console.error('Failed to cancel booking ' + bookingId + ':', error)
      showToast('Could not cancel booking. Please try again.', 'error')
    }
  }

  async function handleStartCharging(bookingId) {
    try {
      var res = await startCharging(bookingId)
      setBookings(bookings.map(function (b) {
        return b.id === bookingId ? res.data : b
      }))
      showToast('Charging started!', 'success')
    } catch (error) {
      var msg = 'Could not start charging.'
      if (error.response && error.response.data && error.response.data.error) {
        msg = error.response.data.error
      }
      console.error('Failed to start charging ' + bookingId + ':', error)
      showToast(msg, 'error')
    }
  }

  async function handleCompleteCharging(bookingId) {
    try {
      var res = await completeCharging(bookingId)
      setBookings(bookings.map(function (b) {
        return b.id === bookingId ? res.data : b
      }))
      showToast('Charging completed!', 'success')
    } catch (error) {
      var msg = 'Could not complete charging.'
      if (error.response && error.response.data && error.response.data.error) {
        msg = error.response.data.error
      }
      console.error('Failed to complete charging ' + bookingId + ':', error)
      showToast(msg, 'error')
    }
  }

  function updateFormField(fieldName, value) {
    var updated = Object.assign({}, form)
    updated[fieldName] = value
    setForm(updated)
  }

  var activeBookings = bookings.filter(function (b) { return b.status === 'CONFIRMED' })

  var totalDistance = trips.reduce(function (s, t) { return s + (t.distance_km || 0) }, 0)
  var totalChargingCost = trips.reduce(function (s, t) { return s + parseFloat(t.total_cost || 0) }, 0)
  var hasChartData = bookings.length >= 2

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-8 space-y-6">
        <div className="h-8 w-56 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <SkeletonStats count={3} />
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="h-[280px] rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
            <div className="h-[340px] rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          </div>
          <div className="space-y-6">
            <div className="h-48 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
            <div className="h-48 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          </div>
        </div>
        <div className="h-64 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-6">

      {profileError && (
        <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl flex items-center gap-2">
          <FiX className="w-4 h-4 shrink-0" />
          {profileError}
        </div>
      )}

      {/* ---- HEADER ---- */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center">
            <FiUser className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Welcome back{profile ? ', ' + (profile.username || '') : ''}!</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={function () { navigate('/notifications') }} className="relative p-2 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" aria-label={unreadCount + ' unread notifications'}>
              <FiBell className="w-5 h-5 text-gray-500" />
              <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center min-w-[18px] px-1">{unreadCount > 9 ? '9+' : unreadCount}</span>
            </button>
          )}
        </div>
      </div>

      {/* ---- STATISTICS CARDS ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <FiNavigation className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">Trips</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{trips.length}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{totalDistance.toFixed(0)} km total</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <FiCalendar className="w-3.5 h-3.5 text-violet-500" />
            <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">Bookings</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{bookings.length}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{activeBookings.length > 0 ? activeBookings.length + ' active' : 'No active bookings'}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <FiDollarSign className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">Charging Cost</span>
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{'\u20B9' + Math.round(totalChargingCost).toLocaleString('en-IN')}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Across all trips</div>
        </div>
      </div>

      {/* ---- MIDDLE: 2-COLUMN GRID ---- */}
      {profile && (
        <div className="grid md:grid-cols-3 gap-6 items-start">

          {/* LEFT COLUMN: Profile + Chart */}
          <div className="md:col-span-2 space-y-6">

            {/* Profile Card — spacious, balanced height */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Profile</h2>
                <button
                  onClick={function () { setEditing(!editing) }}
                  className="text-xs font-medium text-emerald-500 hover:text-emerald-600 transition-colors px-2.5 py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                >
                  {editing ? 'Cancel' : 'Edit'}
                </button>
              </div>

              {editing ? (
                <div className="space-y-4">
                  {updateError && (
                    <div className="p-2.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-xl">
                      {updateError}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Car Model</label>
                      <input type="text" value={form.car_model || ''} onChange={function (e) { updateFormField('car_model', e.target.value) }}
                        className="w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        placeholder="e.g. Tata Nexon EV" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Battery (kWh)</label>
                      <input type="number" step="0.1" value={form.battery_capacity_kwh || ''} onChange={function (e) { updateFormField('battery_capacity_kwh', parseFloat(e.target.value) || '') }}
                        className="w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        placeholder="e.g. 30.2" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Phone Number</label>
                    <input type="text" value={form.phone_number || ''} onChange={function (e) { updateFormField('phone_number', e.target.value) }}
                      className="w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                      placeholder="+91 98765 43210" />
                  </div>
                  <button onClick={handleUpdate}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-medium rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-md shadow-emerald-500/20">
                    Save Changes
                  </button>
                </div>
              ) : (
                <div className="flex items-start gap-5">
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/40 dark:to-emerald-800/20 rounded-xl flex items-center justify-center shrink-0">
                    <FiUser className="w-7 h-7 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="mb-2">
                      <span className="text-base font-semibold text-gray-900 dark:text-white">{profile.username}</span>
                    </div>
                    <div className="mb-4">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{profile.email}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-center gap-2 px-4 py-5 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <FiTruck className="w-4 h-4 text-gray-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs text-gray-400 dark:text-gray-500 leading-tight">Vehicle</div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate leading-tight">{profile.car_model || 'Not set'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-4 py-5 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <FiBatteryCharging className="w-4 h-4 text-gray-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs text-gray-400 dark:text-gray-500 leading-tight">Battery</div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white leading-tight">{profile.battery_capacity_kwh ? profile.battery_capacity_kwh + ' kWh' : 'Not set'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-4 py-5 bg-gray-50 dark:bg-gray-900 rounded-lg sm:col-span-2">
                        <FiPhone className="w-4 h-4 text-gray-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs text-gray-400 dark:text-gray-500 leading-tight">Phone</div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate leading-tight">{profile.phone_number || 'Not set'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Booking Cost Chart — directly below profile */}
            {hasChartData ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <div className="flex items-center mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <FiBarChart2 className="w-4 h-4 text-gray-400" />
                    Booking Costs
                  </h3>
                </div>
                {(function () {
                  var chartData = bookings.slice(-30).map(function (b) {
                    return {
                      label: formatDateShort(b.start_time || b.created_at).split(',')[0],
                      cost: parseFloat(b.amount_charged || 0),
                      station: b.slot_details ? b.slot_details.station_name : 'Unknown',
                    }
                  })
                  if (chartData.length === 0) {
                    return <div className="flex items-center justify-center h-24 text-xs text-gray-400 dark:text-gray-500">No bookings in this period</div>
                  }
                  return (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.3} />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false}
                          tickFormatter={function (v) { return '\u20B9' + v.toLocaleString('en-IN') }} />
                        <Tooltip
                          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
                          labelStyle={{ color: '#e5e7eb', fontWeight: 600, marginBottom: 4 }}
                          formatter={function (value) {
                            return ['\u20B9' + Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 }), 'Cost']
                          }}
                          labelFormatter={function (label, payload) {
                            if (payload && payload[0]) return payload[0].payload.station || label
                            return label
                          }}
                        />
                        <Bar dataKey="cost" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  )
                })()}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <FiBarChart2 className="w-4 h-4 text-gray-400" />
                  Booking Costs
                </h3>
                <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
                  <FiBarChart2 className="w-8 h-8 mb-2" />
                  <p className="text-sm">Not enough booking data</p>
                  <p className="text-xs mt-1">Complete at least 2 bookings to see cost trends</p>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Payments + Weather */}
          <div className="space-y-6">
            <PaymentHistoryCard />
            <CurrentWeatherWidget />
          </div>
        </div>
      )}

      {/* ---- MY BOOKINGS ---- */}
      <div id="booking-section" className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">My Bookings</h2>
          <button onClick={function () { navigate('/map') }} className="text-xs font-medium text-emerald-500 hover:text-emerald-600 transition-colors flex items-center gap-1">
            <FiPlus className="w-3 h-3" /> New Booking
          </button>
        </div>

        {bookingError && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 text-xs rounded-xl">
            {bookingError}
          </div>
        )}

        {bookings.length === 0 ? (
          <div className="text-center py-6">
            <FiCalendar className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No bookings yet. Find a station on the map to get started!</p>
            <button onClick={function () { navigate('/map') }} className="mt-3 px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-medium rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-md shadow-emerald-500/20">
              Find Stations
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map(function (booking) {
              var stationName = booking.slot_details
                ? booking.slot_details.station_name
                : 'Slot #' + booking.slot
              var isConfirmed = booking.status === 'CONFIRMED'
              var isInProgress = booking.status === 'IN_PROGRESS'
              var isCompleted = booking.status === 'COMPLETED'
              var slotType = booking.slot_details ? booking.slot_details.slot_type : null
              var sc = slotType ? getSlotTypeColor(slotType) : null

              var cardStyle = isConfirmed
                ? 'bg-emerald-50/80 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800'
                : isInProgress
                  ? 'bg-blue-50/80 dark:bg-blue-900/15 border border-blue-200 dark:border-blue-800'
                  : 'bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800'
              var iconStyle = isConfirmed
                ? 'bg-emerald-100 dark:bg-emerald-800 text-emerald-500'
                : isInProgress
                  ? 'bg-blue-100 dark:bg-blue-800 text-blue-500'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
              var statusTextStyle = isConfirmed
                ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                : isInProgress
                  ? 'text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-gray-500'

              return (
                <div key={booking.id}
                  className={'flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl transition-all ' + cardStyle}>

                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ' + iconStyle}>
                      <FiCalendar className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-[300px]">{stationName}</p>
                        {slotType && sc && (
                          <span className={'text-[10px] font-medium px-1.5 py-0.5 rounded-md leading-none'} style={{ background: sc.bg, color: sc.text }}>
                            {slotType === 'DC_ULTRA' ? 'DC Ultra' : slotType === 'DC_FAST' ? 'DC Fast' : slotType === 'AC_FAST' ? 'AC Fast' : slotType === 'AC_SLOW' ? 'AC Slow' : slotType}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5 text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 flex-wrap">
                        <span>{formatDateShort(booking.start_time)}</span>
                        {booking.start_time && <><span className="text-gray-300 dark:text-gray-600">|</span><span>{formatTime(booking.start_time)}</span></>}
                        <span className="text-gray-300 dark:text-gray-600">|</span>
                        <span className={statusTextStyle}>{booking.status}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 ml-auto sm:ml-0">
                    <span className="text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">{formatCurrency(booking.amount_charged)}</span>
                    {isConfirmed && (
                      <>
                        <button onClick={function () { handleStartCharging(booking.id) }}
                          className="px-2.5 py-1.5 text-[11px] font-medium text-emerald-500 hover:text-white hover:bg-emerald-500 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:border-emerald-500 transition-all flex items-center gap-1">
                          <FiPlay className="w-3 h-3" /> Start
                        </button>
                        <button onClick={function () { handleCancel(booking.id) }}
                          className="px-2.5 py-1.5 text-[11px] font-medium text-red-500 hover:text-white hover:bg-red-500 border border-red-200 dark:border-red-800 rounded-lg hover:border-red-500 transition-all">
                          Cancel
                        </button>
                      </>
                    )}
                    {isInProgress && (
                      <button onClick={function () { handleCompleteCharging(booking.id) }}
                        className="px-2.5 py-1.5 text-[11px] font-medium text-blue-500 hover:text-white hover:bg-blue-500 border border-blue-200 dark:border-blue-800 rounded-lg hover:border-blue-500 transition-all flex items-center gap-1">
                        <FiCheckCircle className="w-3 h-3" /> End
                      </button>
                    )}
                    {isCompleted && (
                      <span className="px-2.5 py-1.5 text-[11px] font-medium text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 rounded-lg">
                        Completed
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
