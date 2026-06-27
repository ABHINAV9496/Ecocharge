export default function WeatherBadge({ temperature, icon, description, size }) {
  var sizeClass = size === 'sm'
    ? 'text-xs gap-1 px-2 py-0.5'
    : 'text-sm gap-1.5 px-2.5 py-1'

  return (
    <span className={'inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium ' + sizeClass}>
      {icon && <WeatherIcon icon={icon} className="w-3.5 h-3.5" />}
      {temperature != null && <span>{Math.round(temperature)}°C</span>}
      {description && <span className="text-gray-500 dark:text-gray-400 hidden sm:inline">{description}</span>}
    </span>
  )
}

function WeatherIcon({ icon, className }) {
  var icons = {
    sun: '☀️',
    'cloud-sun': '⛅',
    cloud: '☁️',
    'cloud-rain': '🌧️',
    'cloud-lightning': '⛈️',
    'cloud-snow': '🌨️',
    fog: '🌫️',
    'cloud-drizzle': '🌦️',
  }
  return <span className={className}>{icons[icon] || '🌤️'}</span>
}
