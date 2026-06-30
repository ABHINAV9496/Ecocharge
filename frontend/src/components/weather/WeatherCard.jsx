import { FiDroplet, FiWind, FiThermometer } from 'react-icons/fi'

function evAdvisory(weather) {
  if (!weather) return null
  var rain = weather.precipitation_probability
  var wind = weather.wind_speed
  var temp = weather.temperature
  var advices = []
  if (rain != null && rain > 70) advices.push({ icon: '🌧️', text: 'Heavy rain may reduce range. Drive carefully.', level: 'warning' })
  else if (rain != null && rain > 40) advices.push({ icon: '🌦️', text: 'Light rain expected. Slight efficiency drop possible.', level: 'info' })
  if (wind != null && wind > 40) advices.push({ icon: '💨', text: 'Strong winds may affect efficiency and range.', level: 'warning' })
  else if (wind != null && wind > 25) advices.push({ icon: '🌬️', text: 'Moderate breeze — minimal range impact.', level: 'info' })
  if (temp != null && temp < 10) advices.push({ icon: '🥶', text: 'Cold weather reduces battery efficiency. Plan extra charging.', level: 'warning' })
  else if (temp != null && temp > 40) advices.push({ icon: '🔥', text: 'High heat may affect battery cooling. Monitor temperature.', level: 'info' })
  if (advices.length === 0) advices.push({ icon: '✅', text: 'Weather is suitable for EV travel.', level: 'good' })
  return advices[0]
}

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

  var advisory = evAdvisory(weather)
  var advisoryColors = {
    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
    good: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      {title && (
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{title}</h3>
      )}
      <div className="flex items-center gap-3">
        <span className="text-3xl">{iconMap[weather.icon] || '🌤️'}</span>
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {weather.temperature != null ? Math.round(weather.temperature) + '°' : '--°'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">C</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{weather.description || 'Unknown'}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
        {weather.temperature != null && (
          <div className="flex flex-col items-center p-1.5 bg-gray-50 dark:bg-gray-900 rounded-xl">
            <FiThermometer className="w-3.5 h-3.5 text-red-400 mb-0.5" />
            <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">{Math.round(weather.temperature)}°C</span>
            <span className="text-[9px] text-gray-400 dark:text-gray-500">Temp</span>
          </div>
        )}
        {weather.wind_speed != null && (
          <div className="flex flex-col items-center p-1.5 bg-gray-50 dark:bg-gray-900 rounded-xl">
            <FiWind className="w-3.5 h-3.5 text-teal-400 mb-0.5" />
            <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">{Math.round(weather.wind_speed)}</span>
            <span className="text-[9px] text-gray-400 dark:text-gray-500">km/h</span>
          </div>
        )}
        {weather.precipitation_probability != null && (
          <div className="flex flex-col items-center p-1.5 bg-gray-50 dark:bg-gray-900 rounded-xl">
            <FiDroplet className="w-3.5 h-3.5 text-blue-400 mb-0.5" />
            <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">{Math.round(weather.precipitation_probability)}%</span>
            <span className="text-[9px] text-gray-400 dark:text-gray-500">Rain</span>
          </div>
        )}
        {weather.humidity != null && (
          <div className="flex flex-col items-center p-1.5 bg-gray-50 dark:bg-gray-900 rounded-xl">
            <FiDroplet className="w-3.5 h-3.5 text-sky-400 mb-0.5" />
            <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">{Math.round(weather.humidity)}%</span>
            <span className="text-[9px] text-gray-400 dark:text-gray-500">Humidity</span>
          </div>
        )}
      </div>

      {advisory && (
        <div className={'mt-3 px-3 py-2 rounded-xl border text-xs leading-relaxed flex items-start gap-2 ' + (advisoryColors[advisory.level] || advisoryColors.info)}>
          <span className="text-sm shrink-0">{advisory.icon}</span>
          <span>{advisory.text}</span>
        </div>
      )}
    </div>
  )
}
