var cache = new Map()
var CACHE_TTL = 300000

export async function searchLocations(query, limit) {
  if (limit === undefined) limit = 5
  if (!query || !query.trim()) return []

  var key = query.trim().toLowerCase() + '|' + limit
  var cached = cache.get(key)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data
  }

  var data = await tryNominatim(query, limit)
  if (!data || data.length === 0) {
    data = await tryPhoton(query, limit)
    if (data) {
      data = data.filter(function (r) {
        var lat = parseFloat(r.lat)
        var lng = parseFloat(r.lon)
        return lat >= 6 && lat <= 37 && lng >= 68 && lng <= 98
      })
    }
  }

  if (data && data.length > 0) {
    cache.set(key, { data: data, ts: Date.now() })
  }

  return data || []
}

async function tryPhoton(query, limit) {
  try {
    var url = 'https://photon.komoot.io/api/?q=' + encodeURIComponent(query) + '&limit=' + limit + '&lang=en'
    var res = await fetch(url)
    if (!res.ok) return null
    var json = await res.json()
    if (!json.features || json.features.length === 0) return null
    return json.features.map(function (f) {
      var props = f.properties || {}
      var coords = f.geometry ? f.geometry.coordinates : []
      var parts = [props.name, props.city, props.state, props.country].filter(Boolean)
      return {
        display_name: parts.join(', '),
        lat: coords[1] != null ? coords[1].toString() : '',
        lon: coords[0] != null ? coords[0].toString() : '',
      }
    })
  } catch (e) {
    console.warn('Photon geocode failed:', e)
    return null
  }
}

async function tryNominatim(query, limit) {
  try {
    var res = await fetch('/api/geocode/?q=' + encodeURIComponent(query) + '&limit=' + limit)
    if (!res.ok) return null
    var data = await res.json()
    return Array.isArray(data) ? data : null
  } catch (e) {
    console.warn('Nominatim fallback failed:', e)
    return null
  }
}
