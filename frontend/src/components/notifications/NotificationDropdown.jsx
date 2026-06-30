import { useNavigate } from 'react-router-dom'
import { FiCheck, FiCheckCircle, FiTrash2, FiBell, FiInbox } from 'react-icons/fi'
import { useNotifications } from '../../context/NotificationContext'
import NotificationIcon from './NotificationIcon'

export default function NotificationDropdown(props) {
  var { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, loading } = useNotifications()
  var navigate = useNavigate()
  var recent = notifications.slice(0, 10)

  function handleClick(n) {
    if (!n.is_read) markAsRead(n.id)
    if (n.link) { navigate(n.link); props.onClose(); return }
    if (n.notification_type === 'TRIP' && n.data && n.data.trip_id) {
      navigate('/trips', { state: { tripId: n.data.trip_id } })
    } else if (n.notification_type === 'TRIP') {
      navigate('/trips')
    }
    if (n.notification_type === 'BOOKING' && n.data && n.data.booking_id) {
      navigate('/dashboard')
    }
    props.onClose()
  }

  return (
    <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl shadow-black/10 z-[100] overflow-hidden animate-fadeIn">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <FiBell className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</span>
          {unreadCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-red-500/10 text-red-500 rounded-full font-medium">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1 px-2 py-1 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
              title="Mark all as read"
            >
              <FiCheckCircle className="w-3 h-3" />
              <span className="hidden sm:inline">Mark all read</span>
            </button>
          )}
        </div>
      </div>

      <div className="max-h-[380px] overflow-y-auto">
        {loading && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <div className="animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full mb-2" />
            <span className="text-xs">Loading...</span>
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <FiInbox className="w-8 h-8 mb-2" />
            <span className="text-sm">No notifications yet</span>
          </div>
        )}

        {recent.map(function (n) {
          return (
            <div
              key={n.id}
              onClick={function () { handleClick(n) }}
              className={'flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b border-gray-50 dark:border-gray-800/50 ' + (!n.is_read ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : '')}
            >
              <div className={'mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ' + getBgColor(n.notification_type, n.title)}>
                <NotificationIcon type={n.notification_type} title={n.title} className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0">
                <p className={'text-sm ' + (n.is_read ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-white font-medium')}>
                  {n.title}
                </p>
                {n.message && (
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                )}
                <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1">{n.time_ago}</p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {!n.is_read && (
                  <button
                    onClick={function (e) { e.stopPropagation(); markAsRead(n.id) }}
                    className="p-1 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                    title="Mark as read"
                  >
                    <FiCheck className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={function (e) { e.stopPropagation(); removeNotification(n.id) }}
                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Delete"
                >
                  <FiTrash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 text-center">
        <button
          onClick={function () { navigate('/notifications'); props.onClose() }}
          className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
        >
          View all notifications
        </button>
      </div>
    </div>
  )
}

function getBgColor(type, title) {
  if (type === 'TRIP' && title) {
    var t = title.toLowerCase()
    if (t.indexOf('planned') !== -1) return 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
    if (t.indexOf('started') !== -1) return 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
    if (t.indexOf('completed') !== -1) return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
    if (t.indexOf('stop') !== -1) return 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
  }
  var map = {
    INFO: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    SUCCESS: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    WARNING: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    ERROR: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    BOOKING: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
    PAYMENT: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
    TRIP: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    WEATHER: 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400',
    AI: 'bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-600 dark:text-fuchsia-400',
    ADMIN: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  }
  return map[type] || map.INFO
}
