import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'

var EventContext = createContext(null)

var RECONNECT_BASE_MS = 1000
var RECONNECT_MAX_MS = 30000

export function EventProvider(props) {
  var { user } = useAuth()
  var wsRef = useRef(null)
  var listenersRef = useRef({})
  var reconnectTimerRef = useRef(null)
  var reconnectAttemptRef = useRef(0)
  var mountRef = useRef(true)
  var tokenRef = useRef(null)
  var [connected, setConnected] = useState(false)
  var [lastEvent, setLastEvent] = useState(null)

  var addListener = useCallback(function (eventType, fn) {
    if (!listenersRef.current[eventType]) {
      listenersRef.current[eventType] = []
    }
    listenersRef.current[eventType].push(fn)
    return function () {
      var arr = listenersRef.current[eventType]
      if (arr) {
        listenersRef.current[eventType] = arr.filter(function (f) { return f !== fn })
      }
    }
  }, [])

  var removeListener = useCallback(function (eventType, fn) {
    var arr = listenersRef.current[eventType]
    if (arr) {
      listenersRef.current[eventType] = arr.filter(function (f) { return f !== fn })
    }
  }, [])

  useEffect(function () {
    mountRef.current = true

    if (!user) {
      if (wsRef.current) wsRef.current.close()
      setConnected(false)
      return
    }

    var token = localStorage.getItem('access_token')
    if (!token) return
    tokenRef.current = token

    var baseUrl = import.meta.env.VITE_WS_EVENTS_URL || 'ws://127.0.0.1:8000/ws/events/'
    var url = baseUrl + '?token=' + token

    function connect() {
      if (!mountRef.current) return

      var ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = function () {
        if (!mountRef.current || wsRef.current !== ws) { ws.close(); return }
        reconnectAttemptRef.current = 0
        setConnected(true)
      }

      ws.onmessage = function (evt) {
        try {
          if (wsRef.current !== ws) return

          var msg = JSON.parse(evt.data)

          if (msg.type === 'connected') {
            return
          }

          if (msg.type === 'pong') {
            return
          }

          if (msg.type === 'event') {
            var eventType = msg.event_type
            var payload = msg.payload
            setLastEvent({ eventType: eventType, payload: payload, timestamp: Date.now() })

            if (listenersRef.current[eventType]) {
              listenersRef.current[eventType].forEach(function (fn) {
                try { fn(payload) } catch (e) { console.error('Event listener error:', e) }
              })
            }

            if (listenersRef.current['*']) {
              listenersRef.current['*'].forEach(function (fn) {
                try { fn(msg) } catch (e) { console.error('Wildcard listener error:', e) }
              })
            }
          }
        } catch (e) {
          console.error('Event WS parse error:', e)
        }
      }

      ws.onclose = function () {
        if (!mountRef.current || wsRef.current !== ws) return
        setConnected(false)

        var attempt = reconnectAttemptRef.current
        var delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, attempt), RECONNECT_MAX_MS)
        reconnectAttemptRef.current = attempt + 1

        reconnectTimerRef.current = setTimeout(connect, delay)
      }

      ws.onerror = function () {
        if (wsRef.current === ws) ws.close()
      }
    }

    connect()

    return function () {
      mountRef.current = false
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      if (wsRef.current) wsRef.current.close()
    }
  }, [user])

  return (
    <EventContext.Provider value={{
      connected: connected,
      lastEvent: lastEvent,
      addListener: addListener,
      removeListener: removeListener,
    }}>
      {props.children}
    </EventContext.Provider>
  )
}

export function useEvents() {
  var context = useContext(EventContext)
  if (!context) {
    throw new Error('useEvents must be used inside of EventProvider')
  }
  return context
}

export default EventContext
