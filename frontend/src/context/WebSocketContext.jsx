import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'

var WebSocketContext = createContext(null)

export function WebSocketProvider(props) {
  var ws = useRef(null)
  var [connected, setConnected] = useState(false)
  var [statuses, setStatuses] = useState({})
  var [stationUpdates, setStationUpdates] = useState({})
  var listenersRef = useRef({})
  var reconnectTimerRef = useRef(null)
  var mountRef = useRef(true)
  var stationIdsRef = useRef([])
  var singleStationIdRef = useRef(null)

  var subscribeToStations = useCallback(function (ids) {
    stationIdsRef.current = ids || []
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'subscribe', station_ids: ids }))
    }
  }, [])

  var connectToStation = useCallback(function (stationId) {
    singleStationIdRef.current = stationId
    stationIdsRef.current = stationId ? [stationId] : []
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.close()
    }
  }, [])

  var disconnectFromStation = useCallback(function () {
    singleStationIdRef.current = null
    stationIdsRef.current = []
    if (ws.current) ws.current.close()
  }, [])

  useEffect(function () {
    mountRef.current = true
    var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    var host = window.location.host
    var url = protocol + '//' + host + '/ws/stations/'

    function connect() {
      if (!mountRef.current) return
      try {
        ws.current = new WebSocket(url)

        ws.current.onopen = function () {
          if (!mountRef.current) { ws.current.close(); return }
          setConnected(true)
          var ids = stationIdsRef.current
          if (ids.length > 0) {
            ws.current.send(JSON.stringify({ type: 'subscribe', station_ids: ids }))
          }
        }

        ws.current.onmessage = function (evt) {
          try {
            var msg = JSON.parse(evt.data)
            if (msg.type === 'station_update' && msg.station) {
              setStationUpdates(function (prev) {
                var next = Object.assign({}, prev)
                next[msg.station.id] = msg.station
                return next
              })
            } else if (msg.type === 'batch_update' && msg.stations) {
              var batchUpdate = {}
              msg.stations.forEach(function (st) {
                if (st && st.id) batchUpdate[st.id] = st
              })
              setStationUpdates(function (prev) {
                return Object.assign({}, prev, batchUpdate)
              })
            } else if (msg.slot_id) {
              setStatuses(function (prev) {
                var next = Object.assign({}, prev)
                next[msg.slot_id] = msg.status
                return next
              })
            }
            Object.keys(listenersRef.current).forEach(function (key) {
              listenersRef.current[key](msg)
            })
          } catch (e) {
            console.error('WS parse error', e)
          }
        }

        ws.current.onclose = function () {
          if (!mountRef.current) return
          setConnected(false)
          reconnectTimerRef.current = setTimeout(connect, 3000)
        }

        ws.current.onerror = function () {
          if (ws.current) ws.current.close()
        }
      } catch (e) {
        console.error('WS connection error', e)
        reconnectTimerRef.current = setTimeout(connect, 5000)
      }
    }

    connect()

    return function () {
      mountRef.current = false
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      if (ws.current) ws.current.close()
    }
  }, [])

  var addListener = useCallback(function (key, fn) {
    listenersRef.current[key] = fn
    return function () { delete listenersRef.current[key] }
  }, [])

  var sendMessage = useCallback(function (msg) {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg))
    }
  }, [])

  return (
    <WebSocketContext.Provider value={{
      connected: connected,
      statuses: statuses,
      stationUpdates: stationUpdates,
      connect: connectToStation,
      disconnect: disconnectFromStation,
      subscribeToStations: subscribeToStations,
      addListener: addListener,
      sendMessage: sendMessage,
    }}>
      {props.children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocket() {
  var context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocket must be used inside of WebSocketProvider')
  }
  return context
}

export default WebSocketContext
