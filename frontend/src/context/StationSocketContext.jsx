import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'

var StationSocketContext = createContext(null)

var RECONNECT_BASE_MS = 1000
var RECONNECT_MAX_MS = 30000

export function StationSocketProvider(props) {
  var { user } = useAuth()
  var wsRef = useRef(null)
  var listenerRef = useRef(null)
  var reconnectTimerRef = useRef(null)
  var reconnectAttemptRef = useRef(0)
  var mountRef = useRef(true)
  var [connected, setConnected] = useState(false)

  useEffect(function () {
    mountRef.current = true

    if (!user) {
      if (wsRef.current) wsRef.current.close()
      setConnected(false)
      return
    }

    var baseUrl = import.meta.env.VITE_WS_STATIONS_URL || 'ws://127.0.0.1:8000/ws/stations/'

    function connect() {
      if (!mountRef.current) return

      var ws = new WebSocket(baseUrl)
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

          if (msg.type === 'connected') return

          if (msg.type === 'station_update' && listenerRef.current) {
            listenerRef.current(msg.station)
          }
        } catch (e) {
          console.error('Station WS parse error:', e)
        }
      }

      ws.onclose = function () {
        if (!mountRef.current || wsRef.current !== ws) return
        setConnected(false)
        var delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, reconnectAttemptRef.current), RECONNECT_MAX_MS)
        reconnectAttemptRef.current++
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

  var subscribe = useCallback(function (stationIds) {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', station_ids: stationIds }))
    }
  }, [])

  var onStationUpdate = useCallback(function (fn) {
    listenerRef.current = fn
  }, [])

  return (
    <StationSocketContext.Provider value={{
      connected: connected,
      subscribe: subscribe,
      onStationUpdate: onStationUpdate,
    }}>
      {props.children}
    </StationSocketContext.Provider>
  )
}

export function useStationSocket() {
  var ctx = useContext(StationSocketContext)
  if (!ctx) throw new Error('useStationSocket must be used within StationSocketProvider')
  return ctx
}

export default StationSocketContext
