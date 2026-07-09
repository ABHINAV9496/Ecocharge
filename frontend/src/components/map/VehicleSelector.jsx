import { useState, useRef, useEffect } from 'react'
import { FiChevronDown, FiBatteryCharging, FiSearch, FiPlus, FiTrash2 } from 'react-icons/fi'
import { removeCustomVehicle } from '../../data/vehicleProfiles'
import CustomVehicleForm from './CustomVehicleForm'
import VehicleImage from '../vehicle/VehicleImage'

export default function VehicleSelector(props) {
  var { vehicle, onSelect, vehicles } = props
  var [open, setOpen] = useState(false)
  var [search, setSearch] = useState('')
  var [showForm, setShowForm] = useState(false)
  var panelRef = useRef(null)

  useEffect(function () {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) {
      setTimeout(function () { document.addEventListener('click', handleClick) }, 0)
      return function () { document.removeEventListener('click', handleClick) }
    }
  }, [open])

  var allVehicles = vehicles || []

  var filtered = search
    ? allVehicles.filter(function (v) {
        var q = search.toLowerCase()
        return v.make.toLowerCase().indexOf(q) !== -1 || v.model.toLowerCase().indexOf(q) !== -1
      })
    : allVehicles

  var grouped = {}
  filtered.forEach(function (v) {
    if (!grouped[v.make]) grouped[v.make] = []
    grouped[v.make].push(v)
  })

  var range = vehicle
    ? Math.round((vehicle.battery_kwh * 0.9 / vehicle.consumption_wh_per_km) * 1000)
    : 0

  function handleAdded(v) {
    onSelect(v)
  }

  async function handleRemoveCustom(id) {
    await removeCustomVehicle(id)
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={function () { setOpen(!open) }}
        className="flex items-center gap-2 px-3 py-2 bg-gray-900/90 backdrop-blur-md border border-gray-700 rounded-xl text-sm text-white hover:bg-gray-800 transition-colors shadow-lg"
      >
        {vehicle ? (
          <>
            <VehicleImage vehicle={vehicle} size="sm" />
            <div className="flex flex-col items-start">
              <span className="text-xs font-medium">{vehicle.make} {vehicle.model}</span>
              <span className="text-[10px] text-gray-400">{range} km range</span>
            </div>
          </>
        ) : (
          <span className="text-xs text-gray-400">Loading vehicles...</span>
        )}
        <FiChevronDown className="w-3.5 h-3.5 text-gray-400 ml-1" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-[2000] max-h-96 overflow-y-auto">
          <div className="p-2 border-b border-gray-800">
            <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
              <FiSearch className="w-3.5 h-3.5 text-gray-500" />
              <input
                value={search}
                onChange={function (e) { setSearch(e.target.value) }}
                placeholder="Search vehicles..."
                className="bg-transparent text-xs text-white outline-none w-full placeholder-gray-500"
              />
            </div>
          </div>

          <div className="p-2">
            {Object.keys(grouped).length === 0 && (
              <div className="text-center text-gray-500 text-xs py-4">
                {allVehicles.length === 0 ? 'Loading vehicles...' : 'No vehicles found'}
              </div>
            )}
            {Object.keys(grouped).map(function (make) {
              return (
                <div key={make}>
                  <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider px-2 py-1.5">
                    {make}
                  </div>
                  {grouped[make].map(function (v) {
                    var active = vehicle && vehicle.id === v.id
                    return (
                      <button
                        key={v.id}
                        onClick={function () { onSelect(v); setOpen(false) }}
                        className={
                          'w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-colors ' +
                          (active ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-300 hover:bg-gray-800')
                        }
                      >
                        <VehicleImage vehicle={v} size="sm" />
                        <div className="flex flex-col items-start flex-1 min-w-0">
                          <span className="font-medium truncate">{v.make} {v.model}</span>
                          <span className="text-[10px] text-gray-500">
                            {v.battery_kwh} kWh · {v.fast_charge_kw} kW DC
                          </span>
                        </div>
                        <FiBatteryCharging className="w-3 h-3 text-gray-500" />
                        {!v.is_builtin && (
                          <button
                            onClick={function (e) { e.stopPropagation(); handleRemoveCustom(v.id) }}
                            className="p-1 hover:text-red-400 text-gray-500 transition-colors"
                            title="Remove custom vehicle"
                          >
                            <FiTrash2 className="w-3 h-3" />
                          </button>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>

          <div className="border-t border-gray-800 p-2">
            <button
              onClick={function () { setShowForm(true) }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
            >
              <FiPlus className="w-4 h-4" />
              Add Custom Vehicle
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <CustomVehicleForm
          onClose={function () { setShowForm(false) }}
          onAdded={handleAdded}
        />
      )}
    </div>
  )
}
