/*
  Station Owner Dashboard
  -----------------------
  For users with the STATION_OWNER role.

  What it does:
  1. Shows key stats — station count, slot count, revenue, active bookings
  2. Lists all stations owned by this user
  3. Each station can be edited or deleted
  4. Owner can add slots to any station (AC Slow, AC Fast, DC Fast, DC Ultra)
  5. Add new stations with name, address, location, and amenities
*/

import { useState, useEffect, useRef } from 'react'
import { FiPlus, FiMapPin, FiTrendingUp, FiCalendar, FiZap, FiDollarSign, FiEdit2, FiTrash2, FiCrosshair } from 'react-icons/fi'
import { getStations, createStation, updateStation, deleteStation, createSlot } from '../../api/stations'
import { getBookings } from '../../api/bookings'
import { formatCurrency, formatDate, SLOT_TYPE_LABELS } from '../../utils/formatters'
import { useToast } from '../../context/ToastContext'
import { SkeletonStats } from '../layout/Skeleton'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

// ----------------------------------------------------------------
// MAIN COMPONENT: Station Owner Dashboard
// ----------------------------------------------------------------
export default function StationOwnerDashboard() {
  // ---- STATE ----
  var [stations, setStations] = useState([])      // List of owned stations
  var [bookings, setBookings] = useState([])       // Bookings for owned stations
  var [showForm, setShowForm] = useState(false)     // Is the add/edit station form visible?
  var [editingStation, setEditingStation] = useState(null)  // Station being edited (null = adding new)
  var [form, setForm] = useState({                 // Add/edit station form fields
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    amenities: '',
    status: 'ACTIVE',
  })
  var [loading, setLoading] = useState(true)       // Loading indicator
  var [slotForm, setSlotForm] = useState({         // Add slot form fields
    stationId: null,
    slot_type: 'AC_FAST',
    rate_per_kwh: '',
    off_peak_rate: '',
  })
  var [error, setError] = useState('')             // Error message
  var [formError, setFormError] = useState('')     // Form submission error
  var [slotError, setSlotError] = useState('')     // Slot creation error
  var [showMapPicker, setShowMapPicker] = useState(false)
  var showToast = useToast()

  // ---- FETCH DATA ON MOUNT ----
  useEffect(function () {
    async function loadData() {
      try {
        var stationsResponse = await getStations()
        var bookingsResponse = await getBookings()
        setStations(stationsResponse.data)
        setBookings(bookingsResponse.data)
      } catch (error) {
        console.error('Failed to load owner data:', error)
        setError('Could not load your stations. Make sure the backend is running.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // ---- COMPUTED STATS ----
  var stationCount = stations.length
  var slotCount = stations.reduce(function (sum, station) {
    return sum + (station.slots ? station.slots.length : 0)
  }, 0)
  var revenue = bookings
    .filter(function (b) { return b.status === 'CONFIRMED' || b.status === 'COMPLETED' })
    .reduce(function (sum, b) { return sum + parseFloat(b.amount_charged || 0) }, 0)
  var activeBookings = bookings.filter(function (b) { return b.status === 'CONFIRMED' }).length

  // ---- HANDLE: Create or Update Station ----
  async function handleSaveStation() {
    setFormError('')

    try {
      // Build the payload from the form
      var payload = {
        name: form.name,
        address: form.address,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        status: form.status,
        amenities: form.amenities
          ? form.amenities.split(',').map(function (a) { return a.trim() })
          : [],
      }

      if (editingStation) {
        // CASE: Updating an existing station
        await updateStation(editingStation.id, payload)
      } else {
        // CASE: Creating a new station
        await createStation(payload)
      }

      // Refresh the station list from the API
      var freshStations = await getStations()
      setStations(freshStations.data)

      // Reset the form
      resetStationForm()

      showToast(editingStation ? 'Station updated successfully' : 'Station created successfully', 'success')
    } catch (error) {
      var errorMsg = 'Failed to save station'
      if (error.response && error.response.data) {
        errorMsg = Object.values(error.response.data).flat().join(', ') || errorMsg
      }
      setFormError(errorMsg)
      showToast(errorMsg, 'error')
      console.error('Station save error:', errorMsg)
    }
  }

  // ---- HANDLE: Delete Station ----
  async function handleDeleteStation(stationId) {
    if (!window.confirm('Are you sure you want to delete this station? This action cannot be undone.')) {
      return
    }

    try {
      await deleteStation(stationId)
      // Remove the deleted station from the local list
      setStations(stations.filter(function (s) { return s.id !== stationId }))
      showToast('Station deleted successfully', 'success')
    } catch (error) {
      console.error('Failed to delete station ' + stationId + ':', error)
      showToast('Could not delete station. It may have active bookings.', 'error')
    }
  }

  // ---- HANDLE: Add Slot to Station ----
  async function handleAddSlot(stationId) {
    setSlotError('')

    if (!slotForm.rate_per_kwh) {
      setSlotError('Please enter a rate per kWh')
      return
    }

    try {
      await createSlot(stationId, {
        slot_type: slotForm.slot_type,
        rate_per_kwh: parseFloat(slotForm.rate_per_kwh),
        off_peak_rate: slotForm.off_peak_rate ? parseFloat(slotForm.off_peak_rate) : null,
      })
      showToast('Slot added successfully', 'success')

      // Reset slot form
      setSlotForm({ stationId: null, slot_type: 'AC_FAST', rate_per_kwh: '', off_peak_rate: '' })

      // Refresh the full station list
      var freshStations = await getStations()
      setStations(freshStations.data)

    } catch (error) {
      var errorMsg = 'Failed to add slot'
      if (error.response && error.response.data) {
        errorMsg = Object.values(error.response.data).flat().join(', ') || errorMsg
      }
      setSlotError(errorMsg)
      console.error('Slot creation error:', errorMsg)
    }
  }

  // ---- HELPER: Open edit form for a station ----
  function startEditStation(station) {
    setEditingStation(station)
    setForm({
      name: station.name || '',
      address: station.address || '',
      latitude: station.latitude || '',
      longitude: station.longitude || '',
      amenities: (station.amenities || []).join(', '),
      status: station.status || 'ACTIVE',
    })
    setShowForm(true)
  }

  // ---- HELPER: Reset the add station form ----
  function resetStationForm() {
    setShowForm(false)
    setEditingStation(null)
    setForm({ name: '', address: '', latitude: '', longitude: '', amenities: '', status: 'ACTIVE' })
    setFormError('')
  }

  // ---- LOADING STATE ----
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="h-8 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mb-6" />
        <SkeletonStats count={4} />
      </div>
    )
  }

  // ---- MAIN RENDER ----
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">

      {/* Page-level error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl">
          {error}
        </div>
      )}

      {/* ---- PAGE HEADER ---- */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center">
          <FiMapPin className="w-5 h-5 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Station Owner Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage your charging stations and slots</p>
        </div>
      </div>

      {/* ---- STATS CARDS ---- */}
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
        var hasBookings = bookings.length > 0
        var hasSlots = stations.some(function (s) { return (s.slots || []).length > 0 })

        if (!hasBookings && !hasSlots) {
          return (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Revenue Trend</h3>
                <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
                  <FiTrendingUp className="w-8 h-8 mb-2" />
                  <p className="text-sm">No revenue data yet</p>
                  <p className="text-xs mt-1">Bookings will appear here once drivers use your stations</p>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Slot Distribution</h3>
                <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
                  <FiZap className="w-8 h-8 mb-2" />
                  <p className="text-sm">No slots configured</p>
                  <p className="text-xs mt-1">Add slots to your stations to see distribution</p>
                </div>
              </div>
            </div>
          )
        }

        var revenueByDate = {}
        bookings
          .filter(function (b) { return b.status === 'CONFIRMED' || b.status === 'COMPLETED' })
          .forEach(function (b) {
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

        return (
          <div className="grid md:grid-cols-2 gap-4">
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
                  <p className="text-xs mt-1">Need at least 2 bookings with revenue to show a trend</p>
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
                  <p className="text-xs mt-1">Add slots to your stations to see distribution</p>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* ---- SECTION: Station List + Add Button ---- */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">My Stations</h2>
          <button
            onClick={function () { resetStationForm(); setShowForm(!showForm) }}
            className={[
              'flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl transition-all',
              showForm
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-emerald-700',
            ].join(' ')}
          >
            <FiPlus className="w-4 h-4" />
            {showForm ? 'Cancel' : 'Add Station'}
          </button>
        </div>

        {/* ---- Add / Edit Station Form ---- */}
        {showForm && (
          <div className="p-5 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 animate-fadeIn">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
              {editingStation ? 'Edit Station' : 'New Station'}
            </h3>

            {formError && (
              <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <input
                type="text" placeholder="Station Name" value={form.name}
                onChange={function (e) { setForm(Object.assign({}, form, { name: e.target.value })) }}
                className="px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
              <input
                type="text" placeholder="Address" value={form.address}
                onChange={function (e) { setForm(Object.assign({}, form, { address: e.target.value })) }}
                className="px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
              <div className="relative">
                <input
                  type="number" step="any" placeholder="Latitude" value={form.latitude}
                  onChange={function (e) { setForm(Object.assign({}, form, { latitude: e.target.value })) }}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
              </div>
              <div className="relative flex items-center gap-2">
                <input
                  type="number" step="any" placeholder="Longitude" value={form.longitude}
                  onChange={function (e) { setForm(Object.assign({}, form, { longitude: e.target.value })) }}
                  className="flex-1 px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
                <button
                  type="button"
                  onClick={function () { setShowMapPicker(!showMapPicker) }}
                  className="shrink-0 px-3 py-2.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all flex items-center gap-1"
                  title="Pick location on map"
                >
                  <FiCrosshair className="w-3.5 h-3.5" />
                  Map
                </button>
              </div>
              {showMapPicker && (
                <div className="col-span-2">
                  <MapPinPicker
                    lat={form.latitude ? parseFloat(form.latitude) : 12.9716}
                    lng={form.longitude ? parseFloat(form.longitude) : 77.5946}
                    onPick={function (lat, lng) {
                      setForm(Object.assign({}, form, { latitude: lat.toString(), longitude: lng.toString() }))
                      setShowMapPicker(false)
                    }}
                    onClose={function () { setShowMapPicker(false) }}
                  />
                </div>
              )}
              <input
                type="text" placeholder="Amenities (comma-separated)" value={form.amenities}
                onChange={function (e) { setForm(Object.assign({}, form, { amenities: e.target.value })) }}
                className="px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
              <select
                value={form.status}
                onChange={function (e) { setForm(Object.assign({}, form, { status: e.target.value })) }}
                className="px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
            </div>
            <button
              onClick={handleSaveStation}
              className="mt-3 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-medium rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/20"
            >
              {editingStation ? 'Update Station' : 'Create Station'}
            </button>
          </div>
        )}

        {/* ---- Station List ---- */}
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

              return (
                <div key={station.id} className="p-5">

                  {/* Row 1: Station info + action buttons */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{station.name}</h3>
                        <span className={[
                          'px-2 py-0.5 text-xs font-medium rounded-full',
                          station.status === 'ACTIVE' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' :
                          station.status === 'MAINTENANCE' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400' :
                          'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
                        ].join(' ')}>
                          {station.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{station.address}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={function () { startEditStation(station) }}
                        className="p-2 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all"
                        title="Edit station"
                      >
                        <FiEdit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={function () { handleDeleteStation(station.id) }}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                        title="Delete station"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Slot list */}
                  <div className="space-y-1.5 mb-3">
                    {slots.map(function (slot) {
                      var statusColor = slot.status === 'AVAILABLE' ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' :
                        slot.status === 'OCCUPIED' ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' :
                        'text-red-500 bg-red-50 dark:bg-red-900/20'

                      return (
                        <div key={slot.id} className="flex items-center justify-between px-3.5 py-2 bg-gray-50 dark:bg-gray-900 rounded-xl text-sm">
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {SLOT_TYPE_LABELS[slot.slot_type] || slot.slot_type}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">
                              {'\u20B9'}{slot.rate_per_kwh}
                            </span>
                            {slot.off_peak_rate && (
                              <span className="text-emerald-500 dark:text-emerald-400 text-xs">
                                {'\u20B9'}{slot.off_peak_rate} off-peak
                              </span>
                            )}
                            <span className={'px-2 py-0.5 text-xs font-medium rounded-full ' + statusColor}>
                              {slot.status}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Row 3: Add slot section */}
                  {slotForm.stationId === station.id ? (function () {
                    return (
                      <div className="mt-2">
                        {slotError && (
                          <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded-xl">
                            {slotError}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <select
                            value={slotForm.slot_type}
                            onChange={function (e) { setSlotForm(Object.assign({}, slotForm, { slot_type: e.target.value })) }}
                            className="flex-1 px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none"
                          >
                            <option value="AC_SLOW">AC Slow</option>
                            <option value="AC_FAST">AC Fast</option>
                            <option value="DC_FAST">DC Fast</option>
                            <option value="DC_ULTRA">DC Ultra</option>
                          </select>
                          <input
                            type="number" placeholder="Rate" value={slotForm.rate_per_kwh}
                            onChange={function (e) { setSlotForm(Object.assign({}, slotForm, { rate_per_kwh: e.target.value })) }}
                            className="w-20 px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none"
                            title="Rate per kWh"
                          />
                          <input
                            type="number" placeholder="Off-peak" value={slotForm.off_peak_rate}
                            onChange={function (e) { setSlotForm(Object.assign({}, slotForm, { off_peak_rate: e.target.value })) }}
                            className="w-20 px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none"
                            title="Off-peak rate (optional)"
                          />
                          <button
                            onClick={function () { handleAddSlot(station.id) }}
                            className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all"
                          >
                            Add
                          </button>
                          <button
                            onClick={function () { setSlotForm({ stationId: null, slot_type: 'AC_FAST', rate_per_kwh: '', off_peak_rate: '' }) }}
                            className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )
                  })() : (
                    <button
                      onClick={function () { setSlotForm(Object.assign({}, slotForm, { stationId: station.id })) }}
                      className="flex items-center gap-1 text-xs font-medium text-emerald-500 hover:text-emerald-600 transition-colors"
                    >
                      <FiPlus className="w-3 h-3" />
                      Add Slot
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Map Pin Picker — click a location on a Leaflet map to set lat/lng
// ----------------------------------------------------------------
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
    } else {
      initMap()
    }

    function initMap() {
      var L = window.L
      var map = L.map(mapRef.current, { zoomControl: true }).setView([initialLat, initialLng], 13)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)

      var marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map)
      markerRef.current = marker

      marker.on('dragend', function () {
        var pos = marker.getLatLng()
        props.onPick(pos.lat, pos.lng)
      })

      map.on('click', function (e) {
        marker.setLatLng(e.latlng)
        props.onPick(e.latlng.lat, e.latlng.lng)
      })

      mapInstanceRef.current = map
    }

    return function () {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  return (
    <div className="rounded-xl overflow-hidden border border-gray-300 dark:border-gray-700">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900">
        <span className="text-xs text-gray-500">Click the map or drag the pin to set location</span>
        <button
          onClick={props.onClose}
          className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          Done
        </button>
      </div>
      <div ref={mapRef} style={{ height: '250px', width: '100%' }} />
    </div>
  )
}
