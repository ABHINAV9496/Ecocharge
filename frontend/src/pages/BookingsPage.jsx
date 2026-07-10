import { useState, useEffect } from 'react'
import { FiCalendar, FiX, FiBatteryCharging, FiCheckCircle, FiClock, FiRefreshCw, FiZap } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { getBookings, cancelBooking } from '../api/bookings'
import { getPaymentHistory } from '../api/payments'
import { formatCurrency, formatDate } from '../utils/formatters'
import Navbar from '../components/layout/Navbar'
import Sidebar from '../components/layout/Sidebar'
import { SkeletonList } from '../components/layout/Skeleton'

export default function BookingsPage() {
  var { user } = useAuth()
  var showToast = useToast()
  var [bookings, setBookings] = useState([])
  var [paymentMap, setPaymentMap] = useState({})
  var [loading, setLoading] = useState(true)
  var [error, setError] = useState('')
  var [cancelling, setCancelling] = useState(null)

  useEffect(function () {
    async function load() {
      try {
        var res = await getBookings()
        setBookings(res.data)
      } catch (err) {
        setError('Failed to load bookings')
      } finally {
        setLoading(false)
      }
    }
    async function loadPayments() {
      try {
        var res = await getPaymentHistory()
        var payments = res.data.payments || []
        var map = {}
        payments.forEach(function (p) { map[p.booking] = p })
        setPaymentMap(map)
      } catch (e) { /* ignore */ }
    }
    load()
    loadPayments()
  }, [])

  async function handleCancel(bookingId) {
    setCancelling(bookingId)
    try {
      await cancelBooking(bookingId)
      setBookings(bookings.filter(function (b) { return b.id !== bookingId }))
      showToast('Booking cancelled', 'success')
    } catch (err) {
      showToast('Could not cancel booking', 'error')
    } finally {
      setCancelling(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <div className="pt-16 flex">
        <Sidebar />
        <div className="ml-16 md:ml-56 flex-1 p-4 md:p-6">
          <div className="max-w-4xl mx-auto space-y-6">

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center">
                <FiCalendar className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Bookings</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">View and manage your charging reservations</p>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl flex items-center gap-2">
                <FiX className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {loading ? (
              <SkeletonList items={5} />
            ) : bookings.length === 0 ? (
              <div className="text-center py-16">
                <FiCalendar className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No bookings yet</p>
                <a href="/map" className="text-sm font-medium text-emerald-500 hover:text-emerald-600">Find a station on the map to book a slot</a>
              </div>
            ) : (
              <div className="space-y-2">
                {bookings.map(function (booking) {
                  var stationName = booking.slot_details
                    ? booking.slot_details.station_name
                    : 'Slot #' + booking.slot
                  var isActive = booking.status === 'CONFIRMED'
                  var payment = paymentMap[booking.id]
                  var payStatus = payment ? payment.status : null
                  var payBadge = null
                  if (payStatus === 'CAPTURED') payBadge = { icon: FiCheckCircle, text: 'Paid', cls: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' }
                  else if (payStatus === 'AUTHORIZED') payBadge = { icon: FiClock, text: 'Authorized', cls: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' }
                  else if (payStatus === 'REFUNDED') payBadge = { icon: FiRefreshCw, text: 'Refunded', cls: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' }
                  else if (payStatus === 'FAILED') payBadge = { icon: FiX, text: 'Failed', cls: 'text-red-500 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' }

                  return (
                    <div key={booking.id}
                      className={'flex items-center justify-between p-4 rounded-xl transition-colors ' + (isActive
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800')}
                    >
                      <div className="flex items-center gap-3">
                        <div className={'w-9 h-9 rounded-lg flex items-center justify-center ' + (isActive ? 'bg-emerald-100 dark:bg-emerald-800' : 'bg-gray-200 dark:bg-gray-700')}>
                          <FiBatteryCharging className={'w-4 h-4 ' + (isActive ? 'text-emerald-500' : 'text-gray-400')} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{stationName}</p>
                          {booking.vehicle_details && (
                            <p className="text-[11px] text-gray-400 dark:text-gray-500">
                              <FiZap className="w-3 h-3 inline mr-0.5 text-emerald-400" />
                              {booking.vehicle_details.make} {booking.vehicle_details.model}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(booking.start_time)}
                            {booking.end_time && (function () {
                              var diffMs = new Date(booking.end_time) - new Date(booking.start_time)
                              var diffH = Math.round(diffMs / 3600000 * 10) / 10
                              return <>{' · '}<FiClock className="w-3 h-3 inline mr-0.5" />{diffH >= 1 ? diffH + 'h' : Math.round(diffMs / 60000) + 'm'}</>
                            })()}
                            {' · '}
                            <span className={isActive ? 'text-emerald-500 font-medium' : ''}>{booking.status}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {payBadge && (function () {
                          var PayIcon = payBadge.icon
                          return (
                            <span className={'hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-full border ' + payBadge.cls}>
                              <PayIcon className="w-3 h-3" /> {payBadge.text}
                            </span>
                          )
                        })()}
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(booking.amount_charged)}</span>
                        {isActive && (
                          <button onClick={function () { handleCancel(booking.id) }}
                            disabled={cancelling === booking.id}
                            className={'px-3 py-1.5 text-xs font-medium rounded-lg transition-all ' + (cancelling === booking.id
                              ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                              : 'text-red-500 hover:text-white hover:bg-red-500 border border-red-200 dark:border-red-800 hover:border-red-500')}
                          >
                            {cancelling === booking.id ? '...' : 'Cancel'}
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
      </div>
    </div>
  )
}
