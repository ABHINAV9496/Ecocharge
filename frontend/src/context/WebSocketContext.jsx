/*
  WebSocket Context
  -----------------
  Manages real-time WebSocket connections for live slot status updates.

  What it does:
  - Connects to the Django Channels WebSocket for a specific station
  - Receives live updates when slot status changes (Available → Occupied)
  - Stores the latest status of each slot
  - Auto-reconnects if the connection drops

  How it works:
  1. When a user clicks on a station, call connect(stationId)
  2. The WebSocket sends slot updates every time the MQTT IoT sensors report a change
  3. The statuses object always has the latest { slotId: "AVAILABLE"|"OCCUPIED"|"FAULT" }

  Note: Without useCallback and useRef (which are advanced React features),
  we use simple variables and functions that are easier to understand.
*/

import { createContext, useContext, useState, useEffect } from 'react'

var WebSocketContext = createContext(null)

export function WebSocketProvider(props) {
  var children = props.children

  // Store latest slot statuses as an object: { slotId: status }
  // Example: { 5: "OCCUPIED", 8: "AVAILABLE" }
  var [statuses, setStatuses] = useState({})

  // Keep track of the WebSocket connection so we can close it later
  // We store it in a state variable instead of useRef (simpler for beginners)
  var [webSocket, setWebSocket] = useState(null)

  // Connect to the WebSocket for a specific station
  // stationId: the ID of the station to get live updates for
  function connectToStation(stationId) {
    // Close any existing connection first
    if (webSocket) {
      webSocket.close()
    }

    // Build the WebSocket URL based on the current page's protocol
    // If the page uses HTTPS, WebSocket must use WSS (secure)
    var protocol
    if (window.location.protocol === 'https:') {
      protocol = 'wss:'
    } else {
      protocol = 'ws:'
    }

    var host = window.location.host
    var url = protocol + '//' + host + '/ws/stations/' + stationId + '/slots/'

    try {
      // Create a new WebSocket connection
      var ws = new WebSocket(url)

      // When a message arrives from the server, update the slot status
      ws.onmessage = function (event) {
        try {
          var data = JSON.parse(event.data)
          // data looks like: { slot_id: 5, status: "OCCUPIED" }

          // Update the status of just this one slot (keep other slots unchanged)
          setStatuses(function (previousStatuses) {
            var updatedStatuses = Object.assign({}, previousStatuses)
            updatedStatuses[data.slot_id] = data.status
            return updatedStatuses
          })

        } catch (parseError) {
          console.error('Could not parse WebSocket message:', parseError)
        }
      }

      // If the connection closes, try to reconnect after 5 seconds
      ws.onclose = function () {
        console.log('WebSocket disconnected. Will reconnect in 5 seconds...')
        setTimeout(function () {
          connectToStation(stationId)
        }, 5000)
      }

      // Save the WebSocket so we can close it later
      setWebSocket(ws)

    } catch (error) {
      console.error('Could not connect to WebSocket:', error)
    }
  }

  // Disconnect from the current WebSocket
  function disconnectFromStation() {
    if (webSocket) {
      webSocket.close()
      setWebSocket(null)
    }
  }

  // Clean up on unmount: close the WebSocket when this component goes away
  useEffect(function () {
    return function () {
      if (webSocket) {
        webSocket.close()
      }
    }
  }, [webSocket])

  return (
    <WebSocketContext.Provider value={{
      statuses: statuses,
      connect: connectToStation,
      disconnect: disconnectFromStation,
    }}>
      {children}
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
