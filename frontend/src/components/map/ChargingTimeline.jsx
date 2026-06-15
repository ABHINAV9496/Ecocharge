import { FiBatteryCharging, FiClock, FiDollarSign, FiMapPin } from 'react-icons/fi'

export default function ChargingTimeline(props) {
  var { stops, origin, destination } = props

  if (!stops || stops.length === 0) return null

  var allPoints = [
    { type: 'origin', label: origin || 'Current Location', icon: FiMapPin, color: 'text-emerald-400' },
    ...stops.map(function (s, i) {
      return {
        type: 'stop',
        label: s.station_name || s.name || 'Charging Stop ' + (i + 1),
        station: s,
        icon: FiBatteryCharging,
        color: 'text-amber-400',
      }
    }),
    { type: 'dest', label: destination || 'Destination', icon: FiMapPin, color: 'text-red-400' },
  ]

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <FiBatteryCharging className="w-4 h-4 text-emerald-400" />
        Charging Stops
      </h3>
      <div className="relative">
        <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-gray-700" />

        {allPoints.map(function (point, i) {
          var PointIcon = point.icon
          var isLast = i === allPoints.length - 1

          return (
            <div key={i} className="relative flex items-start gap-3 pb-4 pl-1">
              <div
                className={
                  'relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ' +
                  (point.type === 'origin'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : point.type === 'dest'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-amber-500/20 text-amber-400')
                }
              >
                <PointIcon className="w-3 h-3" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={'text-sm font-medium truncate ' + point.color}>
                    {point.label}
                  </span>
                  {point.type === 'stop' && point.station && (
                    <span className="text-xs text-gray-500 shrink-0 ml-2">
                      {Math.round(point.station.distance || 0)} km
                    </span>
                  )}
                </div>

                {point.type === 'stop' && point.station && (
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-400">
                    {point.station.arrival_battery_percent !== undefined && (
                      <span className="flex items-center gap-1">
                        <FiBatteryCharging className="w-3 h-3" />
                        {Math.round(point.station.arrival_battery_percent)}% → {Math.round(point.station.departure_battery_percent || 80)}%
                      </span>
                    )}
                    {point.station.charge_time_minutes && (
                      <span className="flex items-center gap-1">
                        <FiClock className="w-3 h-3" />
                        {point.station.charge_time_minutes}m
                      </span>
                    )}
                    {point.station.cost && (
                      <span className="flex items-center gap-1">
                        <FiDollarSign className="w-3 h-3" />
                        ₹{point.station.cost}
                      </span>
                    )}
                  </div>
                )}

                {point.type !== 'stop' && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {point.type === 'origin' ? 'Starting point' : 'Your destination'}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
