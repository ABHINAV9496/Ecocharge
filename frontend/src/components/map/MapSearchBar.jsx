import { useState, useRef } from 'react'
import { FiSearch } from 'react-icons/fi'
import { searchLocations } from '../../api/geocode'
import { searchStations } from '../../api/stations'

export default function MapSearchBar({ mapRef, onLocationSelect }) {
  var [query, setQuery] = useState('')
  var [isSearching, setIsSearching] = useState(false)
  var [suggestions, setSuggestions] = useState([])
  var [showSuggestions, setShowSuggestions] = useState(false)
  var searchTimer = useRef(null)
  var searchAbortRef = useRef(null)

  function handleInput(value) {
    setQuery(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(function () { suggestSearch(value) }, 300)
  }

  async function suggestSearch(q) {
    if (!q.trim()) { setSuggestions([]); setShowSuggestions(false); return }
    if (searchAbortRef.current) searchAbortRef.current.abort()
    var ac = new AbortController()
    searchAbortRef.current = ac
    setIsSearching(true)
    try {
      var [locData, stationData] = await Promise.all([
        searchLocations(q, 5, ac.signal),
        searchStations(q, mapRef.current ? mapRef.current.getBounds().toBBoxString() : null).then(function (r) { return r.data || [] }).catch(function () { return [] }),
      ])
      if (ac.signal.aborted) return
      var locResults = (locData || []).map(function (item) { return { _type: 'location', display_name: item.display_name, lat: item.lat, lon: item.lon } })
      var stationResults = stationData.map(function (s) { return { _type: 'station', display_name: s.name + (s.address ? ' — ' + s.address : ''), lat: s.latitude, lng: s.longitude, station: s } })
      var merged = locResults.concat(stationResults).slice(0, 8)
      setSuggestions(merged); setShowSuggestions(merged.length > 0)
    } finally { setIsSearching(false) }
  }

  async function handleGo() {
    if (!query.trim()) return
    if (searchAbortRef.current) searchAbortRef.current.abort()
    var ac = new AbortController()
    searchAbortRef.current = ac
    setIsSearching(true)
    try {
      var data = await searchLocations(query, 1, ac.signal)
      if (ac.signal.aborted) return
      if (!data || data.length === 0) {
        console.warn('Geocode empty for query:', query)
        return
      }
      var lat = parseFloat(data[0].lat), lng = parseFloat(data[0].lon)
      if (!isNaN(lat) && !isNaN(lng)) onLocationSelect(lat, lng)
    } finally { setIsSearching(false) }
  }

  function selectSuggestion(s) {
    setQuery(s.display_name); setShowSuggestions(false)
    var lat = s._type === 'station' ? parseFloat(s.lat) : parseFloat(s.lat)
    var lng = s._type === 'station' ? parseFloat(s.lng) : parseFloat(s.lon)
    if (!isNaN(lat) && !isNaN(lng)) onLocationSelect(lat, lng)
  }

  function handleKeyDown(e) { if (e.key === 'Enter') handleGo() }

  return (
    <div className="flex-1 max-w-xl mx-auto relative pointer-events-auto">
      <div className="flex items-center bg-gray-900/90 backdrop-blur-md border border-gray-700 rounded-xl px-3 py-2.5 shadow-lg">
        {isSearching ? (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-emerald-500 border-t-transparent mr-2 shrink-0" />
        ) : (
          <FiSearch className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
        )}
        <input type="text" placeholder="Search destination or location..." value={query}
          onChange={function (e) { handleInput(e.target.value) }} onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent outline-none text-sm text-white placeholder-gray-500" />
        <button onClick={handleGo} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors shrink-0 ml-2">Go</button>
      </div>
      {showSuggestions && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 max-h-40 overflow-y-auto">
          {suggestions.map(function (s, i) {
            return <button key={i} onClick={function () { selectSuggestion(s) }}
              className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 border-b border-gray-700/50 last:border-0 flex items-center gap-2 truncate">
              <span className={'shrink-0 text-[10px] font-medium px-1 py-0.5 rounded ' + (s._type === 'station' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-blue-900/30 text-blue-400')}>{s._type === 'station' ? 'Station' : 'Location'}</span>
              <span className="truncate">{s.display_name}</span>
            </button>
          })}
        </div>
      )}
    </div>
  )
}
