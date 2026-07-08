import { useState, useEffect, useRef } from 'react'
import { FiBell, FiCheck } from 'react-icons/fi'
import { getNotifications, markRead, markAllRead } from '../../api/notifications'
import { formatDate } from '../../utils/formatters'

export default function NotificationBell() {
  var [notifications, setNotifications] = useState([])
  var [unreadCount, setUnreadCount] = useState(0)
  var [open, setOpen] = useState(false)
  var ref = useRef(null)

  function load() {
    getNotifications({ page_size: 10 }).then(function (res) {
      setNotifications(res.data.results || [])
      setUnreadCount(res.data.unread_count || 0)
    }).catch(function () {})
  }

  useEffect(function () {
    load()
    var interval = setInterval(load, 30000)
    return function () { clearInterval(interval) }
  }, [])

  useEffect(function () {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return function () { document.removeEventListener('mousedown', handleClick) }
  }, [])

  function handleMarkRead(id) {
    markRead(id).then(function () {
      setNotifications(notifications.map(function (n) {
        return n.id === id ? Object.assign({}, n, { is_read: true }) : n
      }))
      setUnreadCount(Math.max(0, unreadCount - 1))
    }).catch(function () {})
  }

  function handleMarkAllRead() {
    markAllRead().then(function () {
      setNotifications(notifications.map(function (n) { return Object.assign({}, n, { is_read: true }) }))
      setUnreadCount(0)
    }).catch(function () {})
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={function () { setOpen(!open) }} className="relative p-2 text-gray-500 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all">
        <FiBell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <span className="text-xs font-semibold text-gray-900 dark:text-white">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-[10px] font-medium text-emerald-500 hover:text-emerald-600 flex items-center gap-1">
                <FiCheck className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-gray-400">No notifications</div>
            ) : (
              notifications.map(function (n) {
                return (
                  <div key={n.id} className={'px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors ' + (!n.is_read ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : '')}
                    onClick={function () { if (!n.is_read) handleMarkRead(n.id) }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={'text-xs ' + (n.is_read ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-white font-medium')}>{n.title}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                      </div>
                      {!n.is_read && <span className="shrink-0 w-2 h-2 bg-emerald-500 rounded-full mt-1" />}
                    </div>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{formatDate(n.created_at)}</p>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
