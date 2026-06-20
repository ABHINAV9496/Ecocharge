import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import MapView from '../components/map/MapView'

export default function MapPage() {
  var location = useLocation()
  var routePlan = location.state?.routePlan || null

  useEffect(function () {
    if (location.state?.routePlan) {
      window.history.replaceState({}, document.title)
    }
  }, [])

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-950">
      <MapView routePlan={routePlan} />
    </div>
  )
}
