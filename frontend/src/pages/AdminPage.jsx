import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { FiMapPin, FiPlus, FiChevronLeft, FiChevronRight, FiZap, FiEdit2, FiTrash2 } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Navbar from '../components/layout/Navbar'
import Sidebar from '../components/layout/Sidebar'
import { getStations, getMyStations, createStation, updateStation, deleteStation } from '../api/stations'
import { SLOT_TYPE_LABELS } from '../utils/formatters'

var TABS = [
  { key: 'all', label: 'All Stations' },
  { key: 'mine', label: 'My Stations' },
]

function StationTable({ stations, loading, onEdit, onDelete }) {
  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[1,2,3,4,5].map(function (i) {
          return <div key={i} className="h-12 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
        })}
      </div>
    )
  }
  if (stations.length === 0) {
    return (
      <div className="text-center py-12">
        <FiMapPin className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">No stations found</p>
      </div>
    )
  }
  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {stations.map(function (st) {
        var slots = st.slots || []
        var slotSummary = {}
        slots.forEach(function (s) {
          var label = SLOT_TYPE_LABELS[s.slot_type] || s.slot_type
          slotSummary[label] = (slotSummary[label] || 0) + 1
        })
        return (
          <div key={st.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-sm text-gray-900 dark:text-white truncate">{st.name}</h4>
                <span className={'px-2 py-0.5 text-xs font-medium rounded-full ' + (st.status === 'ACTIVE' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400')}>{st.status}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{st.address}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Owner: {st.owner_username} | Slots: {Object.entries(slotSummary).map(function (e) { return e[0] + ': ' + e[1] }).join(', ') || 'None'}</p>
            </div>
            {onEdit && (
              <div className="flex items-center gap-1 shrink-0 ml-3">
                <button onClick={function () { onEdit(st) }} className="p-2 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all" title="Edit">
                  <FiEdit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={function () { onDelete(st.id) }} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all" title="Delete">
                  <FiTrash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
      <button onClick={function () { onPageChange(Math.max(1, page - 1)) }} disabled={page <= 1}
        className="p-2 text-gray-500 dark:text-gray-400 hover:text-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <FiChevronLeft className="w-4 h-4" />
      </button>
      {Array.from({ length: totalPages }, function (_, i) { return i + 1 }).map(function (p) {
        return (
          <button key={p} onClick={function () { onPageChange(p) }}
            className={'w-8 h-8 text-xs font-medium rounded-lg transition-all ' + (p === page ? 'bg-emerald-500 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700')}>
            {p}
          </button>
        )
      })}
      <button onClick={function () { onPageChange(Math.min(totalPages, page + 1)) }} disabled={page >= totalPages}
        className="p-2 text-gray-500 dark:text-gray-400 hover:text-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <FiChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

function MyStationsTab() {
  var showToast = useToast()
  var [stations, setStations] = useState([])
  var [page, setPage] = useState(1)
  var [totalPages, setTotalPages] = useState(1)
  var [loading, setLoading] = useState(true)
  var [showForm, setShowForm] = useState(false)
  var [editing, setEditing] = useState(null)
  var [form, setForm] = useState({ name: '', address: '', latitude: '', longitude: '', amenities: '', status: 'ACTIVE' })
  var [formError, setFormError] = useState('')

  function loadData(p) {
    setLoading(true)
    getMyStations({ page: p, page_size: 10 }).then(function (res) {
      setStations(res.data.results || [])
      setTotalPages(Math.ceil((res.data.count || 0) / 10) || 1)
    }).catch(function () { showToast('Failed to load stations', 'error') }).finally(function () { setLoading(false) })
  }

  useEffect(function () { loadData(page) }, [page])

  function resetForm() {
    setShowForm(false); setEditing(null); setForm({ name: '', address: '', latitude: '', longitude: '', amenities: '', status: 'ACTIVE' }); setFormError('')
  }

  async function handleSave() {
    setFormError('')
    try {
      var payload = {
        name: form.name, address: form.address,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        status: form.status,
        amenities: form.amenities ? form.amenities.split(',').map(function (a) { return a.trim() }) : [],
      }
      if (editing) { await updateStation(editing.id, payload) }
      else { await createStation(payload) }
      loadData(page); resetForm()
      showToast(editing ? 'Station updated' : 'Station created', 'success')
    } catch (error) {
      var msg = 'Failed to save station'
      if (error.response && error.response.data) { msg = Object.values(error.response.data).flat().join(', ') || msg }
      setFormError(msg)
    }
  }

  return (
    <div>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">My Stations</h3>
        <button onClick={function () { resetForm(); setShowForm(!showForm) }}
          className={'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl transition-all ' + (showForm ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-emerald-700')}>
          <FiPlus className="w-3 h-3" />
          {showForm ? 'Cancel' : 'Add Station'}
        </button>
      </div>
      {showForm && (
        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-3">{editing ? 'Edit Station' : 'New Station'}</h4>
          {formError && <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded-xl">{formError}</div>}
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="Name" value={form.name} onChange={function (e) { setForm(Object.assign({}, form, { name: e.target.value })) }}
              className="px-3 py-2 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" />
            <input type="text" placeholder="Address" value={form.address} onChange={function (e) { setForm(Object.assign({}, form, { address: e.target.value })) }}
              className="px-3 py-2 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" />
            <input type="number" step="any" placeholder="Latitude" value={form.latitude} onChange={function (e) { setForm(Object.assign({}, form, { latitude: e.target.value })) }}
              className="px-3 py-2 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" />
            <input type="number" step="any" placeholder="Longitude" value={form.longitude} onChange={function (e) { setForm(Object.assign({}, form, { longitude: e.target.value })) }}
              className="px-3 py-2 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" />
            <input type="text" placeholder="Amenities (comma separated)" value={form.amenities} onChange={function (e) { setForm(Object.assign({}, form, { amenities: e.target.value })) }}
              className="px-3 py-2 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" />
            <select value={form.status} onChange={function (e) { setForm(Object.assign({}, form, { status: e.target.value })) }}
              className="px-3 py-2 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="MAINTENANCE">Maintenance</option>
            </select>
          </div>
          <button onClick={handleSave} className="mt-3 px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-medium rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all">
            {editing ? 'Update' : 'Create'}
          </button>
        </div>
      )}
      <StationTable stations={stations} loading={loading}
        onEdit={function (st) { setEditing(st); setForm({ name: st.name, address: st.address, latitude: st.latitude || '', longitude: st.longitude || '', amenities: (st.amenities || []).join(', '), status: st.status }); setShowForm(true) }}
        onDelete={function (id) { if (window.confirm('Delete this station?')) { deleteStation(id).then(function () { loadData(page); showToast('Station deleted', 'success') }).catch(function () { showToast('Could not delete station', 'error') }) } }} />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  )
}

function AllStationsTab() {
  var [stations, setStations] = useState([])
  var [page, setPage] = useState(1)
  var [totalPages, setTotalPages] = useState(1)
  var [loading, setLoading] = useState(true)

  function loadData(p) {
    setLoading(true)
    getStations({ page: p }).then(function (res) {
      setStations(res.data.results || [])
      setTotalPages(Math.ceil((res.data.count || 0) / 10) || 1)
    }).catch(function () { setStations([]) }).finally(function () { setLoading(false) })
  }

  useEffect(function () { loadData(page) }, [page])

  return (
    <div>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">All Stations</h3>
      </div>
      <StationTable stations={stations} loading={loading} />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  )
}

export default function AdminPage() {
  var { user } = useAuth()
  var [activeTab, setActiveTab] = useState('all')

  if (!user || user.role !== 'SUPER_ADMIN') {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <div className="pt-16 flex">
        <Sidebar />
        <div className="ml-16 md:ml-56 flex-1">
          <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center">
                <FiZap className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Manage all charging stations</p>
              </div>
            </div>

            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
              {TABS.map(function (t) {
                return (
                  <button key={t.key} onClick={function () { setActiveTab(t.key) }}
                    className={'px-4 py-2 text-xs font-medium rounded-lg transition-all ' + (activeTab === t.key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300')}>
                    {t.label}
                  </button>
                )
              })}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
              {activeTab === 'all' ? <AllStationsTab /> : <MyStationsTab />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
