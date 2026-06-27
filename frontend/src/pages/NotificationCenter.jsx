import { useEffect, useRef, useCallback } from 'react'
import { FiCheck, FiCheckCircle, FiTrash2, FiArrowLeft, FiInbox, FiBell } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../context/NotificationContext'
import NotificationIcon from '../components/notifications/NotificationIcon'

export default function NotificationCenter() {
  var {
    notifications, unreadCount, loading, hasMore, loadMore,
    markAsRead, markAllAsRead, removeNotification,
  } = useNotifications()
  var navigate = useNavigate()
  var scrollRef = useRef(null)
  var observerRef = useRef(null)

  var lastElementRef = useCallback(function (node) {
    if (observerRef.current) observerRef.current.disconnect()
    if (!node || !hasMore) return
    observerRef.current = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting && hasMore) {
        loadMore()
      }
    })
    observerRef.current.observe(node)
  }, [hasMore, loadMore])

  useEffect(function () {
    return function () {
      if (observerRef.current) observerRef.current.disconnect()
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pt-16">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={function () { navigate(-1) }}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
            >
              <FiArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Notifications</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {unreadCount > 0 ? unreadCount + ' unread' : 'All caught up'}
              </p>
            </div>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-xl transition-colors"
            >
              <FiCheckCircle className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
        </div>

        {loading && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="animate-spin w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full mb-3" />
            <span className="text-sm">Loading notifications...</span>
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <FiInbox className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">No notifications</h3>
            <p className="text-xs text-gray-400">You're all caught up!</p>
          </div>
        )}

        <div className="space-y-1" ref={scrollRef}>
          {notifications.map(function (n, idx) {
            var isLast = idx === notifications.length - 1
            return (
              <div
                key={n.id}
                ref={isLast ? lastElementRef : null}
                className={'flex items-start gap-4 p-4 rounded-2xl transition-colors ' + (
                  !n.is_read
                    ? 'bg-emerald-50/80 dark:bg-emerald-900/15 border border-emerald-100 dark:border-emerald-900/30'
                    : 'bg-white dark:bg-gray-900 border border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50'
                )}
              >
                <div className={'mt-0.5 w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ' + getBgColor(n.notification_type)}>
                  <NotificationIcon type={n.notification_type} className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={'text-sm ' + (!n.is_read ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300')}>
                        {n.title}
                      </p>
                      {n.message && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{n.message}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 dark:text-gray-600 whitespace-nowrap shrink-0 mt-0.5">
                      {n.time_ago}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <span className={'text-[10px] px-1.5 py-0.5 rounded-md font-medium ' + getBadgeColor(n.notification_type)}>
                      {n.notification_type}
                    </span>

                    {n.link && (
                      <button
                        onClick={function () { navigate(n.link) }}
                        className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        View details
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  {!n.is_read && (
                    <button
                      onClick={function () { markAsRead(n.id) }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                      title="Mark as read"
                    >
                      <FiCheck className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={function () { removeNotification(n.id) }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Delete"
                  >
                    <FiTrash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {hasMore && (
          <div className="flex justify-center py-6">
            <div className="animate-spin w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        )}
      </div>
    </div>
  )
}

function getBgColor(type) {
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

function getBadgeColor(type) {
  var map = {
    INFO: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    SUCCESS: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    WARNING: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    ERROR: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    BOOKING: 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
    PAYMENT: 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
    TRIP: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    WEATHER: 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400',
    AI: 'bg-fuchsia-50 dark:bg-fuchsia-900/30 text-fuchsia-600 dark:text-fuchsia-400',
    ADMIN: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  }
  return map[type] || map.INFO
}
