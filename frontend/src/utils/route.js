export function haversine(lat1, lng1, lat2, lng2) {
  var R = 6371
  var dLat = (lat2 - lat1) * Math.PI / 180
  var dLng = (lng2 - lng1) * Math.PI / 180
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function pointToSegmentDistance(px, py, ax, ay, bx, by) {
  var abx = bx - ax
  var aby = by - ay
  var apx = px - ax
  var apy = py - ay
  var t = (apx * abx + apy * aby) / (abx * abx + aby * aby + 0.0001)
  t = Math.max(0, Math.min(1, t))
  var cx = ax + t * abx
  var cy = ay + t * aby
  return haversine(px, py, cx, cy)
}

export function minDistanceToRoute(lat, lng, routeCoords) {
  var minDist = Infinity
  for (var i = 0; i < routeCoords.length - 1; i++) {
    var d = pointToSegmentDistance(lat, lng, routeCoords[i][0], routeCoords[i][1], routeCoords[i + 1][0], routeCoords[i + 1][1])
    if (d < minDist) minDist = d
  }
  return minDist
}

export function findNearestStation(point, stations, maxKm) {
  var minDist = Infinity
  var nearest = null
  var lat1 = point[0]
  var lng1 = point[1]
  stations.forEach(function (s) {
    if (!s.latitude || !s.longitude) return
    var d = haversine(lat1, lng1, s.latitude, s.longitude)
    if (d < minDist && d <= maxKm) {
      minDist = d
      nearest = s
    }
  })
  return nearest
}

export function sampleRoutePoints(coords, intervalKm) {
  intervalKm = intervalKm || 25
  if (!coords || coords.length < 2) return [{ lat: coords[0][0], lng: coords[0][1] }]
  var samples = [{ lat: coords[0][0], lng: coords[0][1] }]
  var accumulated = 0
  for (var i = 1; i < coords.length; i++) {
    var d = haversine(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1])
    accumulated += d
    if (accumulated >= intervalKm) {
      samples.push({ lat: coords[i][0], lng: coords[i][1] })
      accumulated = 0
    }
  }
  var last = coords[coords.length - 1]
  var lastD = haversine(samples[samples.length - 1].lat, samples[samples.length - 1].lng, last[0], last[1])
  if (lastD > intervalKm / 2) {
    samples.push({ lat: last[0], lng: last[1] })
  }
  return samples
}

export function computeRouteBounds(coordinates, bufferKm) {
  if (!coordinates || coordinates.length === 0) return null
  bufferKm = bufferKm || 15
  var bufferDeg = bufferKm / 111
  var minLat = Infinity, maxLat = -Infinity
  var minLng = Infinity, maxLng = -Infinity
  for (var i = 0; i < coordinates.length; i++) {
    var lng = coordinates[i][1]
    var lat = coordinates[i][0]
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
  }
  return {
    minLat: minLat - bufferDeg,
    maxLat: maxLat + bufferDeg,
    minLng: minLng - bufferDeg,
    maxLng: maxLng + bufferDeg,
  }
}
