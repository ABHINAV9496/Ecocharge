import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FiArrowLeft, FiBatteryCharging, FiDollarSign, FiClock, FiHeart, FiStar, FiX } from 'react-icons/fi'
import { getStation, toggleFavorite, getReviews, createReview } from '../api/stations'
import { createBooking } from '../api/bookings'
import { createPaymentOrder, verifyPayment } from '../api/payments'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { getSlotTypeColor, SLOT_TYPE_LABELS } from '../utils/formatters'
import { SkeletonList } from '../components/layout/Skeleton'
import Navbar from '../components/layout/Navbar'

function loadRazorpayScript() {
  return new Promise(function (resolve, reject) {
    if (window.Razorpay) { resolve(); return }
    var script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = resolve
    script.onerror = reject
    document.body.appendChild(script)
  })
}

export default function StationDetailPage() {
  var { id } = useParams()
  var navigate = useNavigate()
  var { user } = useAuth()
  var showToast = useToast()

  var [station, setStation] = useState(null)
  var [slots, setSlots] = useState([])
  var [loading, setLoading] = useState(true)
  var [error, setError] = useState('')
  var [booking, setBooking] = useState(null)
  var [bookingError, setBookingError] = useState('')
  var [favorited, setFavorited] = useState(false)
  var [reviews, setReviews] = useState([])
  var [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' })
  var [submittingReview, setSubmittingReview] = useState(false)

  useEffect(function () {
    async function load() {
      try {
        var res = await getStation(id)
        setStation(res.data)
        setSlots(res.data.slots || [])
      } catch (err) {
        setError('Failed to load station details')
      } finally {
        setLoading(false)
      }
    }
    load()
    loadReviews()
  }, [id])

  async function loadReviews() {
    try {
      var res = await getReviews(id)
      setReviews(res.data)
    } catch (err) {}
  }

  async function handleToggleFavorite() {
    if (!user) { showToast('Login to save favorites', 'info'); return }
    try {
      var res = await toggleFavorite(id)
      setFavorited(res.data.favorited)
      showToast(res.data.message, 'success')
    } catch (err) { showToast('Failed to update favorite', 'error') }
  }

  async function handleSubmitReview() {
    if (!reviewForm.comment.trim()) { showToast('Please write a comment', 'info'); return }
    setSubmittingReview(true)
    try {
      await createReview(id, reviewForm)
      showToast('Review submitted!', 'success')
      setReviewForm({ rating: 5, comment: '' })
      loadReviews()
    } catch (err) { showToast('Failed to submit review', 'error') }
    finally { setSubmittingReview(false) }
  }

  async function handleBook(slot) {
    if (!user) { setBookingError('Please login to book'); return }
    if (user.role !== 'DRIVER') { setBookingError('Only drivers can book charging slots'); return }
    setBookingError('')
    setBooking(slot.id)
    try {
      var now = new Date()
      var bookingRes = await createBooking({ slot: slot.id, start_time: now.toISOString(), end_time: new Date(now.getTime() + 60 * 60 * 1000).toISOString() })
      var bookingId = bookingRes.data.id
      var amount = bookingRes.data.amount_charged

      await loadRazorpayScript()

      var orderRes = await createPaymentOrder(bookingId)
      var order = orderRes.data

      var options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'EcoCharge',
        description: 'Booking at ' + station.name,
        order_id: order.order_id,
        handler: async function (response) {
          try {
            await verifyPayment({
              booking_id: bookingId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            })
            showToast('Payment successful! Booking confirmed at ' + station.name + '!', 'success')
            var res = await getStation(id)
            setSlots(res.data.slots || [])
          } catch (verifyErr) {
            showToast('Payment verification failed', 'error')
          }
        },
        modal: {
          ondismiss: function () {
            showToast('Payment cancelled', 'info')
          }
        },
        theme: { color: '#10b981' },
      }

      var rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      var msg = 'Booking failed'
      if (err.response && err.response.data) {
        msg = err.response.data.error || err.response.data.detail || msg
        console.error('Full API error:', err.response.data)
      } else if (err.message) {
        msg = err.message
      }
      console.error('Booking error:', err)
      showToast(msg, 'error')
      setBookingError(msg)
    }
    setBooking(null)
  }

  var availableCount = slots.filter(function (s) { return s.status === 'AVAILABLE' }).length
  var slotGroups = {}
  slots.forEach(function (s) {
    var t = s.slot_type || 'AC'
    if (!slotGroups[t]) slotGroups[t] = []
    slotGroups[t].push(s)
  })
  var groupOrder = Object.keys(slotGroups).sort()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <div className="pt-16 max-w-4xl mx-auto p-4 md:p-6">

        <button onClick={function () { navigate(-1) }} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-emerald-500 mb-4 transition-colors">
          <FiArrowLeft className="w-4 h-4" /> Back
        </button>

        {loading ? (
          <div className="space-y-4"><SkeletonList items={4} /></div>
        ) : error ? (
          <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl">{error}</div>
        ) : station ? (
          <div className="space-y-6">

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">{station.name}</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{station.address}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={'px-2.5 py-0.5 text-xs font-medium rounded-full ' + (station.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200')}>{station.status === 'ACTIVE' ? 'Active' : station.status === 'MAINTENANCE' ? 'Maintenance' : 'Offline'}</span>
                    <span className="flex items-center gap-1 text-xs text-gray-500"><FiBatteryCharging className="w-3.5 h-3.5 text-emerald-500" /> {availableCount}/{slots.length} Available</span>
                  </div>
                </div>
                <button onClick={handleToggleFavorite} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                  <FiHeart className={'w-5 h-5 ' + (favorited ? 'fill-red-500 text-red-500' : 'text-gray-400')} />
                </button>
              </div>
            </div>

            {station.amenities && station.amenities.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Amenities</h2>
                <div className="flex flex-wrap gap-1.5">
                  {station.amenities.map(function (a, i) {
                    return <span key={i} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs font-medium rounded-full">{a}</span>
                  })}
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Charging Slots</h2>
                <span className="text-xs text-gray-500">{availableCount} open / {slots.length} total</span>
              </div>

              {bookingError && (
                <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl flex items-center gap-2">
                  <FiX className="w-4 h-4 shrink-0" /> {bookingError}
                </div>
              )}

              {slots.length === 0 ? (
                <div className="text-center py-8"><FiBatteryCharging className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" /><p className="text-sm text-gray-500">No slots available</p></div>
              ) : (
                <div className="space-y-4">
                  {groupOrder.map(function (groupType) {
                    var groupSlots = slotGroups[groupType]
                    if (!groupSlots || groupSlots.length === 0) return null
                    return (
                      <div key={groupType}>
                        <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-2 uppercase tracking-wider">{SLOT_TYPE_LABELS[groupType] || groupType}</h3>
                        <div className="space-y-2">
                          {groupSlots.map(function (slot) {
                            var statusColor = { AVAILABLE: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-900/20', OCCUPIED: 'border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/20', OUT_OF_SERVICE: 'border-red-200 dark:border-red-800 bg-red-50/80 dark:bg-red-900/20' }[slot.status] || 'border-gray-200 dark:border-gray-700'
                            var statusBadge = { AVAILABLE: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400', OCCUPIED: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400', OUT_OF_SERVICE: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' }[slot.status] || 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                            return (
                              <div key={slot.id} className={'p-3.5 border rounded-xl transition-all ' + statusColor}>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className={'px-2 py-0.5 text-xs font-medium rounded-full ' + getSlotTypeColor(slot.slot_type)}>{SLOT_TYPE_LABELS[slot.slot_type] || slot.slot_type}</span>
                                  </div>
                                  <span className={'px-2 py-0.5 text-xs font-medium rounded-full ' + statusBadge}>{slot.status === 'AVAILABLE' ? 'Available' : slot.status === 'OCCUPIED' ? 'In Use' : 'Offline'}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                                    <span className="flex items-center gap-1"><FiDollarSign className="w-3 h-3" /> ₹{slot.rate_per_kwh}/kWh</span>
                                    {slot.off_peak_rate && <span className="flex items-center gap-1"><FiClock className="w-3 h-3" /> Off: ₹{slot.off_peak_rate}</span>}
                                  </div>
                                  {slot.status === 'AVAILABLE' && user && (
                                    <button onClick={function () { handleBook(slot) }} disabled={booking === slot.id}
                                      className={'px-4 py-1.5 text-xs font-medium rounded-lg transition-all ' + (booking === slot.id ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg hover:from-emerald-600 hover:to-emerald-700')}
                                    >{booking === slot.id ? 'Booking...' : 'Book Now'}</button>
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
              )}

              {(!user || user.role !== 'DRIVER') && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
                  <p className="text-xs text-center text-gray-400">Only <span className="text-emerald-500 font-medium">DRIVER</span> accounts can book charging slots</p>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Reviews</h2>
              {reviews.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">No reviews yet</p>
              ) : (
                <div className="space-y-3 max-h-[240px] overflow-y-auto mb-4">
                  {reviews.map(function (review) {
                    return (
                      <div key={review.id} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{review.username}</span>
                          <span className="flex items-center gap-0.5">{[1, 2, 3, 4, 5].map(function (s) { return <FiStar key={s} className={'w-3 h-3 ' + (s <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600')} /> })}</span>
                        </div>
                        {review.comment && <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{review.comment}</p>}
                      </div>
                    )
                  })}
                </div>
              )}
              {user && (
                <div className="space-y-3">
                  <div className="flex items-center gap-1">{[1, 2, 3, 4, 5].map(function (s) { return <button key={s} onClick={function () { setReviewForm(Object.assign({}, reviewForm, { rating: s })) }} className="p-0.5"><FiStar className={'w-5 h-5 ' + (s <= reviewForm.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600 hover:text-amber-300')} /></button> })}</div>
                  <textarea value={reviewForm.comment} onChange={function (e) { setReviewForm(Object.assign({}, reviewForm, { comment: e.target.value })) }} placeholder="Share your experience..." rows={2} className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500 resize-none transition-all" />
                  <button onClick={handleSubmitReview} disabled={submittingReview}
                    className={'w-full py-2 text-xs font-medium rounded-xl transition-all ' + (submittingReview ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg hover:from-emerald-600 hover:to-emerald-700')}
                  >{submittingReview ? 'Submitting...' : 'Submit Review'}</button>
                </div>
              )}
            </div>

          </div>
        ) : null}
      </div>
    </div>
  )
}
