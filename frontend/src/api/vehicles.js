import apiClient from './client'

export function getVehicles() {
  return apiClient.get('/api/vehicles/')
}

export function getVehicle(id) {
  return apiClient.get('/api/vehicles/' + id + '/')
}

export function createVehicle(data) {
  var hasFile = Object.values(data).some(function (v) { return v instanceof File })
  if (hasFile) {
    var fd = new FormData()
    Object.keys(data).forEach(function (k) { fd.append(k, data[k]) })
    return apiClient.post('/api/vehicles/', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }
  return apiClient.post('/api/vehicles/', data)
}

export function deleteVehicle(id) {
  return apiClient.delete('/api/vehicles/' + id + '/')
}
