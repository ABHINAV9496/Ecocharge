import WeatherBadge from './WeatherBadge'

export default function RouteWeatherTimeline({ routeWeather, loading }) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse" />
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3, 4].map(function (i) {
            return (
              <div key={i} className="shrink-0 w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
            )
          })}
        </div>
      </div>
    )
  }

  if (!routeWeather || routeWeather.length === 0) return null

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
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Weather Along Route</h3>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {routeWeather.map(function (point, idx) {
          var isFirst = idx === 0
          var isLast = idx === routeWeather.length - 1
          return (
            <div key={idx} className="shrink-0 flex items-center gap-2">
              <div className={[
                'flex flex-col items-center p-3 rounded-xl min-w-[80px]',
                isFirst || isLast
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800',
              ].join(' ')}>
                <span className="text-xl mb-1">{iconMap[point.icon] || '🌤️'}</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {point.temperature != null ? Math.round(point.temperature) + '°' : '--°'}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                  {point.precipitation_probability != null
                    ? Math.round(point.precipitation_probability) + '% rain'
                    : ''}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  {isFirst ? 'Start' : isLast ? 'End' : 'Stop ' + idx}
                </span>
              </div>
              {!isLast && (
                <div className="w-4 h-px bg-gray-300 dark:bg-gray-600 shrink-0" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
