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
  else if (wind != null && wind > 25) advices.push({ icon: '🌬️', text: 'Moderate breeze \u2014 minimal range impact.', level: 'info' })
  if (temp != null && temp < 10) advices.push({ icon: '🥶', text: 'Cold weather reduces battery efficiency. Plan extra charging.', level: 'warning' })
  else if (temp != null && temp > 40) advices.push({ icon: '🔥', text: 'High heat may affect battery cooling. Monitor temperature.', level: 'info' })
  if (advices.length === 0) advices.push({ icon: '✅', text: 'Weather is suitable for EV travel.', level: 'good' })
  return advices[0]
}

export default function WeatherCard({ weather, loading }) {
  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div className="space-y-1.5">
            <div className="h-5 w-14 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3].map(function (i) {
            return <div key={i} className="h-12 flex-1 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          })}
        </div>
      </div>
    )
  }

  if (!weather) return null

  var iconMap = {
    sun: '\u2600\uFE0F',
    'cloud-sun': '\u26C5',
    cloud: '\u2601\uFE0F',
    'cloud-rain': '\uD83C\uDF27\uFE0F',
    'cloud-lightning': '\u26C8\uFE0F',
    'cloud-snow': '\uD83C\uDF28\uFE0F',
    fog: '\uD83C\uDF2B\uFE0F',
    'cloud-drizzle': '\uD83C\uDF26\uFE0F',
  }

  var advisory = evAdvisory(weather)
  var advisoryColors = {
    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
    good: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-2.5">
        <span className="text-2xl">{iconMap[weather.icon] || '\uD83C\uDF24\uFE0F'}</span>
        <div className="min-w-0">
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              {weather.temperature != null ? Math.round(weather.temperature) + '\u00B0' : '--\u00B0'}
            </span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400">C</span>
            <span className="text-[11px] text-gray-500 dark:text-gray-400 ml-1 capitalize">{weather.description || 'Unknown'}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 mb-2.5">
        {weather.temperature != null && (
          <div className="flex-1 flex items-center gap-1.5 p-1.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
            <FiThermometer className="w-3 h-3 text-red-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] font-medium text-gray-700 dark:text-gray-300 leading-tight">{Math.round(weather.temperature)}\u00B0C</div>
              <div className="text-[8px] text-gray-400 dark:text-gray-500 leading-tight">Temp</div>
            </div>
          </div>
        )}
        {weather.wind_speed != null && (
          <div className="flex-1 flex items-center gap-1.5 p-1.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
            <FiWind className="w-3 h-3 text-teal-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] font-medium text-gray-700 dark:text-gray-300 leading-tight">{Math.round(weather.wind_speed)}</div>
              <div className="text-[8px] text-gray-400 dark:text-gray-500 leading-tight">km/h</div>
            </div>
          </div>
        )}
        {weather.precipitation_probability != null && (
          <div className="flex-1 flex items-center gap-1.5 p-1.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
            <FiDroplet className="w-3 h-3 text-blue-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] font-medium text-gray-700 dark:text-gray-300 leading-tight">{Math.round(weather.precipitation_probability)}%</div>
              <div className="text-[8px] text-gray-400 dark:text-gray-500 leading-tight">Rain</div>
            </div>
          </div>
        )}
        {weather.humidity != null && (
          <div className="flex-1 flex items-center gap-1.5 p-1.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
            <FiDroplet className="w-3 h-3 text-sky-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] font-medium text-gray-700 dark:text-gray-300 leading-tight">{Math.round(weather.humidity)}%</div>
              <div className="text-[8px] text-gray-400 dark:text-gray-500 leading-tight">Humidity</div>
            </div>
          </div>
        )}
      </div>

      {advisory && (
        <div className={'px-2.5 py-1.5 rounded-xl border text-[11px] leading-relaxed flex items-start gap-1.5 ' + (advisoryColors[advisory.level] || advisoryColors.info)}>
          <span className="text-sm shrink-0">{advisory.icon}</span>
          <span>{advisory.text}</span>
        </div>
      )}
    </div>
  )
}
