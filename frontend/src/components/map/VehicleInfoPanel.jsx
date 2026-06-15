import { FiBatteryCharging, FiZap } from 'react-icons/fi'
import { getEstimatedRange } from '../../data/vehicleProfiles'

export default function VehicleInfoPanel(props) {
  var { vehicle, batteryPercent, onBatteryChange } = props

  if (!vehicle) return null

  var range = getEstimatedRange(vehicle, batteryPercent)

  return (
    <div className="absolute left-4 bottom-24 z-[1000] w-48">
      <div className="bg-gray-900/90 backdrop-blur-xl border border-gray-800 rounded-xl p-3 shadow-2xl">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <FiBatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xs text-gray-400 truncate leading-tight">
            <div className="text-white text-sm font-medium truncate">{vehicle.make}</div>
            <div className="truncate">{vehicle.model}</div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Battery</span>
            <span className="text-white font-medium">{batteryPercent}%</span>
          </div>
          <input
            type="range"
            min={5}
            max={100}
            value={batteryPercent}
            onChange={function (e) { onBatteryChange(parseInt(e.target.value)) }}
            className="w-full h-1 rounded-full appearance-none cursor-pointer"
            style={{
              background: 'linear-gradient(to right, #10b981 ' + batteryPercent + '%, #374151 ' + batteryPercent + '%)',
            }}
          />

          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-gray-500">Range</span>
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <FiZap className="w-3 h-3" />
              {range} km
            </span>
          </div>
        </div>

        <div className="mt-2 pt-2 border-t border-gray-800">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-gray-500">Fast charge</span>
            <span className="text-gray-300">{vehicle.fast_charge_kw || '—'} kW</span>
          </div>
        </div>
      </div>
    </div>
  )
}
