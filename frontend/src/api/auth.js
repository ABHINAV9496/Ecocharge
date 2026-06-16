/*
  Authentication API
  ------------------
  All the functions needed for user registration, login, logout,
  and profile management. Each function calls a specific Django API endpoint.
*/

import apiClient from './client'

// Register a new user account
// data should contain: username, email, password, password2, role, etc.
export function register(data) {
  return apiClient.post('/api/auth/register/', data)
}

// Login with username and password
// Returns access token, refresh token, and user info
export function login(data) {
  return apiClient.post('/api/auth/login/', data)
}

// Logout by blacklisting the refresh token
export function logout(refreshToken) {
  return apiClient.post('/api/auth/logout/', { refresh: refreshToken })
}

// Get the currently logged-in user's profile
export function getProfile() {
  return apiClient.get('/api/auth/profile/')
}

// Update the current user's profile (car model, battery, phone, etc.)
export function updateProfile(data) {
  return apiClient.put('/api/auth/profile/', data)
}

// Exchange a refresh token for a new access token
export function refreshToken(refresh) {
  return apiClient.post('/api/auth/token/refresh/', { refresh: refresh })
}

// Login with Google ID token (received from Google Sign-In)
export function googleLogin(idToken) {
  return apiClient.post('/api/auth/google/', { id_token: idToken })
}
