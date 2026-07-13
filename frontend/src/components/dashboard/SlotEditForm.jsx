import { useState } from 'react'
import { FiX, FiCheck } from 'react-icons/fi'
import { updateSlot, deleteSlot } from '../../api/stations'
import { useToast } from '../../context/ToastContext'
import { SLOT_TYPE_LABELS } from '../../utils/formatters'

export default function SlotEditForm({ slot, stationId, onClose, onSaved }) {
  var showToast = useToast()
  var [form, setForm] = useState({
    slot_type: slot.slot_type,
    status: slot.status,
    rate_per_kwh: slot.rate_per_kwh,
    off_peak_rate: slot.off_peak_rate || '',
  })
  var [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await updateSlot(stationId, slot.id, {
        slot_type: form.slot_type,
        status: form.status,
        rate_per_kwh: parseFloat(form.rate_per_kwh),
        off_peak_rate: form.off_peak_rate ? parseFloat(form.off_peak_rate) : null,
      })
      showToast('Slot updated', 'success')
      onSaved()
    } catch (e) {
      showToast('Could not update slot', 'error')
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!window.confirm('Delete this slot? This cannot be undone.')) return
    try {
      await deleteSlot(stationId, slot.id)
      showToast('Slot deleted', 'success')
      onSaved()
    } catch (e) {
      showToast('Could not delete slot', 'error')
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap mt-1.5 p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
      <select value={form.slot_type} onChange={function (e) { setForm(function (prev) { return { ...prev, slot_type: e.target.value } }) }}
        className="flex-1 px-2 py-1 text-[10px] border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none">
        {Object.entries(SLOT_TYPE_LABELS).map(function (e) { return <option key={e[0]} value={e[0]}>{e[1]}</option> })}
      </select>
      <select value={form.status} onChange={function (e) { setForm(function (prev) { return { ...prev, status: e.target.value } }) }}
        className="w-24 px-2 py-1 text-[10px] border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none">
        <option value="AVAILABLE">Available</option>
        <option value="OCCUPIED">Occupied</option>
        <option value="FAULT">Fault</option>
      </select>
      <input type="number" step="0.01" value={form.rate_per_kwh} onChange={function (e) { setForm(function (prev) { return { ...prev, rate_per_kwh: e.target.value } }) }}
        className="w-16 px-2 py-1 text-[10px] border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none" placeholder="Rate" />
      <input type="number" step="0.01" value={form.off_peak_rate} onChange={function (e) { setForm(function (prev) { return { ...prev, off_peak_rate: e.target.value } }) }}
        className="w-16 px-2 py-1 text-[10px] border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none" placeholder="Off-peak" />
      <button onClick={handleSave} disabled={saving} className="px-2 py-1 text-[10px] font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50">
        <FiCheck className="w-3 h-3" />
      </button>
      <button onClick={handleDelete} className="px-2 py-1 text-[10px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
        <FiX className="w-3 h-3" />
      </button>
      <button onClick={onClose} className="px-2 py-1 text-[10px] font-medium text-gray-500 hover:text-gray-700 rounded-lg">
        Cancel
      </button>
    </div>
  )
}
