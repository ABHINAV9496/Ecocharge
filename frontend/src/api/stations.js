/*
  Stations API
  ------------
  Manages charging stations and their slots.
  Stations are located on a map using latitude/longitude coordinates.
*/

import apiClient from './client'

// Get all stations (optionally filtered by location and radius)
// params can include: lat, lng, radius (in km)
export function getStations(params) {
  return apiClient.get('/api/stations/', { params: params })
}

// Search stations by name or address (optionally within bounds)
export function searchStations(query, bounds) {
  var params = { q: query, page_size: 5 }
  if (bounds) { params.bounds = bounds }
  return apiClient.get('/api/stations/', { params: params })
}

// Get platform-wide station stats (SUPER_ADMIN only)
export function getStationStats() {
  return apiClient.get('/api/stations/stats/')
}

// Get paginated stations owned by current user
export function getMyStations(params) {
  return apiClient.get('/api/stations/my-stations/', { params: params })
}

// Get a single station by its ID
export function getStation(id) {
  return apiClient.get('/api/stations/' + id + '/')
}

// Create a new charging station (Station Owner only)
export function createStation(data) {
  return apiClient.post('/api/stations/', data)
}

// Update an existing station's details
export function updateStation(id, data) {
  return apiClient.put('/api/stations/' + id + '/', data)
}

// Delete a charging station
export function deleteStation(id) {
  return apiClient.delete('/api/stations/' + id + '/')
}

// Get all charging slots for a specific station
export function getSlots(stationId) {
  return apiClient.get('/api/stations/' + stationId + '/slots/')
}

// Add a new charging slot to a station
export function createSlot(stationId, data) {
  return apiClient.post('/api/stations/' + stationId + '/slots/', data)
}

// Update a specific charging slot
export function updateSlot(stationId, slotId, data) {
  return apiClient.put('/api/stations/' + stationId + '/slots/' + slotId + '/', data)
}

// Delete a charging slot
export function deleteSlot(stationId, slotId) {
  return apiClient.delete('/api/stations/' + stationId + '/slots/' + slotId + '/')
}

// Batch fetch stations by multiple lat/lng points (for route corridor)
export function getStationsBatch(points, radius) {
  return apiClient.post('/api/stations/batch/', { points: points, radius: radius || 20 })
}

// Get route-optimized stations (sorted by distance from route)
export function getRouteStations(waypoints, radius) {
  return apiClient.post('/api/stations/by_route/', { waypoints: waypoints, radius: radius || 20 })
}

// Toggle a station as favorite
export function toggleFavorite(stationId) {
  return apiClient.post('/api/stations/favorites/toggle/', { station_id: stationId })
}

// Get user's favorite stations
export function getFavorites() {
  return apiClient.get('/api/stations/favorites/')
}

// Get reviews for a station
export function getReviews(stationId) {
  return apiClient.get('/api/stations/' + stationId + '/reviews/')
}

// Create a review for a station
export function createReview(stationId, data) {
  return apiClient.post('/api/stations/' + stationId + '/reviews/', data)
}

