import apiClient from './client'

export function planRoute(data) {
  return apiClient.post('/api/trips/plan/', data)
}
