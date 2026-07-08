import { useState, useEffect } from 'react'
import { FiMapPin, FiRefreshCw } from 'react-icons/fi'
import { getCurrentWeather, getForecast } from '../../api/weather'
import WeatherCard from './WeatherCard'

export default function CurrentWeatherWidget({ defaultCity }) {
  var [weather, setWeather] = useState(null)
  var [forecast, setForecast] = useState(null)
  var [loading, setLoading] = useState(true)
  var [error, setError] = useState(null)
  var [coords, setCoords] = useState(null)

  function loadWeather(lat, lng) {
    setLoading(true)
    setError(null)
    Promise.all([
      getCurrentWeather(lat, lng),
      getForecast(lat, lng),
    ]).then(function (results) {
      setWeather(results[0].data)
      setForecast(results[1].data)
      setLoading(false)
    }).catch(function (err) {
      console.error('Weather fetch failed:', err)
      setError('Unable to load weather data')
      setLoading(false)
    })
  }

  useEffect(function () {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          var c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setCoords(c)
          loadWeather(c.lat, c.lng)
        },
        function () {
          setCoords(null)
          loadWeather(19.076, 72.8777)
        }
      )
    } else {
      loadWeather(19.076, 72.8777)
    }
  }, [])

  function handleRefresh() {
    if (coords) {
      loadWeather(coords.lat, coords.lng)
    } else {
      loadWeather(19.076, 72.8777)
    }
  }

  var hourlyForecast = forecast && forecast.hourly
    ? forecast.hourly.slice(0, 6)
    : []

  return (
    <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700/30 shadow-sm card-hover">
      <div className="p-4 md:p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
            <FiMapPin className="w-3.5 h-3.5 text-emerald-500" />
            {coords ? 'Current Location' : (defaultCity || 'Mumbai')}
          </h3>
          <button
            onClick={handleRefresh}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Refresh weather"
          >
            <FiRefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 text-xs rounded-xl mb-2">
            {error}
          </div>
        )}

        <WeatherCard weather={weather} loading={loading} />

        {hourlyForecast.length > 0 && !loading && (
          <div className="mt-2.5 pt-2.5 border-t border-gray-100 dark:border-gray-700/50">
            <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">Next few hours</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {hourlyForecast.map(function (h, i) {
                var time = new Date(h.time || h.dt * 1000)
                var hourLabel = time.getHours().toString().padStart(2, '0') + ':00'
                return (
                  <div key={i} className="shrink-0 flex flex-col items-center p-1.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl min-w-[44px]">
                    <span className="text-[9px] text-gray-500 dark:text-gray-400">{hourLabel}</span>
                    <span className="text-xs font-bold text-gray-900 dark:text-white">
                      {h.temperature != null ? Math.round(h.temperature) + '\u00B0' : '--\u00B0'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
