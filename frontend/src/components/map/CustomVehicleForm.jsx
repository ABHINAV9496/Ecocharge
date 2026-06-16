import { useState } from 'react'
import { FiX, FiPlus } from 'react-icons/fi'
import { addCustomVehicle } from '../../data/vehicleProfiles'

export default function CustomVehicleForm(props) {
  var { onClose, onAdded } = props
  var [form, setForm] = useState({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    battery_kwh: '',
    consumption_wh_per_km: '',
    fast_charge_kw: '',
    ac_charge_kw: '',
  })

  function set(field, value) {
    setForm(function (prev) { return { ...prev, [field]: value } })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    var vehicle = {
      make: form.make.trim(),
      model: form.model.trim(),
      year: parseInt(form.year) || new Date().getFullYear(),
      battery_kwh: parseFloat(form.battery_kwh),
      consumption_wh_per_km: parseFloat(form.consumption_wh_per_km),
      fast_charge_kw: parseFloat(form.fast_charge_kw) || 0,
      ac_charge_kw: parseFloat(form.ac_charge_kw) || 0,
    }
    if (!vehicle.make || !vehicle.model || !vehicle.battery_kwh || !vehicle.consumption_wh_per_km) return
    try {
      var saved = await addCustomVehicle(vehicle)
      onAdded(saved)
      onClose()
    } catch (err) {
      console.error('Failed to save custom vehicle:', err)
    }
  }

  var inputClass = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500 transition-colors'

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden" onClick={function (e) { e.stopPropagation() }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-white">Add Custom Vehicle</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-800 text-gray-400 transition-colors">
            <FiX className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1 block">Make</label>
              <input type="text" placeholder="e.g. Tesla" value={form.make} onChange={function (e) { set('make', e.target.value) }} className={inputClass} required />
            </div>
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1 block">Model</label>
              <input type="text" placeholder="e.g. Model 3" value={form.model} onChange={function (e) { set('model', e.target.value) }} className={inputClass} required />
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1 block">Year</label>
              <input type="number" value={form.year} onChange={function (e) { set('year', e.target.value) }} className={inputClass} />
            </div>
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1 block">Battery (kWh)</label>
              <input type="number" step="0.1" placeholder="e.g. 75" value={form.battery_kwh} onChange={function (e) { set('battery_kwh', e.target.value) }} className={inputClass} required />
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1 block">Consumption (Wh/km)</label>
              <input type="number" placeholder="e.g. 180" value={form.consumption_wh_per_km} onChange={function (e) { set('consumption_wh_per_km', e.target.value) }} className={inputClass} required />
            </div>
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1 block">Fast Charge (kW)</label>
              <input type="number" placeholder="e.g. 50" value={form.fast_charge_kw} onChange={function (e) { set('fast_charge_kw', e.target.value) }} className={inputClass} />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1 block">AC Charge (kW)</label>
            <input type="number" step="0.1" placeholder="e.g. 7.4" value={form.ac_charge_kw} onChange={function (e) { set('ac_charge_kw', e.target.value) }} className={inputClass} />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 mt-2"
          >
            <FiPlus className="w-4 h-4" />
            Add Vehicle
          </button>
        </form>
      </div>
    </div>
  )
}
