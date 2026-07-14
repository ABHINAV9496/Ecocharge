import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { FiMapPin, FiPlus, FiChevronLeft, FiChevronRight, FiZap, FiEdit2, FiTrash2, FiUsers, FiCalendar, FiDollarSign, FiBarChart2, FiClock, FiSearch, FiStar } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Navbar from '../components/layout/Navbar'
import Sidebar from '../components/layout/Sidebar'
import { getStations, getMyStations, createStation, updateStation, deleteStation, getReviews, getMaintenanceSchedules } from '../api/stations'
import { getBookings } from '../api/bookings'
import { getPaymentHistory, deletePayment } from '../api/payments'
import { getUsers, updateUserRole, deleteUser } from '../api/users'
import { formatCurrency, formatDate, SLOT_TYPE_LABELS } from '../utils/formatters'

var TABS = [
  { key: 'users', label: 'Users', icon: FiUsers },
  { key: 'stations', label: 'Stations', icon: FiMapPin },
  { key: 'bookings', label: 'Bookings', icon: FiCalendar },
  { key: 'payments', label: 'Payments', icon: FiDollarSign },
]

function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg flex items-center justify-center">
        <Icon className="w-4 h-4 text-emerald-500" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
    </div>
  )
}

// ===== USERS TAB =====
function UsersTab() {
  var showToast = useToast()
  var [users, setUsers] = useState([])
  var [loading, setLoading] = useState(true)

  function loadUsers() {
    setLoading(true)
    getUsers().then(function (res) { setUsers(res.data) }).catch(function () { showToast('Failed to load users', 'error') }).finally(function () { setLoading(false) })
  }

  useEffect(loadUsers, [])

  async function handleRoleChange(userId, newRole) {
    try {
      await updateUserRole(userId, newRole)
      showToast('Role updated', 'success')
      loadUsers()
    } catch (e) { showToast('Could not update role', 'error') }
  }

  async function handleDelete(userId, username) {
    if (!window.confirm('Delete user "' + username + '"?')) return
    try {
      await deleteUser(userId)
      showToast('User deleted', 'success')
      loadUsers()
    } catch (e) { showToast('Could not delete user', 'error') }
  }

  var ROLE_COLORS = { SUPER_ADMIN: 'text-purple-500 bg-purple-100 dark:bg-purple-900/30', STATION_OWNER: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30', DRIVER: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30', GUEST: 'text-gray-500 bg-gray-100 dark:bg-gray-800' }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>

  return (
    <div className="p-6">
      <SectionHeader icon={FiUsers} title="User Management" subtitle="View and manage all platform users" />
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Username</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Joined</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {users.map(function (u) {
                var rc = ROLE_COLORS[u.role] || ROLE_COLORS.DRIVER
                return (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{u.username}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{u.email}</td>
                    <td className="px-4 py-3">
                      <select value={u.role} onChange={function (e) { handleRoleChange(u.id, e.target.value) }}
                        className={'text-xs font-medium px-2 py-1 rounded-lg border-0 outline-none ' + rc}>
                        <option value="DRIVER">Driver</option>
                        <option value="STATION_OWNER">Station Owner</option>
                        <option value="SUPER_ADMIN">Super Admin</option>
                        <option value="GUEST">Guest</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{u.date_joined ? formatDate(u.date_joined) : '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={function () { handleDelete(u.id, u.username) }} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all" title="Delete">
                        <FiTrash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ===== STATION TABLE (shared) =====
function StationTable({ stations, loading, onEdit, onDelete }) {
  var [expandedId, setExpandedId] = useState(null)
  var [reviewsData, setReviewsData] = useState({})
  var [maintenanceData, setMaintenanceData] = useState({})

  function toggleExpand(stationId) {
    if (expandedId === stationId) { setExpandedId(null); return }
    setExpandedId(stationId)
    if (!reviewsData[stationId]) {
      getReviews(stationId).then(function (res) { setReviewsData(Object.assign({}, reviewsData, { [stationId]: res.data || [] })) }).catch(function () {})
    }
    if (!maintenanceData[stationId]) {
      getMaintenanceSchedules(stationId).then(function (res) { setMaintenanceData(Object.assign({}, maintenanceData, { [stationId]: res.data || [] })) }).catch(function () {})
    }
  }

  function renderStars(rating) {
    return Array.from({ length: 5 }, function (_, i) {
      return <FiStar key={i} className={'w-3 h-3 ' + (i < rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600')} />
    })
  }

  if (loading) {
    return <div className="space-y-2 p-4">{[1,2,3,4,5].map(function (i) { return <div key={i} className="h-12 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" /> })}</div>
  }
  if (stations.length === 0) {
    return <div className="text-center py-12"><FiMapPin className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" /><p className="text-sm text-gray-500">No stations found</p></div>
  }
  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {stations.map(function (st) {
        var slots = st.slots || []
        var slotSummary = {}
        slots.forEach(function (s) { var label = SLOT_TYPE_LABELS[s.slot_type] || s.slot_type; slotSummary[label] = (slotSummary[label] || 0) + 1 })
        var availCount = slots.filter(function (s) { return s.available !== undefined ? s.available : s.status === 'AVAILABLE' }).length
        var occCount = slots.filter(function (s) { return s.status === 'OCCUPIED' }).length
        var faultCount = slots.filter(function (s) { return s.status === 'FAULT' }).length
        var isExpanded = expandedId === st.id
        var reviews = reviewsData[st.id]
        var maintenance = maintenanceData[st.id]
        return (
          <div key={st.id}>
            <div className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm text-gray-900 dark:text-white truncate">{st.name}</h4>
                  <span className={'px-2 py-0.5 text-xs font-medium rounded-full ' + (st.status === 'ACTIVE' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-600')}>{st.status}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{st.address}</p>
                <p className="text-xs text-gray-400 mt-0.5">Owner: {st.owner_username} | Slots: {Object.entries(slotSummary).map(function (e) { return e[0] + ': ' + e[1] }).join(', ') || 'None'}</p>
                {slots.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] font-medium text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">{availCount} Available</span>
                    {occCount > 0 && <span className="text-[10px] font-medium text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">{occCount} Occupied</span>}
                    {faultCount > 0 && <span className="text-[10px] font-medium text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">{faultCount} Fault</span>}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-3">
                <button onClick={function () { toggleExpand(st.id) }} className="p-2 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all" title="Details">
                  <FiBarChart2 className={'w-3.5 h-3.5 ' + (isExpanded ? 'text-emerald-500' : '')} />
                </button>
                {onEdit && (
                  <>
                    <button onClick={function () { onEdit(st) }} className="p-2 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all"><FiEdit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={function () { onDelete(st.id) }} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"><FiTrash2 className="w-3.5 h-3.5" /></button>
                  </>
                )}
              </div>
            </div>
            {isExpanded && (
              <div className="px-4 pb-4 bg-gray-50 dark:bg-gray-900 space-y-3">
                <div>
                  <h5 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Reviews</h5>
                  {reviews ? (reviews.length === 0 ? <p className="text-[10px] text-gray-400">No reviews</p> : reviews.map(function (r) {
                    return <div key={r.id} className="mb-1.5 p-2 bg-white dark:bg-gray-800 rounded-lg flex items-center justify-between">
                      <div><span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">{r.username}</span><div className="flex">{renderStars(r.rating)}</div></div>
                      {r.comment && <span className="text-[10px] text-gray-400 ml-2 truncate max-w-[200px]">{r.comment}</span>}
                    </div>
                  })) : <div className="text-[10px] text-gray-400">Loading...</div>}
                </div>
                <div>
                  <h5 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Maintenance</h5>
                  {maintenance ? (maintenance.length === 0 ? <p className="text-[10px] text-gray-400">No scheduled maintenance</p> : maintenance.slice(0, 3).map(function (m) {
                    return <div key={m.id} className="mb-1.5 p-2 bg-white dark:bg-gray-800 rounded-lg flex items-center justify-between text-[10px]">
                      <span className="text-gray-700 dark:text-gray-300">{m.reason}</span>
                      <span className={'px-1.5 py-0.5 font-medium rounded-full ' + (m.status === 'SCHEDULED' ? 'text-blue-500 bg-blue-100' : m.status === 'ACTIVE' ? 'text-amber-500 bg-amber-100' : 'text-emerald-500 bg-emerald-100')}>{m.status}</span>
                    </div>
                  })) : <div className="text-[10px] text-gray-400">Loading...</div>}
                </div>
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
      <button onClick={function () { onPageChange(Math.max(1, page - 1)) }} disabled={page <= 1} className="p-2 text-gray-500 hover:text-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed"><FiChevronLeft className="w-4 h-4" /></button>
      {Array.from({ length: totalPages }, function (_, i) { return i + 1 }).map(function (p) {
        return <button key={p} onClick={function () { onPageChange(p) }} className={'w-8 h-8 text-xs font-medium rounded-lg ' + (p === page ? 'bg-emerald-500 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700')}>{p}</button>
      })}
      <button onClick={function () { onPageChange(Math.min(totalPages, page + 1)) }} disabled={page >= totalPages} className="p-2 text-gray-500 hover:text-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed"><FiChevronRight className="w-4 h-4" /></button>
    </div>
  )
}

// ===== STATIONS TAB (all + mine) =====
function StationsTab() {
  var [mode, setMode] = useState('all')
  return (
    <div className="p-6">
      <SectionHeader icon={FiMapPin} title="Station Management" subtitle="View and manage all charging stations" />
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit mb-4">
        <button onClick={function () { setMode('all') }} className={'px-4 py-2 text-xs font-medium rounded-lg ' + (mode === 'all' ? 'bg-white dark:bg-gray-700 text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>All Stations</button>
        <button onClick={function () { setMode('mine') }} className={'px-4 py-2 text-xs font-medium rounded-lg ' + (mode === 'mine' ? 'bg-white dark:bg-gray-700 text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>My Stations</button>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        {mode === 'all' ? <AllStationsTab /> : <MyStationsTab />}
      </div>
    </div>
  )
}

function AllStationsTab() {
  var [stations, setStations] = useState([])
  var [page, setPage] = useState(1)
  var [totalPages, setTotalPages] = useState(1)
  var [loading, setLoading] = useState(true)
  var [search, setSearch] = useState('')
  function loadData(p, q) {
    setLoading(true)
    var params = { page: p }
    if (q) params.q = q
    getStations(params).then(function (res) { setStations(res.data.results || []); setTotalPages(Math.ceil((res.data.count || 0) / 10) || 1) }).catch(function () { }).finally(function () { setLoading(false) })
  }
  useEffect(function () { loadData(page, search) }, [page])
  function handleSearch(v) { setSearch(v); setPage(1); loadData(1, v) }
  return (
    <div>
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input type="text" placeholder="Search stations..." value={search} onChange={function (e) { handleSearch(e.target.value) }}
            className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
      </div>
      <StationTable stations={stations} loading={loading} />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
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
    getMyStations({ page: p, page_size: 10 }).then(function (res) { setStations(res.data.results || []); setTotalPages(Math.ceil((res.data.count || 0) / 10) || 1) }).catch(function () { showToast('Failed to load stations', 'error') }).finally(function () { setLoading(false) })
  }
  useEffect(function () { loadData(page) }, [page])
  function resetForm() { setShowForm(false); setEditing(null); setForm({ name: '', address: '', latitude: '', longitude: '', amenities: '', status: 'ACTIVE' }); setFormError('') }
  async function handleSave() {
    setFormError('')
    try {
      var payload = { name: form.name, address: form.address, latitude: form.latitude ? parseFloat(form.latitude) : null, longitude: form.longitude ? parseFloat(form.longitude) : null, status: form.status, amenities: form.amenities ? form.amenities.split(',').map(function (a) { return a.trim() }) : [] }
      if (editing) { await updateStation(editing.id, payload) } else { await createStation(payload) }
      loadData(page); resetForm(); showToast(editing ? 'Station updated' : 'Station created', 'success')
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
        <button onClick={function () { resetForm(); setShowForm(!showForm) }} className={'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl ' + (showForm ? 'bg-gray-100 dark:bg-gray-700 text-gray-600' : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-emerald-700')}><FiPlus className="w-3 h-3" />{showForm ? 'Cancel' : 'Add Station'}</button>
      </div>
      {showForm && (
        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-3">{editing ? 'Edit Station' : 'New Station'}</h4>
          {formError && <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/30 text-red-600 text-xs rounded-xl">{formError}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input type="text" placeholder="Name" value={form.name} onChange={function (e) { setForm(function (prev) { return { ...prev, name: e.target.value } }) }} className="px-3 py-2 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500" />
            <input type="text" placeholder="Address" value={form.address} onChange={function (e) { setForm(function (prev) { return { ...prev, address: e.target.value } }) }} className="px-3 py-2 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500" />
            <input type="number" step="any" placeholder="Latitude" value={form.latitude} onChange={function (e) { setForm(function (prev) { return { ...prev, latitude: e.target.value } }) }} className="px-3 py-2 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500" />
            <input type="number" step="any" placeholder="Longitude" value={form.longitude} onChange={function (e) { setForm(function (prev) { return { ...prev, longitude: e.target.value } }) }} className="px-3 py-2 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500" />
            <input type="text" placeholder="Amenities (comma separated)" value={form.amenities} onChange={function (e) { setForm(function (prev) { return { ...prev, amenities: e.target.value } }) }} className="px-3 py-2 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500" />
            <select value={form.status} onChange={function (e) { setForm(function (prev) { return { ...prev, status: e.target.value } }) }} className="px-3 py-2 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="MAINTENANCE">Maintenance</option>
            </select>
          </div>
          <button onClick={handleSave} className="mt-3 px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-medium rounded-xl hover:from-emerald-600 hover:to-emerald-700">{editing ? 'Update' : 'Create'}</button>
        </div>
      )}
      <StationTable stations={stations} loading={loading} onEdit={function (st) { setEditing(st); setForm({ name: st.name, address: st.address, latitude: st.latitude || '', longitude: st.longitude || '', amenities: (st.amenities || []).join(', '), status: st.status }); setShowForm(true) }} onDelete={function (id) { if (window.confirm('Delete this station?')) { deleteStation(id).then(function () { loadData(page); showToast('Station deleted', 'success') }).catch(function () { showToast('Could not delete station', 'error') }) } }} />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  )
}

// ===== BOOKINGS TAB =====
function BookingsTab() {
  var [bookings, setBookings] = useState([])
  var [loading, setLoading] = useState(true)
  var [statusFilter, setStatusFilter] = useState('ALL')
  var [search, setSearch] = useState('')
  var [page, setPage] = useState(1)
  var [totalPages, setTotalPages] = useState(1)

  function loadData(s, q, p) {
    setLoading(true)
    var params = { page: p, page_size: 10 }
    if (q) params.q = q
    if (s && s !== 'ALL') params.status = s
    getBookings(params).then(function (res) {
      var data = res.data.results || res.data
      setBookings(Array.isArray(data) ? data : [])
      if (res.data.count !== undefined) setTotalPages(Math.ceil((res.data.count || 0) / 10) || 1)
    }).catch(function () { }).finally(function () { setLoading(false) })
  }

  useEffect(function () { loadData(statusFilter, search, page) }, [statusFilter, page])

  function handleSearch(v) { setSearch(v); setPage(1); loadData(statusFilter, v, 1) }
  function handleStatus(s) { setStatusFilter(s); setPage(1); loadData(s, search, 1) }

  var STATUS_COLORS = { PENDING: 'text-amber-500 bg-amber-100 dark:bg-amber-900/30', CONFIRMED: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30', IN_PROGRESS: 'text-purple-500 bg-purple-100 dark:bg-purple-900/30', COMPLETED: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30', CANCELLED: 'text-red-500 bg-red-100 dark:bg-red-900/30' }

  return (
    <div className="p-6">
      <SectionHeader icon={FiCalendar} title="Booking Management" subtitle="View all platform bookings" />
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
          {['ALL', 'PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(function (s) {
            return <button key={s} onClick={function () { handleStatus(s) }} className={'px-3 py-1.5 text-xs font-medium rounded-lg ' + (statusFilter === s ? 'bg-white dark:bg-gray-700 text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>{s === 'ALL' ? 'All' : s}</button>
          })}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input type="text" placeholder="Search by ID, driver, or station..." value={search} onChange={function (e) { handleSearch(e.target.value) }}
            className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        {loading ? (
          <div className="space-y-2 p-4">{[1,2,3,4,5].map(function (i) { return <div key={i} className="h-12 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" /> })}</div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-12"><FiCalendar className="w-8 h-8 text-gray-300 mx-auto mb-3" /><p className="text-sm text-gray-500">No bookings found</p></div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {bookings.map(function (b) {
              var sc = STATUS_COLORS[b.status] || STATUS_COLORS.PENDING
              var stationName = b.slot_details ? b.slot_details.station_name : 'Slot #' + b.slot
              var slotType = b.slot_details ? b.slot_details.slot_type : null
              var durationStr = ''
              if (b.start_time && b.end_time) {
                var diffMs = new Date(b.end_time) - new Date(b.start_time)
                var diffH = Math.round(diffMs / 3600000 * 10) / 10
                durationStr = diffH >= 1 ? diffH + 'h' : Math.round(diffMs / 60000) + 'm'
              }
              return (
                <div key={b.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-gray-900 dark:text-white">{stationName}</span>
                      {slotType && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400">{slotType === 'DC_ULTRA' ? 'DC Ultra' : slotType === 'DC_FAST' ? 'DC Fast' : slotType === 'AC_FAST' ? 'AC Fast' : slotType === 'AC_SLOW' ? 'AC Slow' : slotType}</span>
                      )}
                      <span className={'text-xs font-medium px-2 py-0.5 rounded-full ' + sc}>{b.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 flex flex-wrap items-center gap-x-2">
                      Driver: {b.driver_username || 'N/A'} | {b.start_time ? formatDate(b.start_time) + ' ' + new Date(b.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'No date'}
                      {durationStr && <> | <FiClock className="w-3 h-3 inline" /> {durationStr}</>}
                      {b.vehicle_details && <> | <FiZap className="w-3 h-3 inline text-emerald-400" /> {b.vehicle_details.make} {b.vehicle_details.model}</>}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap ml-3">{formatCurrency(b.amount_charged)}</span>
                </div>
              )
            })}
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  )
}

// ===== PAYMENTS TAB =====
function PaymentsTab() {
  var showToast = useToast()
  var [payments, setPayments] = useState([])
  var [page, setPage] = useState(1)
  var [totalPages, setTotalPages] = useState(1)
  var [loading, setLoading] = useState(true)
  var [search, setSearch] = useState('')

  function loadData(p, q) {
    setLoading(true)
    var params = { page: p }
    if (q) params.q = q
    getPaymentHistory(params).then(function (res) {
      setPayments(res.data.payments || [])
      if (res.data.count !== undefined) setTotalPages(Math.ceil((res.data.count || 0) / 10) || 1)
    }).catch(function () { }).finally(function () { setLoading(false) })
  }

  useEffect(function () { loadData(page, search) }, [page])

  function handleSearch(v) { setSearch(v); setPage(1) }

  async function handleDelete(paymentId) {
    if (!window.confirm('Delete this payment record? This cannot be undone.')) return
    try {
      await deletePayment(paymentId)
      showToast('Payment deleted', 'success')
      loadData(page, search)
    } catch (e) {
      var msg = 'Could not delete payment'
      if (e.response && e.response.data && e.response.data.error) msg = e.response.data.error
      showToast(msg, 'error')
    }
  }

  var STATUS_STYLES = { CAPTURED: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30', AUTHORIZED: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30', CREATED: 'text-gray-500 bg-gray-100 dark:bg-gray-800', FAILED: 'text-red-500 bg-red-100 dark:bg-red-900/30', REFUNDED: 'text-amber-500 bg-amber-100 dark:bg-amber-900/30' }
  var DELETABLE = { CREATED: true, FAILED: true }

  return (
    <div className="p-6">
      <SectionHeader icon={FiDollarSign} title="Payment Management" subtitle="View all platform payments" />
      <div className="mb-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input type="text" placeholder="Search by ID, order, user, or station..." value={search} onChange={function (e) { handleSearch(e.target.value) }}
            className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        {loading ? (
          <div className="space-y-2 p-4">{[1,2,3,4,5].map(function (i) { return <div key={i} className="h-12 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" /> })}</div>
        ) : payments.length === 0 ? (
          <div className="text-center py-12"><FiDollarSign className="w-8 h-8 text-gray-300 mx-auto mb-3" /><p className="text-sm text-gray-500">No payments yet</p></div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {payments.map(function (p) {
              var sc = STATUS_STYLES[p.status] || STATUS_STYLES.CREATED
              return (
                <div key={p.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-gray-900 dark:text-white">{p.booking_station || 'Station'}</span>
                      <span className={'text-xs font-medium px-2 py-0.5 rounded-full ' + sc}>{p.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{formatDate(p.created_at)} | Order: {p.razorpay_order_id ? p.razorpay_order_id.slice(-8) : '-'}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(p.amount)}</span>
                    {DELETABLE[p.status] && (
                      <button onClick={function () { handleDelete(p.id) }} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all" title="Delete payment">
                        <FiTrash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  )
}

// ===== MAIN EXPORT =====
export default function AdminPage() {
  var { user } = useAuth()
  var [activeTab, setActiveTab] = useState('users')

  if (!user || user.role !== 'SUPER_ADMIN') {
    return <Navigate to="/dashboard" replace />
  }

  var TabIcon = TABS.find(function (t) { return t.key === activeTab }).icon

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <div className="pt-16 flex">
        <Sidebar />
        <div className="ml-16 md:ml-56 flex-1">
          <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center">
                <TabIcon className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Complete platform management</p>
              </div>
            </div>

            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit flex-wrap">
              {TABS.map(function (t) {
                var Icon = t.icon
                return (
                  <button key={t.key} onClick={function () { setActiveTab(t.key) }}
                    className={'flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-all ' + (activeTab === t.key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300')}>
                    <Icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                )
              })}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
              {activeTab === 'users' && <UsersTab />}
              {activeTab === 'stations' && <StationsTab />}
              {activeTab === 'bookings' && <BookingsTab />}
              {activeTab === 'payments' && <PaymentsTab />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
