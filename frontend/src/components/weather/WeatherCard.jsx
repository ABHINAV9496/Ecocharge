import { FiDroplet, FiWind, FiThermometer } from 'react-icons/fi'

export default function WeatherCard({ weather, title, loading }) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm animate-pulse">
        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div className="space-y-2">
            <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (!weather) return null

  var iconMap = {
    sun: '☀️',
    'cloud-sun': '⛅',
    cloud: '☁️',
    'cloud-rain': '🌧️',
    'cloud-lightning': '⛈️',
    'cloud-snow': '🌨️',
    fog: '🌫️',
    'cloud-drizzle': '🌦️',
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      {title && (
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{title}</h3>
      )}
      <div className="flex items-center gap-4">
        <span className="text-4xl">{iconMap[weather.icon] || '🌤️'}</span>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {weather.temperature != null ? Math.round(weather.temperature) + '°C' : '--°C'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{weather.description || 'Unknown'}</p>
        </div>
      </div>

      {(weather.precipitation_probability != null || weather.wind_speed != null) && (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          {weather.precipitation_probability != null && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <FiDroplet className="w-3.5 h-3.5 text-blue-400" />
              <span>{Math.round(weather.precipitation_probability)}%</span>
            </div>
          )}
          {weather.wind_speed != null && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <FiWind className="w-3.5 h-3.5 text-teal-400" />
              <span>{Math.round(weather.wind_speed)} km/h</span>
            </div>
          )}
          {weather.temperature != null && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <FiThermometer className="w-3.5 h-3.5 text-red-400" />
              <span>{Math.round(weather.temperature)}°C</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
