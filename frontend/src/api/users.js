import apiClient from './client'

export function getUsers() {
  return apiClient.get('/api/auth/users/')
}

export function updateUserRole(userId, role) {
  return apiClient.patch('/api/auth/users/' + userId + '/', { role: role })
}

export function deleteUser(userId) {
  return apiClient.delete('/api/auth/users/' + userId + '/')
}
