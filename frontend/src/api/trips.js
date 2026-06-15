import apiClient from './client'

export function getTrips() {
  return apiClient.get('/api/trips/')
}

export function getTrip(id) {
  return apiClient.get('/api/trips/' + id + '/')
}

export function createTrip(data) {
  return apiClient.post('/api/trips/', data)
}
