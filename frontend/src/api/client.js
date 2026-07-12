/*
  API Client - handles all communication with the Django backend
  ---------------------------------------------------------------
  What this file does:
  1. Creates an axios instance with default settings
  2. Automatically adds the JWT token to every request
  3. If a request fails with 401 (unauthorized), it tries to
     refresh the token automatically before giving up
*/

import axios from 'axios'

// Create a shared axios client that all API files will use
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
})

// STEP 1: Attach JWT token to every outgoing request
// Before a request is sent, this function runs and adds the
// Authorization header if we have a saved access token
apiClient.interceptors.request.use(function (config) {
  // Get the access token from browser storage
  var raw = localStorage.getItem('access_token')

  // Sanitise: clear any stale "undefined" string stored by earlier bugs
  if (raw === 'undefined' || raw === 'null') {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    raw = null
  }

  if (raw) {
    config.headers.Authorization = 'Bearer ' + raw
  }

  return config
})

// STEP 2: Handle expired tokens automatically
// When the server returns 401 (token expired), this tries to
// get a new token using the refresh token before failing
apiClient.interceptors.response.use(
  // If the response is successful, just return it as-is
  function (response) {
    return response
  },

  // If the response has an error, try to handle it
  async function (error) {
    var originalRequest = error.config

    // Check if the error is 401 AND we haven't already retried
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      // Get the refresh token from browser storage
      var refreshToken = localStorage.getItem('refresh_token')

      if (refreshToken) {
        try {
          // Try to get a new access token using the refresh token
          var response = await axios.post('/api/auth/token/refresh/', {
            refresh: refreshToken,
          })

          var newAccessToken = response.data.access
          var newRefreshToken = response.data.refresh
          localStorage.setItem('access_token', newAccessToken)
          if (newRefreshToken) localStorage.setItem('refresh_token', newRefreshToken)

          // Retry the original request with the new token
          originalRequest.headers.Authorization = 'Bearer ' + newAccessToken
          return apiClient(originalRequest)

        } catch (refreshError) {
          // Refresh failed - clear everything and redirect to login
          console.error('Session expired. Please login again.', refreshError)
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          localStorage.removeItem('user')
          window.location.href = '/login'
        }
      }
    }

    // For all other errors, just pass them along
    return Promise.reject(error)
  }
)

export default apiClient
