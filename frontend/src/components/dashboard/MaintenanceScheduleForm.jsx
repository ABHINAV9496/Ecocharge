import { useState, useEffect } from 'react'
import { FiClock, FiTrash2 } from 'react-icons/fi'
import { getMaintenanceSchedules, createMaintenanceSchedule, deleteMaintenanceSchedule } from '../../api/stations'
import { useToast } from '../../context/ToastContext'
import { formatDate } from '../../utils/formatters'

export default function MaintenanceScheduleForm({ station, onSaved }) {
  var showToast = useToast()
  var [schedules, setSchedules] = useState([])
  var [loading, setLoading] = useState(true)
  var [showForm, setShowForm] = useState(false)
  var [form, setForm] = useState({ start_time: '', end_time: '', reason: '', slot: '' })
  var [formError, setFormError] = useState('')

  function loadSchedules() {
    setLoading(true)
    getMaintenanceSchedules(station.id).then(function (res) {
      setSchedules(res.data || [])
    }).catch(function () {}).finally(function () { setLoading(false) })
  }

  useEffect(loadSchedules, [station.id])

  async function handleCreate() {
    setFormError('')
    if (!form.start_time || !form.end_time || !form.reason) {
      setFormError('Start time, end time, and reason are required')
      return
    }
    if (new Date(form.end_time) <= new Date(form.start_time)) {
      setFormError('End time must be after start time')
      return
    }
    try {
      var payload = {
        start_time: form.start_time,
        end_time: form.end_time,
        reason: form.reason,
      }
      if (form.slot) payload.slot = parseInt(form.slot)
      await createMaintenanceSchedule(station.id, payload)
      showToast('Maintenance scheduled', 'success')
      setShowForm(false)
      setForm({ start_time: '', end_time: '', reason: '', slot: '' })
      loadSchedules()
      if (onSaved) onSaved()
    } catch (e) {
      setFormError('Could not schedule maintenance')
    }
  }

  async function handleDelete(scheduleId) {
    if (!window.confirm('Delete this maintenance schedule?')) return
    try {
      await deleteMaintenanceSchedule(station.id, scheduleId)
      showToast('Schedule deleted', 'success')
      loadSchedules()
    } catch (e) {
      showToast('Could not delete schedule', 'error')
    }
  }

  var STATUS_COLORS = {
    SCHEDULED: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30',
    ACTIVE: 'text-amber-500 bg-amber-100 dark:bg-amber-900/30',
    COMPLETED: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30',
  }

  return (
    <div className="mt-2">
      <button onClick={function () { setShowForm(!showForm) }} className="flex items-center gap-1.5 text-xs font-medium text-amber-500 hover:text-amber-600 transition-colors">
        <FiClock className="w-3.5 h-3.5" />
        {showForm ? 'Cancel' : 'Schedule Maintenance'}
      </button>

      {showForm && (
        <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          {formError && <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/30 text-red-600 text-[10px] rounded-lg">{formError}</div>}
          <div className="grid grid-cols-2 gap-2">
            <input type="datetime-local" value={form.start_time} onChange={function (e) { setForm(Object.assign({}, form, { start_time: e.target.value })) }}
              className="px-2 py-1.5 text-[10px] border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none" />
            <input type="datetime-local" value={form.end_time} onChange={function (e) { setForm(Object.assign({}, form, { end_time: e.target.value })) }}
              className="px-2 py-1.5 text-[10px] border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <input type="text" placeholder="Reason for maintenance" value={form.reason} onChange={function (e) { setForm(Object.assign({}, form, { reason: e.target.value })) }}
              className="col-span-2 px-2 py-1.5 text-[10px] border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none" />
            <select value={form.slot} onChange={function (e) { setForm(Object.assign({}, form, { slot: e.target.value })) }}
              className="col-span-2 px-2 py-1.5 text-[10px] border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none">
              <option value="">All slots (entire station)</option>
              {(station.slots || []).map(function (s) {
                return <option key={s.id} value={s.id}>{s.slot_type} - ₹{s.rate_per_kwh}</option>
              })}
            </select>
          </div>
          <button onClick={handleCreate} className="mt-2 px-3 py-1.5 text-[10px] font-medium bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg hover:from-amber-600 hover:to-amber-700">
            Schedule
          </button>
        </div>
      )}

      {loading ? (
        <div className="mt-2 text-[10px] text-gray-400">Loading schedules...</div>
      ) : schedules.length > 0 ? (
        <div className="mt-2 space-y-1.5">
          {schedules.slice(0, 3).map(function (s) {
            var sc = STATUS_COLORS[s.status] || STATUS_COLORS.SCHEDULED
            return (
              <div key={s.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-xl text-[10px]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={'px-1.5 py-0.5 font-medium rounded-full ' + sc}>{s.status}</span>
                    <span className="text-gray-700 dark:text-gray-300 truncate">{s.reason}</span>
                  </div>
                  <p className="text-gray-400 mt-0.5">{formatDate(s.start_time)} → {formatDate(s.end_time)}</p>
                </div>
                <button onClick={function () { handleDelete(s.id) }} className="p-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0 ml-2">
                  <FiTrash2 className="w-3 h-3" />
                </button>
              </div>
            )
          })}
          {schedules.length > 3 && (
            <p className="text-[10px] text-gray-400 text-center">+{schedules.length - 3} more schedules</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
