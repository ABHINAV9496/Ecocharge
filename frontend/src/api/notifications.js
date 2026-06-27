import apiClient from './client'

export function getNotifications(params) {
  return apiClient.get('/api/notifications/', { params: params || {} })
}

export function markRead(id) {
  return apiClient.patch('/api/notifications/' + id + '/read/')
}

export function markAllRead() {
  return apiClient.patch('/api/notifications/mark-all-read/')
}

export function deleteNotification(id) {
  return apiClient.delete('/api/notifications/' + id + '/')
}
