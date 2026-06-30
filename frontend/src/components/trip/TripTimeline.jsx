import { FiMapPin, FiBatteryCharging, FiZap } from 'react-icons/fi'
import { formatDuration, chargerLabel } from '../../utils/formatters'

export default function TripTimeline({ originName, destName, batteryPercent, stops, legs, finalSoc }) {
  if (!legs || legs.length === 0) return null

  function truncate(name, max) {
    if (!name) return ''
    return name.length > max ? name.substring(0, max) + '…' : name
  }

  var items = []
  if (stops && stops.length > 0) {
    items.push({ type: 'origin', name: originName, battery: batteryPercent })
    for (var i = 0; i < stops.length; i++) {
      var leg = legs[i]
      var prevDist = i > 0 ? stops[i - 1].distance_from_start_km : 0
      items.push({ type: 'road', distance: leg ? leg.distance_km : 0, duration: leg ? leg.drive_time_seconds : 0 })
      items.push({
        type: 'stop',
        name: stops[i].station_name || 'Stop ' + (i + 1),
        arrivalSoc: stops[i].arrival_soc_percent,
        departureSoc: stops[i].departure_soc_percent,
        chargeTime: stops[i].charge_time_seconds,
        cost: stops[i].cost,
        slotType: stops[i].slot_type,
        chargerPowerKw: stops[i].charger_power_kw,
        legDist: stops[i].distance_from_start_km - prevDist,
      })
    }
    var finalLeg = legs[stops.length]
    if (finalLeg) {
      items.push({ type: 'road', distance: finalLeg.distance_km, duration: finalLeg.drive_time_seconds })
    }
    items.push({ type: 'dest', name: destName, battery: finalSoc })
  } else {
    items.push({ type: 'origin', name: originName, battery: batteryPercent })
    if (legs[0]) {
      items.push({ type: 'road', distance: legs[0].distance_km, duration: legs[0].drive_time_seconds })
    }
    items.push({ type: 'dest', name: destName, battery: finalSoc })
  }

  return (
    <div className="overflow-x-auto pb-3">
      <div className="flex items-start min-w-max gap-0 py-2">
        {items.map(function (item, i) {
          if (item.type === 'road') {
            return (
              <div key={i} className="flex flex-col items-center justify-center min-w-[80px] pt-4">
                <div className="w-full flex items-center">
                  <div className="flex-1 h-0 border-t-2 border-dashed border-gray-300 dark:border-gray-600"></div>
                  <span className="text-gray-400 dark:text-gray-500 text-[10px] -ml-1.5 rotate-0">▶</span>
                </div>
                <div className="mt-1 text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">{item.distance.toFixed(0)} km</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">{formatDuration(item.duration)}</div>
              </div>
            )
          }

          var isOrigin = item.type === 'origin'
          var isDest = item.type === 'dest'

          return (
            <div key={i} className="flex flex-col items-center min-w-[80px]">
              <div className={'w-9 h-9 rounded-full flex items-center justify-center ' + (
                isOrigin ? 'bg-emerald-100 dark:bg-emerald-900/40 border-2 border-emerald-400 dark:border-emerald-600' :
                isDest ? 'bg-red-100 dark:bg-red-900/40 border-2 border-red-400 dark:border-red-600' :
                'bg-amber-100 dark:bg-amber-900/40 border-2 border-amber-400 dark:border-amber-600'
              )}>
                {isOrigin && <FiMapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                {isDest && <FiMapPin className="w-4 h-4 text-red-600 dark:text-red-400" />}
                {!isOrigin && !isDest && <FiBatteryCharging className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
              </div>
              <div className="mt-1.5 text-center px-1">
                {isOrigin && (
                  <>
                    <div className="text-[11px] font-semibold text-gray-900 dark:text-white whitespace-nowrap">{item.name}</div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">{item.battery}%</div>
                  </>
                )}
                {isDest && (
                  <>
                    <div className="text-[11px] font-semibold text-gray-900 dark:text-white whitespace-nowrap">{item.name}</div>
                    <div className="text-[10px] text-red-600 dark:text-red-400 font-medium">{item.battery}%</div>
                  </>
                )}
                {!isOrigin && !isDest && (
                  <>
                    <div className="text-[11px] font-semibold text-gray-900 dark:text-white" title={item.name}>{truncate(item.name, 15)}</div>
                    <div className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center justify-center gap-0.5"><FiZap className="w-2.5 h-2.5" />{chargerLabel(item.slotType)} · {item.chargerPowerKw || '?'} kW</div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400">{item.arrivalSoc}% → {item.departureSoc}%</div>
                    <div className="text-[10px] text-gray-400 dark:text-gray-500">{formatDuration(item.chargeTime)}</div>
                    <div className="text-[10px] text-emerald-500 font-medium">{'\u20B9' + Math.round(item.cost).toLocaleString('en-IN')}</div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
