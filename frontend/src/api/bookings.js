/*
  Bookings API
  ------------
  Manages slot reservations. Users book a charging slot for a
  specific time period. Bookings deduct money from the user's wallet.
*/

import apiClient from './client'

// Get all bookings (drivers see their own, owners see their station's)
export function getBookings() {
  return apiClient.get('/api/bookings/')
}

// Create a new booking
// data should contain: slot (id), start_time, end_time
export function createBooking(data) {
  return apiClient.post('/api/bookings/', data)
}

// Get details of a single booking
export function getBooking(id) {
  return apiClient.get('/api/bookings/' + id + '/')
}

// Cancel a booking (refunds money to wallet)
export function cancelBooking(id) {
  return apiClient.delete('/api/bookings/' + id + '/')
}

// Get heatmap data for the map — returns station usage intensity
// Accepts optional days parameter (default: 90)
export function getHeatmapData(days) {
  return apiClient.get('/api/bookings/heatmap/', { params: { days: days || 90 } })
}
