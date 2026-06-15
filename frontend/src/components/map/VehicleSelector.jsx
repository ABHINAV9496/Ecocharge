import { useState, useRef, useEffect } from 'react'
import { FiChevronDown, FiBatteryCharging, FiSearch, FiPlus, FiTrash2 } from 'react-icons/fi'
import { getAllVehicles, removeCustomVehicle } from '../../data/vehicleProfiles'
import CustomVehicleForm from './CustomVehicleForm'

var COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

function VehicleBadge(props) {
  var { make, model } = props
  var initials = (make[0] + model[0]).toUpperCase()
  var color = COLORS[make.length % COLORS.length]
  return (
    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: color }}>
      <span className="text-white text-xs font-bold leading-none">{initials}</span>
    </div>
  )
}

export default function VehicleSelector(props) {
  var { vehicle, onSelect } = props
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

  var allVehicles = getAllVehicles()

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

  function handleRemoveCustom(id) {
    removeCustomVehicle(id)
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={function () { setOpen(!open) }}
        className="flex items-center gap-2 px-3 py-2 bg-gray-900/90 backdrop-blur-md border border-gray-700 rounded-xl text-sm text-white hover:bg-gray-800 transition-colors shadow-lg"
      >
        <FiBatteryCharging className="w-4 h-4 text-emerald-400" />
        <span className="hidden sm:inline font-medium truncate max-w-[140px]">
          {vehicle ? vehicle.make + ' ' + vehicle.model : 'Select Vehicle'}
        </span>
        <span className="text-xs text-gray-400">{range} km</span>
        <FiChevronDown className={'w-3 h-3 text-gray-400 transition-transform ' + (open ? 'rotate-180' : '')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-[340px] max-h-[480px] bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50">
          <div className="p-2 border-b border-gray-800">
            <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
              <FiSearch className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Search vehicles..."
                value={search}
                onChange={function (e) { setSearch(e.target.value) }}
                className="bg-transparent outline-none text-sm text-white placeholder-gray-500 w-full"
              />
            </div>
          </div>

          <div className="overflow-y-auto max-h-[340px]">
            {Object.keys(grouped).length === 0 && (
              <div className="p-4 text-center text-sm text-gray-500">No vehicles found</div>
            )}

            {Object.keys(grouped).map(function (make) {
              return (
                <div key={make}>
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-gray-500 font-semibold bg-gray-800/50 sticky top-0">
                    {make}
                  </div>
                  {grouped[make].map(function (v) {
                    var isActive = vehicle && vehicle.id === v.id
                    var vRange = Math.round((v.battery_kwh * 0.9 / v.consumption_wh_per_km) * 1000)
                    var isCustom = v.isCustom

                    return (
                      <div key={v.id} className="flex items-center">
                        <button
                          onClick={function () {
                            onSelect(v)
                            setOpen(false)
                            setSearch('')
                          }}
                          className={
                            'flex-1 flex items-center gap-3 px-3 py-2.5 text-left transition-colors text-sm ' +
                            (isActive
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'text-gray-300 hover:bg-gray-800')
                          }
                        >
                          <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center overflow-hidden shrink-0">
                            <VehicleBadge make={v.make} model={v.model} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate flex items-center gap-1.5">
                              {v.make} {v.model}
                              {isCustom && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full shrink-0">Custom</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              {v.battery_kwh} kWh · {vRange} km range
                            </div>
                          </div>
                          {isActive && (
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          )}
                        </button>
                        {isCustom && (
                          <button
                            onClick={function (e) { e.stopPropagation(); handleRemoveCustom(v.id); onSelect(allVehicles[0]) }}
                            className="px-2 py-2.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                            title="Remove custom vehicle"
                          >
                            <FiTrash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
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
