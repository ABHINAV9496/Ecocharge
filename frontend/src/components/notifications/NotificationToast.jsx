import { useEffect } from 'react'
import { useNotifications } from '../../context/NotificationContext'
import { useToast } from '../../context/ToastContext'
import NotificationIcon from './NotificationIcon'


var TYPE_TOAST_MAP = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  BOOKING: 'info',
  PAYMENT: 'success',
  TRIP: 'info',
  WEATHER: 'info',
  AI: 'info',
  ADMIN: 'info',
}

function tripToastType(title) {
  var t = (title || '').toLowerCase()
  if (t.indexOf('completed') !== -1) return 'success'
  if (t.indexOf('started') !== -1) return 'info'
  if (t.indexOf('planned') !== -1) return 'info'
  if (t.indexOf('stop') !== -1) return 'warning'
  return 'info'
}

export default function NotificationToastHandler() {
  var { notifications } = useNotifications()
  var showToast = useToast()

  useEffect(function () {
    if (notifications.length === 0) return

    var latest = notifications[0]
    if (!latest._toasted) {
      latest._toasted = true
      var toastType = TYPE_TOAST_MAP[latest.notification_type] || 'info'
      if (latest.notification_type === 'TRIP') {
        toastType = tripToastType(latest.title)
      }
      showToast(latest.title + (latest.message ? ': ' + latest.message : ''), toastType)
    }
  }, [notifications, showToast])

  return null
}
