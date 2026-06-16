import apiClient from './client'

export function getVehicles() {
  return apiClient.get('/api/vehicles/')
}

export function getVehicle(id) {
  return apiClient.get('/api/vehicles/' + id + '/')
}

export function createVehicle(data) {
  return apiClient.post('/api/vehicles/', data)
}

export function deleteVehicle(id) {
  return apiClient.delete('/api/vehicles/' + id + '/')
}
