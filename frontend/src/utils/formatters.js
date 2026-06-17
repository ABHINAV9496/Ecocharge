export function formatChargeTime(seconds) {
  if (seconds < 60) return '< 1 min'
  var mins = Math.round(seconds / 60)
  if (mins < 60) return mins + ' min'
  var h = Math.floor(mins / 60)
  var m = mins % 60
  return h + 'h ' + (m > 0 ? m + 'm' : '')
}

export function formatSoC(value) {
  return (value || 0) + '%'
}

export function formatMoney(amount) {
  return '\u20B9 ' + (Math.round(amount * 100) / 100).toLocaleString('en-IN')
}

export function formatDistance(km) {
  if (km < 1) return Math.round(km * 1000) + ' m'
  return km.toFixed(1) + ' km'
}

export function formatHours(value) {
  var h = Math.floor(value)
  var m = Math.round((value - h) * 60)
  return h + 'h ' + m + 'm'
}

export function stationStatusColor(status) {
  switch ((status || '').toLowerCase()) {
    case 'active': return '#22c55e'
    case 'inactive': return '#ef4444'
    case 'maintenance': return '#f59e0b'
    case 'coming_soon': return '#3b82f6'
    default: return '#6b7280'
  }
}

export function slotTypeLabel(slotType) {
  var labels = {
    DC_ULTRA: 'DC Ultra (150 kW)',
    DC_FAST: 'DC Fast (50 kW)',
    AC_FAST: 'AC Fast (7.4 kW)',
    AC_SLOW: 'AC Slow (3.3 kW)',
  }
  return labels[slotType] || slotType || 'Unknown'
}

// Legacy aliases for backward compatibility

export function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return '\u20B9 0.00'
  return '\u20B9 ' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  var d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function getSlotTypeColor(slotType) {
  var colors = {
    DC_ULTRA: { bg: '#1e40af', text: '#dbeafe', border: '#3b82f6' },
    DC_FAST: { bg: '#065f46', text: '#d1fae5', border: '#10b981' },
    AC_FAST: { bg: '#92400e', text: '#fef3c7', border: '#f59e0b' },
    AC_SLOW: { bg: '#6b7280', text: '#f3f4f6', border: '#9ca3af' },
  }
  return colors[slotType] || colors.AC_SLOW
}

export var SLOT_TYPE_LABELS = {
  DC_ULTRA: 'DC Ultra (150 kW)',
  DC_FAST: 'DC Fast (50 kW)',
  AC_FAST: 'AC Fast (7.4 kW)',
  AC_SLOW: 'AC Slow (3.3 kW)',
}

export var ROLE_LABELS = {
  DRIVER: 'Driver',
  STATION_OWNER: 'Station Owner',
  SUPER_ADMIN: 'Admin',
}
