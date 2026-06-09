export const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount)

export const formatDate = (date) =>
  new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))

export const getSlotTypeColor = (type) => {
  const colors = {
    AC_SLOW: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    AC_FAST: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    DC_FAST: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    DC_ULTRA: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  }
  return colors[type] || 'bg-gray-100 text-gray-800'
}

export const getStatusColor = (status) => {
  const colors = {
    AVAILABLE: 'text-green-600 dark:text-green-400',
    OCCUPIED: 'text-orange-600 dark:text-orange-400',
    FAULT: 'text-red-600 dark:text-red-400',
    ACTIVE: 'text-green-600 dark:text-green-400',
    INACTIVE: 'text-gray-600 dark:text-gray-400',
    MAINTENANCE: 'text-yellow-600 dark:text-yellow-400',
  }
  return colors[status] || 'text-gray-600'
}

export const getMarkerColor = (status) => {
  if (status === 'ACTIVE') return 'green'
  if (status === 'INACTIVE') return 'gray'
  if (status === 'MAINTENANCE') return 'orange'
  return 'blue'
}

export const SLOT_TYPE_LABELS = {
  AC_SLOW: 'AC Slow (3.3kW)',
  AC_FAST: 'AC Fast (7.4kW)',
  DC_FAST: 'DC Fast (50kW)',
  DC_ULTRA: 'DC Ultra (150kW)',
}

export const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  STATION_OWNER: 'Station Owner',
  DRIVER: 'Driver',
  GUEST: 'Guest',
}
