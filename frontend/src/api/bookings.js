/*
  Bookings API
  ------------
  Manages slot reservations. Users book a charging slot for a
  specific time period. Payments are handled via Razorpay.
*/

import apiClient from './client'

// Get all bookings (drivers see their own, owners see their station's)
export function getBookings() {
  return apiClient.get('/api/bookings/')
}

// Get details of a single booking
export function getBooking(id) {
  return apiClient.get('/api/bookings/' + id + '/')
}

// Cancel a booking
export function cancelBooking(id) {
  return apiClient.delete('/api/bookings/' + id + '/')
}

// Create a Razorpay order for booking a slot
// data: { slot, start_time, end_time }
export function createRazorpayOrder(data) {
  return apiClient.post('/api/bookings/create-order/', data)
}

// Verify Razorpay payment and confirm the booking
// data: { razorpay_order_id, razorpay_payment_id, razorpay_signature, slot_id, start_time, end_time }
export function verifyRazorpayPayment(data) {
  return apiClient.post('/api/bookings/verify-payment/', data)
}

// Get heatmap data for the map — returns station usage intensity
// Accepts optional days parameter (default: 90)
export function getHeatmapData(days) {
  return apiClient.get('/api/bookings/heatmap/', { params: { days: days || 90 } })
}
