import apiClient from './client'

export function createPaymentOrder(bookingId) {
  return apiClient.post('/api/payments/create-order/', { booking_id: bookingId })
}

export function verifyPayment(data) {
  return apiClient.post('/api/payments/verify/', data)
}

export function capturePayment(bookingId) {
  return apiClient.post('/api/payments/capture/', { booking_id: bookingId })
}

export function getPaymentStatus(bookingId) {
  return apiClient.get('/api/payments/status/' + bookingId + '/')
}

export function getPaymentHistory(params) {
  return apiClient.get('/api/payments/history/', { params: params })
}

export function deletePayment(paymentId) {
  return apiClient.delete('/api/payments/' + paymentId + '/')
}
