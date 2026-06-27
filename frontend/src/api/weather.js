import apiClient from './client'

export function getCurrentWeather(latitude, longitude) {
  return apiClient.get('/api/weather/current/', {
    params: { latitude: latitude, longitude: longitude },
  })
}

export function getForecast(latitude, longitude) {
  return apiClient.get('/api/weather/forecast/', {
    params: { latitude: latitude, longitude: longitude },
  })
}

export function getSevenDayForecast(latitude, longitude) {
  return apiClient.get('/api/weather/forecast/7-day/', {
    params: { latitude: latitude, longitude: longitude },
  })
}

export function getCityWeather(city) {
  return apiClient.get('/api/weather/city/', {
    params: { city: city },
  })
}

export function getRouteWeather(routeCoords) {
  return apiClient.post('/api/weather/route/', {
    route_coords: routeCoords,
  })
}
