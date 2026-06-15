import apiClient from './client'

export function sendContactMessage(data) {
  return apiClient.post('/api/contact/', data)
}
