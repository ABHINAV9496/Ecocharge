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

  var [errors, setErrors] = useState({})
  var CURRENT_YEAR = new Date().getFullYear()

  function validate() {
    var e = {}
    var make = form.make.trim()
    var model = form.model.trim()

    if (!make) e.make = 'Make is required'
    else if (make.length > 50) e.make = 'Max 50 characters'
    else if (!/^[A-Za-z\s.\-]+$/.test(make)) e.make = 'Only letters, spaces, hyphens and dots'

    if (!model) e.model = 'Model is required'
    else if (model.length > 50) e.model = 'Max 50 characters'
    else if (!/^[A-Za-z0-9\s\-]+$/.test(model)) e.model = 'Only letters, numbers, spaces and hyphens'

    var year = parseInt(form.year)
    if (!year || isNaN(year)) e.year = 'Year is required'
    else if (year < 2010 || year > CURRENT_YEAR + 1) e.year = 'Year must be 2010\u2013' + (CURRENT_YEAR + 1)

    var bat = parseFloat(form.battery_kwh)
    if (!bat || isNaN(bat)) e.battery_kwh = 'Battery capacity is required'
    else if (bat < 5 || bat > 250) e.battery_kwh = 'Must be 5\u2013250 kWh'

    var con = parseFloat(form.consumption_wh_per_km)
    if (!con || isNaN(con)) e.consumption_wh_per_km = 'Consumption is required'
    else if (con < 80 || con > 500) e.consumption_wh_per_km = 'Must be 80\u2013500 Wh/km'

    var fc = parseFloat(form.fast_charge_kw)
    if (fc && (fc < 0 || fc > 500)) e.fast_charge_kw = 'Must be 0\u2013500 kW'

    var ac = parseFloat(form.ac_charge_kw)
    if (ac && (ac < 0 || ac > 50)) e.ac_charge_kw = 'Must be 0\u201350 kW'

    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrors({})
    if (!validate()) return
    var vehicle = {
      make: form.make.trim(),
      model: form.model.trim(),
      year: parseInt(form.year) || new Date().getFullYear(),
      battery_kwh: parseFloat(form.battery_kwh),
      consumption_wh_per_km: parseFloat(form.consumption_wh_per_km),
      fast_charge_kw: parseFloat(form.fast_charge_kw) || 0,
      ac_charge_kw: parseFloat(form.ac_charge_kw) || 0,
    }
    try {
      var saved = await addCustomVehicle(vehicle)
      onAdded(saved)
      onClose()
    } catch (err) {
      console.error('Failed to save custom vehicle:', err)
    }
  }

  function inputCls(field) {
    return 'w-full bg-gray-800 border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500 transition-colors ' + (errors[field] ? 'border-red-500' : 'border-gray-700')
  }

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
              <input type="text" placeholder="e.g. Tesla" value={form.make} onChange={function (e) { set('make', e.target.value.replace(/[^A-Za-z\s.\-]/g, '')) }} className={inputCls('make')} maxLength="50" />
              {errors.make && <p className="text-[10px] text-red-400 mt-0.5">{errors.make}</p>}
            </div>
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1 block">Model</label>
              <input type="text" placeholder="e.g. Model 3" value={form.model} onChange={function (e) { set('model', e.target.value.replace(/[^A-Za-z0-9\s\-]/g, '')) }} className={inputCls('model')} maxLength="50" />
              {errors.model && <p className="text-[10px] text-red-400 mt-0.5">{errors.model}</p>}
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1 block">Year</label>
              <input type="number" value={form.year} onChange={function (e) { set('year', e.target.value) }} className={inputCls('year')} min="2010" max="2027" />
              {errors.year && <p className="text-[10px] text-red-400 mt-0.5">{errors.year}</p>}
            </div>
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1 block">Battery (kWh)</label>
              <input type="number" step="0.1" placeholder="e.g. 75" value={form.battery_kwh} onChange={function (e) { set('battery_kwh', e.target.value) }} className={inputCls('battery_kwh')} min="5" max="250" />
              {errors.battery_kwh && <p className="text-[10px] text-red-400 mt-0.5">{errors.battery_kwh}</p>}
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1 block">Consumption (Wh/km)</label>
              <input type="number" placeholder="e.g. 180" value={form.consumption_wh_per_km} onChange={function (e) { set('consumption_wh_per_km', e.target.value) }} className={inputCls('consumption_wh_per_km')} min="80" max="500" />
              {errors.consumption_wh_per_km && <p className="text-[10px] text-red-400 mt-0.5">{errors.consumption_wh_per_km}</p>}
            </div>
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1 block">Fast Charge (kW)</label>
              <input type="number" placeholder="e.g. 50" value={form.fast_charge_kw} onChange={function (e) { set('fast_charge_kw', e.target.value) }} className={inputCls('fast_charge_kw')} min="0" max="500" />
              {errors.fast_charge_kw && <p className="text-[10px] text-red-400 mt-0.5">{errors.fast_charge_kw}</p>}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1 block">AC Charge (kW)</label>
            <input type="number" step="0.1" placeholder="e.g. 7.4" value={form.ac_charge_kw} onChange={function (e) { set('ac_charge_kw', e.target.value) }} className={inputCls('ac_charge_kw')} min="0" max="50" />
            {errors.ac_charge_kw && <p className="text-[10px] text-red-400 mt-0.5">{errors.ac_charge_kw}</p>}
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
