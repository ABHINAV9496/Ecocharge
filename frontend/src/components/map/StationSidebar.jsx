/*
  Station Sidebar
  ---------------
  Slides in from the right when a user clicks a station marker on the map.

  What it shows:
  1. Station name, address, and amenities at the top
  2. A list of charging slots (the dock/port at that station)
  3. Each slot shows: type (AC/DC/Fast), rate, availability status
  4. DRIVER users can book an available slot with one click
  5. Wallet balance at the bottom if the user is logged in

  Slot colors:
  - Green border = Available (can be booked)
  - Orange border = Occupied (in use by someone else)
  - Red border   = Out of Service (broken / maintenance)

  How booking works:
  1. User clicks "Book" on an available slot
  2. The component sends a POST to the backend with slot ID and time range
  3. On success, the parent map refreshes to show updated slot status
  4. The wallet balance is also refreshed
*/

import { useState, useEffect } from 'react'
import { FiX, FiClock, FiDollarSign, FiBatteryCharging } from 'react-icons/fi'
import { getSlots } from '../../api/stations'
import { createBooking } from '../../api/bookings'
import { getBalance } from '../../api/wallet'
import { formatCurrency, getSlotTypeColor, SLOT_TYPE_LABELS } from '../../utils/formatters'

// ----------------------------------------------------------------
// MAIN COMPONENT: Station Sidebar
// ----------------------------------------------------------------
export default function StationSidebar(props) {
  // Destructure props for clarity
  var station = props.station
  var onClose = props.onClose
  var onBookSuccess = props.onBookSuccess
  var statuses = props.statuses
  var user = props.user

  // ---- STATE ----
  var [slots, setSlots] = useState([])       // List of charging slots for this station
  var [loading, setLoading] = useState(true)  // Loading indicator
  var [booking, setBooking] = useState(null)  // ID of the slot currently being booked (null = not booking)
  var [balance, setBalance] = useState(0)     // User's wallet balance
  var [error, setError] = useState('')        // Error message to show (empty = no error)
  var [balanceError, setBalanceError] = useState('')  // Error fetching balance

  // ---- FETCH SLOTS ----
  // This gets the list of charging slots from the backend API
  async function loadSlots() {
    setLoading(true)

    try {
      var response = await getSlots(station.id)
      setSlots(response.data)
    } catch (error) {
      console.error('Failed to load slots for station ' + station.id + ':', error)
      setSlots([])
    }

    setLoading(false)
  }

  // ---- FETCH WALLET BALANCE ----
  // Only fetches if user is logged in
  async function loadBalance() {
    try {
      var response = await getBalance()
      setBalance(response.data.balance)
      setBalanceError('')
    } catch (error) {
      console.error('Failed to load wallet balance:', error)
      setBalanceError('Could not load balance')
      setBalance(0)
    }
  }

  // ---- LOAD DATA ON MOUNT ----
  // Runs once when the component first appears or the station changes
  // For OCM stations, slots are already embedded — no need to fetch
  useEffect(function () {
    if (station.isOCM) {
      // OCM stations already have slots data from the mapper
      setSlots(station.slots || [])
      setLoading(false)
    } else {
      // Local stations need to fetch slots from the backend
      loadSlots()
    }

    if (user && !station.isOCM) {
      loadBalance()
    }
  }, [station.id, user])

  // ---- APPLY LIVE STATUS UPDATES ----
  // The WebSocket sends real-time slot status changes.
  // We overlay those updates on top of the API data here.
  var effectiveSlots = slots.map(function (slot) {
    return Object.assign({}, slot, {
      status: statuses[slot.id] || slot.status,
    })
  })

  // ---- HANDLE BOOKING ----
  // Called when the user clicks the "Book" button on an available slot
  async function handleBook(slot) {
    // Guard clause: user must be logged in as a DRIVER
    if (!user || user.role !== 'DRIVER') {
      setError('Please login as a driver to book')
      return
    }

    // CASE: Wallet balance check
    if (balance <= 0) {
      setError('Insufficient wallet balance. Please add funds.')
      return
    }

    setError('')
    setBooking(slot.id)

    try {
      // Create a 1-hour booking starting now
      var now = new Date()
      var startTime = now.toISOString()
      var endTime = new Date(now.getTime() + 60 * 60 * 1000).toISOString()

      var response = await createBooking({
        slot: slot.id,
        start_time: startTime,
        end_time: endTime,
      })

      // CASE: Booking was successful — notify the parent and refresh
      onBookSuccess('Booking confirmed at ' + station.name + '!')
      loadSlots()
      loadBalance()

    } catch (error) {
      var errorMsg = 'Booking failed'

      // Try to extract a meaningful error message from the API response
      if (error.response && error.response.data) {
        errorMsg = error.response.data.error || error.response.data.detail || errorMsg
      } else if (error.message) {
        errorMsg = error.message
      }

      setError(errorMsg)
      console.error('Booking error:', errorMsg)
    }

    setBooking(null)
  }

  // ---- CALCULATE STATS ----
  var availableCount = effectiveSlots.filter(function (s) {
    return s.status === 'AVAILABLE'
  }).length

  var totalCount = effectiveSlots.length

  // ---- RENDER ----
  return (
    <div className="w-full md:w-[420px] bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-l border-gray-200 dark:border-gray-800 overflow-y-auto shadow-2xl flex flex-col">

      {/* ---- HEADER ----
          Station name, address, and close button.
          Uses glass-morphism background with a gradient accent line. */}
      <div className="sticky top-0 z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800">
        <div className="h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600" />

        <div className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                {station.name}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                {station.address}
              </p>
            </div>
            <button
              onClick={onClose}
              className="ml-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors shrink-0"
              aria-label="Close sidebar"
            >
              <FiX className="w-5 h-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
            </button>
          </div>

          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
              <FiBatteryCharging className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {availableCount}/{totalCount} Available
              </span>
            </div>
            {station.isOCM && (
              <span className="px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg" title={station.last_updated ? 'OCM data refreshed: ' + new Date(station.last_updated).toLocaleDateString() : 'Open Charge Map data'}>
                OCM
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ---- BODY ---- */}
      <div className="flex-1 p-5 space-y-5">

        {/* ---- SECTION: Amenities ---- */}
        {station.amenities && station.amenities.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2.5">
              Amenities
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {station.amenities.map(function (amenity, index) {
                return (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-medium rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    {amenity}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* ---- SECTION: Charging Slots ---- */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Charging Slots
            </h3>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {availableCount} open / {totalCount} total
            </span>
          </div>

          {/* Error message box */}
          {error && (
            <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl flex items-center gap-2">
              <FiX className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Loading skeleton */}
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(function (item) {
                return (
                  <div
                    key={item}
                    className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse"
                  />
                )
              })}
            </div>

          ) : /* CASE: No slots found */
            effectiveSlots.length === 0 ? (
            <div className="text-center py-10">
              <FiBatteryCharging className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400 dark:text-gray-500">No charging slots found at this station</p>
            </div>

          ) : /* CASE: Slot list */
            (function () {
              var slotGroups = {'AC': [], 'DC': [], 'FAST': []}
              effectiveSlots.forEach(function (slot) {
                var type = slot.slot_type || 'AC'
                if (!slotGroups[type]) {
                  slotGroups[type] = []
                }
                slotGroups[type].push(slot)
              })

              var groupOrder = ['AC', 'DC', 'FAST']

              return (
                <div className="space-y-4">
                  {groupOrder.map(function (groupType) {
                    var groupSlots = slotGroups[groupType]
                    if (!groupSlots || groupSlots.length === 0) return null

                    return (
                      <div key={groupType}>
                        <h4 className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-2">
                          {SLOT_TYPE_LABELS[groupType] || groupType}
                        </h4>
                        <div className="space-y-2">
                          {groupSlots.map(function (slot) {
                            // Determine the visual style based on slot status
                            var statusStyles = {
                              AVAILABLE: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-900/20',
                              OCCUPIED: 'border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/20',
                              OUT_OF_SERVICE: 'border-red-200 dark:border-red-800 bg-red-50/80 dark:bg-red-900/20',
                            }

                            var statusColors = {
                              AVAILABLE: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40',
                              OCCUPIED: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40',
                              OUT_OF_SERVICE: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40',
                            }

                            var slotStyle = statusStyles[slot.status] || statusStyles.OUT_OF_SERVICE
                            var statusStyle = statusColors[slot.status] || statusColors.OUT_OF_SERVICE

                            return (
                              <div
                                key={slot.id}
                                className={'p-3.5 border rounded-xl transition-all hover:shadow-md ' + slotStyle}
                              >
                                  {/* Row 1: Slot type badge + status badge */}
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className={'px-2 py-0.5 text-xs font-medium rounded-full ' + getSlotTypeColor(slot.slot_type)}>
                                      {SLOT_TYPE_LABELS[slot.slot_type] || slot.slot_type}
                                    </span>
                                    {slot.isOCM && slot.label && (
                                      <span className="text-xs text-gray-400 dark:text-gray-500">
                                        {slot.label}
                                      </span>
                                    )}
                                  </div>
                                  <span className={'px-2 py-0.5 text-xs font-medium rounded-full ' + statusStyle}>
                                    {slot.status === 'AVAILABLE' ? 'Available' :
                                     slot.status === 'OCCUPIED' ? 'In Use' : 'Offline'}
                                  </span>
                                </div>

                                {/* Row 2: Rate info + Book button */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                                    {/* Price per kWh */}
                                    <span className="flex items-center gap-1">
                                      <FiDollarSign className="w-3 h-3" />
                                      {'\u20B9'}{slot.rate_per_kwh}/kWh
                                    </span>

                                    {/* Power rating (for OCM slots) */}
                                    {slot.power_kw && (
                                      <span className="flex items-center gap-1">
                                        <FiBatteryCharging className="w-3 h-3" />
                                        {slot.power_kw} kW
                                      </span>
                                    )}

                                    {/* Off-peak rate (if available) */}
                                    {slot.off_peak_rate && (
                                      <span className="flex items-center gap-1">
                                        <FiClock className="w-3 h-3" />
                                        Off: {'\u20B9'}{slot.off_peak_rate}
                                      </span>
                                    )}
                                  </div>

                                  {/* Book button — only for DRIVER users on available slots (local stations only) */}
                                  {slot.status === 'AVAILABLE' && user && user.role === 'DRIVER' && !station.isOCM && (
                                    <button
                                      onClick={function () { handleBook(slot) }}
                                      disabled={booking === slot.id}
                                      className={`
                                        px-4 py-1.5 text-xs font-medium rounded-lg transition-all
                                        ${booking === slot.id
                                          ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                                          : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:from-emerald-600 hover:to-emerald-700'
                                        }
                                      `}
                                    >
                                      {booking === slot.id ? 'Booking...' : 'Book Now'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()
          }
        </div>

        {/* ---- SECTION: Wallet Balance (local stations only) ---- */}
        {user && !station.isOCM && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Wallet Balance</p>
                {balanceError && (
                  <p className="text-xs text-red-400 mt-0.5">{balanceError}</p>
                )}
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
                {formatCurrency(balance)}
              </span>
            </div>
          </div>
        )}

        {/* Login prompt for guests (local stations only) */}
        {!user && !station.isOCM && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
            <p className="text-xs text-center text-gray-400 dark:text-gray-500">
              <a href="/login" className="text-emerald-500 hover:text-emerald-600 font-medium">
                Login
              </a>{' '}
              as a driver to book charging slots
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
