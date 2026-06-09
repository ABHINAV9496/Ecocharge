/*
  Driver Dashboard
  ----------------
  The main page for DRIVER users after they log in.

  What it shows:
  1. Profile card — see and edit car model, battery capacity, phone number
  2. Wallet balance card (reuses WalletCard component)
  3. My Bookings list — see current and past bookings, cancel active ones

  Editing profile:
  - Click "Edit" to switch to edit mode
  - Change car model, battery capacity, or phone number
  - Click "Save Changes" to update via the API
  - Click "Cancel" to discard changes
*/

import { useState, useEffect } from 'react'
import { FiUser, FiTruck, FiBatteryCharging, FiCalendar, FiX } from 'react-icons/fi'
import { getProfile, updateProfile } from '../../api/auth'
import { getBookings, cancelBooking } from '../../api/bookings'
import { formatCurrency, formatDate, ROLE_LABELS } from '../../utils/formatters'
import WalletCard from '../wallet/WalletCard'

// ----------------------------------------------------------------
// MAIN COMPONENT: Driver Dashboard
// ----------------------------------------------------------------
export default function DriverDashboard() {
  // ---- STATE ----
  var [profile, setProfile] = useState(null)  // User profile data from API
  var [bookings, setBookings] = useState([])   // User's booking history
  var [editing, setEditing] = useState(false)  // Is the profile edit form visible?
  var [form, setForm] = useState({})           // Form values during profile editing
  var [loading, setLoading] = useState(true)   // Loading state
  var [profileError, setProfileError] = useState('')  // Error fetching profile
  var [updateError, setUpdateError] = useState('')    // Error updating profile

  // ---- FETCH PROFILE + BOOKINGS ON MOUNT ----
  useEffect(function () {
    async function loadData() {
      try {
        var profileResponse = await getProfile()
        var bookingResponse = await getBookings()
        setProfile(profileResponse.data)
        setForm(profileResponse.data)
        setBookings(bookingResponse.data)
      } catch (error) {
        console.error('Failed to load driver data:', error)
        setProfileError('Could not load your profile. Make sure the backend is running.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // ---- HANDLE PROFILE UPDATE ----
  async function handleUpdate() {
    try {
      var response = await updateProfile(form)
      setProfile(response.data)
      setEditing(false)
      setUpdateError('')
    } catch (error) {
      // CASE: Form validation error from the API
      var errorMsg = 'Failed to update profile'
      if (error.response && error.response.data) {
        // Django DRF returns field-level errors as objects
        var apiErrors = error.response.data
        errorMsg = Object.values(apiErrors).flat().join(', ') || errorMsg
      }
      setUpdateError(errorMsg)
      console.error('Profile update error:', errorMsg)
    }
  }

  // ---- HANDLE CANCEL BOOKING ----
  async function handleCancel(bookingId) {
    try {
      await cancelBooking(bookingId)
      // Remove the cancelled booking from the local list so it disappears immediately
      setBookings(bookings.filter(function (b) { return b.id !== bookingId }))
    } catch (error) {
      console.error('Failed to cancel booking ' + bookingId + ':', error)
      alert('Could not cancel booking. Please try again.')
    }
  }

  // ---- HELPER: Update a form field ----
  function updateFormField(fieldName, value) {
    var updated = Object.assign({}, form)
    updated[fieldName] = value
    setForm(updated)
  }

  // ---- LOADING STATE ----
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  // ---- ERROR STATE ----
  if (profileError) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <FiX className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-600 dark:text-red-400">{profileError}</p>
        </div>
      </div>
    )
  }

  // ---- MAIN RENDER ----
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">

      {/* ---- PAGE HEADER ---- */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center">
          <FiUser className="w-5 h-5 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Driver Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage your profile and bookings</p>
        </div>
      </div>

      {/* ---- SECTION: Profile + Wallet ---- */}
      {profile && (function () {
        return (
          <div className="grid md:grid-cols-3 gap-6">

            {/* Profile Card (spans 2 columns) */}
            <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Profile</h2>
                <button
                  onClick={function () { setEditing(!editing) }}
                  className="text-sm font-medium text-emerald-500 hover:text-emerald-600 transition-colors"
                >
                  {editing ? 'Cancel' : 'Edit'}
                </button>
              </div>

              {/* CASE: Edit mode — show form fields */}
              {editing ? (function () {
                return (
                  <div className="space-y-4">
                    {/* Update error message */}
                    {updateError && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl">
                        {updateError}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                          Car Model
                        </label>
                        <input
                          type="text"
                          value={form.car_model || ''}
                          onChange={function (e) { updateFormField('car_model', e.target.value) }}
                          className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                          placeholder="e.g. Tata Nexon EV"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                          Battery Capacity (kWh)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={form.battery_capacity_kwh || ''}
                          onChange={function (e) { updateFormField('battery_capacity_kwh', parseFloat(e.target.value) || '') }}
                          className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                          placeholder="e.g. 30.2"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                        Phone Number
                      </label>
                      <input
                        type="text"
                        value={form.phone_number || ''}
                        onChange={function (e) { updateFormField('phone_number', e.target.value) }}
                        className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                        placeholder="+91 98765 43210"
                      />
                    </div>
                    <button
                      onClick={handleUpdate}
                      className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-medium rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/20"
                    >
                      Save Changes
                    </button>
                  </div>
                )
              })() : 

              /* CASE: View mode — show profile info */
              (function () {
                return (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/40 dark:to-emerald-800/20 rounded-2xl flex items-center justify-center">
                        <FiUser className="w-7 h-7 text-emerald-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-lg text-gray-900 dark:text-white">{profile.username}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{profile.email}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="flex items-center gap-2.5 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                        <FiTruck className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-400 dark:text-gray-500">Car Model</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{profile.car_model || 'Not set'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                        <FiBatteryCharging className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-400 dark:text-gray-500">Battery</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{profile.battery_capacity_kwh} kWh</p>
                        </div>
                      </div>
                    </div>
                    {profile.phone_number && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Phone: {profile.phone_number}
                      </p>
                    )}
                  </div>
                )
              })()
              }
            </div>

            {/* Wallet Card (1 column) */}
            <div>
              <WalletCard />
            </div>
          </div>
        )
      })()}

      {/* ---- SECTION: My Bookings ---- */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          My Bookings
        </h2>

        {/* CASE: No bookings */}
        {bookings.length === 0 ? (
          <div className="text-center py-10">
            <FiCalendar className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No bookings yet. Find a station on the map to get started!
            </p>
          </div>
        ) : (

          /* CASE: Booking list */
          <div className="space-y-2">
            {bookings.map(function (booking) {
              var stationName = booking.slot_details
                ? booking.slot_details.station_name
                : 'Slot #' + booking.slot

              var isActive = booking.status === 'CONFIRMED'

              return (
                <div
                  key={booking.id}
                  className={[
                    'flex items-center justify-between p-4 rounded-xl transition-colors',
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-3">
                    <div className={[
                      'w-9 h-9 rounded-lg flex items-center justify-center',
                      isActive ? 'bg-emerald-100 dark:bg-emerald-800' : 'bg-gray-200 dark:bg-gray-700',
                    ].join(' ')}>
                      <FiCalendar className={[
                        'w-4 h-4',
                        isActive ? 'text-emerald-500' : 'text-gray-400',
                      ].join(' ')} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {stationName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(booking.start_time)}
                        {' · '}
                        <span className={isActive ? 'text-emerald-500 font-medium' : ''}>
                          {booking.status}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {formatCurrency(booking.amount_charged)}
                    </span>
                    {isActive && (
                      <button
                        onClick={function () { handleCancel(booking.id) }}
                        className="px-3 py-1.5 text-xs font-medium text-red-500 hover:text-white hover:bg-red-500 border border-red-200 dark:border-red-800 rounded-lg hover:border-red-500 transition-all"
                      >
                        Cancel
                      </button>
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
