import { useState, useEffect } from 'react'
import { FiBatteryCharging, FiZap, FiPlus, FiTrash2, FiTruck, FiCheck } from 'react-icons/fi'
import { useVehicle } from '../context/VehicleContext'
import { useToast } from '../context/ToastContext'
import { addCustomVehicle, removeCustomVehicle } from '../data/vehicleProfiles'
import CustomVehicleForm from '../components/map/CustomVehicleForm'
import VehicleImage from '../components/vehicle/VehicleImage'

function getRange(vehicle) {
  if (!vehicle) return 0
  return Math.round((vehicle.battery_kwh * 0.9 / vehicle.consumption_wh_per_km) * 1000)
}

export default function VehiclesPage() {
  var { vehicle: currentVehicle, setVehicle, vehicles, setVehicles } = useVehicle()
  var showToast = useToast()
  var [showForm, setShowForm] = useState(false)
  var [selectedId, setSelectedId] = useState(null)

  function handleSelect(v) {
    setVehicle(v)
    localStorage.setItem('preferred_vehicle_id', v.id)
    showToast(v.make + ' ' + v.model + ' selected', 'success')
  }

  async function handleRemove(id) {
    await removeCustomVehicle(id)
    showToast('Vehicle removed', 'success')
  }

  function handleAdded(v) {
    setSelectedId(v.id)
    setShowForm(false)
  }

  var allVehicles = vehicles || []
  var builtIn = allVehicles.filter(function (v) { return v.is_builtin })
  var custom = allVehicles.filter(function (v) { return !v.is_builtin })

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 pt-20 px-4 pb-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center">
              <FiTruck className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">My Vehicles</h1>
              <p className="text-xs text-gray-400">{allVehicles.length} vehicle{(allVehicles.length !== 1 ? 's' : '')}</p>
            </div>
          </div>
          <button
            onClick={function () { setShowForm(true) }}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-500 transition-colors shadow-sm"
          >
            <FiPlus className="w-4 h-4" />
            Add Vehicle
          </button>
        </div>

        {custom.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">My Custom Vehicles</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {custom.map(function (v) {
                var active = currentVehicle && currentVehicle.id === v.id
                return (
                  <VehicleCard
                    key={v.id}
                    vehicle={v}
                    active={active}
                    onSelect={handleSelect}
                    onRemove={handleRemove}
                    showRemove={true}
                  />
                )
              })}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Built-in Vehicles</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {builtIn.map(function (v) {
              var active = currentVehicle && currentVehicle.id === v.id
              return (
                <VehicleCard
                  key={v.id}
                  vehicle={v}
                  active={active}
                  onSelect={handleSelect}
                />
              )
            })}
          </div>
        </div>
      </div>

      {showForm && (
        <CustomVehicleForm
          onClose={function () { setShowForm(false) }}
          onAdded={handleAdded}
        />
      )}
    </div>
  )
}

function VehicleCard(props) {
  var { vehicle, active, onSelect, onRemove, showRemove } = props
  var range = getRange(vehicle)

  return (
    <div
      className={
        'rounded-xl border p-4 transition-all ' +
        (active
          ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-400/30'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-emerald-300 dark:hover:border-emerald-700')
      }
    >
      <div className="flex items-center gap-3 mb-3">
        <VehicleImage vehicle={vehicle} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{vehicle.make} {vehicle.model}</h3>
          <p className="text-xs text-gray-400">{vehicle.year} · {vehicle.battery_kwh} kWh</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1.5">
          <FiBatteryCharging className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{range} km range</span>
        </div>
        <div className="flex items-center gap-1.5">
          <FiZap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>{vehicle.fast_charge_kw} kW DC</span>
        </div>
      </div>

      <div className="text-[10px] text-gray-400 mb-3">
        {vehicle.consumption_wh_per_km} Wh/km · {vehicle.ac_charge_kw} kW AC
      </div>

      <div className="flex gap-2">
        <button
          onClick={function () { onSelect(vehicle) }}
          className={
            'flex-1 py-2 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ' +
            (active
              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400')
          }
        >
          {active ? (
            <><FiCheck className="w-3 h-3" /> Selected</>
          ) : (
            'Select'
          )}
        </button>
        {showRemove && (
          <button
            onClick={function () { onRemove(vehicle.id) }}
            className="px-3 py-2 text-xs font-medium rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-all flex items-center gap-1"
          >
            <FiTrash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  )
}
