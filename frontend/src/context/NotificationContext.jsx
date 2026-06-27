import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useEvents } from './EventContext'
import { getNotifications, markRead as markReadApi, markAllRead as markAllReadApi, deleteNotification as deleteApi } from '../api/notifications'

var NotificationContext = createContext(null)

export function NotificationProvider(props) {
  var { addListener, connected } = useEvents()
  var [notifications, setNotifications] = useState([])
  var [unreadCount, setUnreadCount] = useState(0)
  var [loading, setLoading] = useState(true)
  var [totalCount, setTotalCount] = useState(0)
  var [page, setPage] = useState(1)
  var hasMoreRef = useRef(true)
  var loadingRef = useRef(false)
  var prevConnectedRef = useRef(false)

  var fetchNotifications = useCallback(async function (pageNum, append) {
    if (loadingRef.current) return
    loadingRef.current = true
    if (!append) setLoading(true)
    try {
      var res = await getNotifications({ page: pageNum, page_size: 20 })
      var data = res.data
      var marked = data.results.map(function (n) { n._toasted = true; return n })
      if (append) {
        setNotifications(function (prev) { return prev.concat(marked) })
      } else {
        setNotifications(marked)
      }
      setUnreadCount(data.unread_count)
      setTotalCount(data.count)
      hasMoreRef.current = data.results.length === 20
      setPage(pageNum)
    } catch (e) {
      console.error('Failed to fetch notifications', e)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [])

  useEffect(function () {
    fetchNotifications(1, false)
  }, [fetchNotifications])

  useEffect(function () {
    if (connected && !prevConnectedRef.current) {
      fetchNotifications(1, false)
    }
    prevConnectedRef.current = connected
  }, [connected, fetchNotifications])

  var loadMore = useCallback(function () {
    if (hasMoreRef.current && !loadingRef.current) {
      fetchNotifications(page + 1, true)
    }
  }, [fetchNotifications, page])

  useEffect(function () {
    if (!addListener) return

    var unsubs = [
      addListener('notification.info', function (payload) {
        handleNewNotification(payload)
      }),
      addListener('notification.success', function (payload) {
        handleNewNotification(payload)
      }),
      addListener('notification.warning', function (payload) {
        handleNewNotification(payload)
      }),
      addListener('notification.error', function (payload) {
        handleNewNotification(payload)
      }),
      addListener('notification.booking', function (payload) {
        handleNewNotification(payload)
      }),
      addListener('notification.payment', function (payload) {
        handleNewNotification(payload)
      }),
      addListener('notification.trip', function (payload) {
        handleNewNotification(payload)
      }),
      addListener('notification.weather', function (payload) {
        handleNewNotification(payload)
      }),
      addListener('notification.ai', function (payload) {
        handleNewNotification(payload)
      }),
      addListener('notification.admin', function (payload) {
        handleNewNotification(payload)
      }),
    ]

    function handleNewNotification(payload) {
      setNotifications(function (prev) { return [payload].concat(prev) })
      setUnreadCount(function (prev) { return prev + 1 })
      setTotalCount(function (prev) { return prev + 1 })

      if (typeof window.__onNewNotification === 'function') {
        window.__onNewNotification(payload)
      }
    }

    return function () {
      unsubs.forEach(function (fn) { fn() })
    }
  }, [addListener])

  var markAsRead = useCallback(async function (id) {
    try {
      await markReadApi(id)
    } catch (e) { /* ignore */ }
    setNotifications(function (prev) {
      return prev.map(function (n) {
        if (n.id === id && !n.is_read) {
          setUnreadCount(function (c) { return Math.max(0, c - 1) })
          return Object.assign({}, n, { is_read: true })
        }
        return n
      })
    })
  }, [])

  var markAllAsRead = useCallback(async function () {
    try {
      await markAllReadApi()
    } catch (e) { /* ignore */ }
    setNotifications(function (prev) {
      return prev.map(function (n) {
        if (!n.is_read) return Object.assign({}, n, { is_read: true })
        return n
      })
    })
    setUnreadCount(0)
  }, [])

  var removeNotification = useCallback(async function (id) {
    try {
      await deleteApi(id)
    } catch (e) { /* ignore */ }
    setNotifications(function (prev) {
      var removed = prev.find(function (n) { return n.id === id })
      if (removed && !removed.is_read) {
        setUnreadCount(function (c) { return Math.max(0, c - 1) })
      }
      return prev.filter(function (n) { return n.id !== id })
    })
    setTotalCount(function (c) { return Math.max(0, c - 1) })
  }, [])

  return (
    <NotificationContext.Provider value={{
      notifications: notifications,
      unreadCount: unreadCount,
      totalCount: totalCount,
      loading: loading,
      hasMore: hasMoreRef.current,
      loadMore: loadMore,
      markAsRead: markAsRead,
      markAllAsRead: markAllAsRead,
      removeNotification: removeNotification,
      refetch: function () { fetchNotifications(1, false) },
    }}>
      {props.children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  var ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}

export default NotificationContext
