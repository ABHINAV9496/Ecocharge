import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'
import { getHeatmapData } from '../../api/bookings'

export default function HeatmapLayer({ visible }) {
  var map = useMap()
  var heatLayerRef = useRef(null)

  useEffect(function () {
    if (!visible) {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current)
        heatLayerRef.current = null
      }
      return
    }

    var cancelled = false

    getHeatmapData(90).then(function (res) {
      if (cancelled) return
      var points = res.data.map(function (d) {
        return [d.lat, d.lng, d.intensity]
      })
      if (heatLayerRef.current) map.removeLayer(heatLayerRef.current)
      heatLayerRef.current = L.heatLayer(points, {
        radius: 30,
        blur: 20,
        maxZoom: 10,
        max: 1,
        gradient: {
          0.0: '#22c55e',
          0.4: '#eab308',
          0.7: '#f97316',
          1.0: '#ef4444',
        },
      }).addTo(map)
    }).catch(function () {
      // silently fail — heatmap is non-critical
    })

    return function () {
      cancelled = true
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current)
        heatLayerRef.current = null
      }
    }
  }, [visible, map])

  return null
}
