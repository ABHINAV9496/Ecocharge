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

export async function fetchStationsAlongRoute(routeCoords, totalDistanceKm, radiusKm, getStationsFn) {
  var samplePoints = sampleRoutePoints(routeCoords, 25)
  var seen = {}
  var allStations = []

  for (var i = 0; i < samplePoints.length; i++) {
    var sp = samplePoints[i]
    try {
      var res = await getStationsFn({ lat: sp.lat, lng: sp.lng, radius: radiusKm || 20 })
      var data = res && res.data ? res.data : []
      for (var j = 0; j < data.length; j++) {
        var s = data[j]
        if (!seen[s.id]) {
          var distToRoute = minDistanceToRoute(s.latitude, s.longitude, routeCoords)
          if (distToRoute <= (radiusKm || 20)) {
            seen[s.id] = true
            s._distanceToRoute = Math.round(distToRoute * 10) / 10
            allStations.push(s)
          }
        }
      }
    } catch (e) {
      console.error('Route station fetch failed at sample point', i, e)
    }
  }

  allStations.sort(function (a, b) { return a._distanceToRoute - b._distanceToRoute })
  return allStations
}

function getBestSlot(station, preferDC) {
  if (!station.slots || station.slots.length === 0) return null
  var available = station.slots.filter(function (s) { return s.status === 'AVAILABLE' })
  if (available.length === 0) return null
  var fastCharge = available.filter(function (s) { return s.slot_type === 'DC_FAST' || s.slot_type === 'DC_ULTRA' })
  var acFast = available.filter(function (s) { return s.slot_type === 'AC_FAST' })
  if (preferDC && fastCharge.length > 0) return fastCharge[0]
  if (fastCharge.length > 0) return fastCharge[0]
  if (acFast.length > 0) return acFast[0]
  return available[0]
}

function getChargeKw(slotType) {
  var kw = { DC_ULTRA: 150, DC_FAST: 50, AC_FAST: 7.4, AC_SLOW: 3.3 }
  return kw[slotType] || 7.4
}

export function findChargingStops(routeCoords, totalDistanceM, vehicle, batteryPercent, stations) {
  if (!stations || stations.length === 0 || !vehicle || !routeCoords || routeCoords.length < 2) return []

  var totalKm = totalDistanceM / 1000
  var usableKwh = vehicle.battery_kwh * (batteryPercent / 100) * 0.9
  var whPerKm = vehicle.consumption_wh_per_km
  var rangeKm = (usableKwh / whPerKm) * 1000
  var bufferKm = 30
  var minChargeSoC = 15

  if (rangeKm >= totalKm + bufferKm) return []

  var stops = []
  var segmentDistances = []
  for (var i = 1; i < routeCoords.length; i++) {
    segmentDistances.push(haversine(routeCoords[i - 1][0], routeCoords[i - 1][1], routeCoords[i][0], routeCoords[i][1]))
  }

  var cumulativeKm = 0
  var remainingRangeKm = rangeKm
  var lastStopIdx = 0

  while (cumulativeKm < totalKm) {
    var kmToDest = totalKm - cumulativeKm
    if (remainingRangeKm >= kmToDest + bufferKm) break

    var lookAheadKm = Math.max(remainingRangeKm - bufferKm, 10)
    var targetKm = cumulativeKm + lookAheadKm
    var targetFraction = targetKm / totalKm
    var targetIdx = Math.floor(targetFraction * (routeCoords.length - 1))
    targetIdx = Math.max(lastStopIdx + 1, Math.min(targetIdx, routeCoords.length - 1))

    var searchRadius = 10
    var bestStation = null
    var bestDist = Infinity

    for (var si = 0; si < stations.length; si++) {
      var s = stations[si]
      if (!s.latitude || !s.longitude) continue
      var d = minDistanceToRoute(s.latitude, s.longitude, routeCoords.slice(targetIdx - 2 > 0 ? targetIdx - 2 : 0, targetIdx + 2 > routeCoords.length ? routeCoords.length : targetIdx + 2))
      if (d > searchRadius) continue
      var slot = getBestSlot(s, true)
      if (!slot) continue
      if (d < bestDist) {
        bestDist = d
        bestStation = { station: s, slot: slot, distToRoute: d, routeIdx: targetIdx }
      }
    }

    if (!bestStation) {
      remainingRangeKm += 20
      if (remainingRangeKm > rangeKm * 2) break
      continue
    }

    var s = bestStation.station
    var slot = bestStation.slot
    var stationLat = s.latitude
    var stationLng = s.longitude

    var stopDistFromStart = 0
    var stopIdx = -1
    for (var j = 1; j < routeCoords.length; j++) {
      stopDistFromStart += segmentDistances[j - 1]
      if (stopDistFromStart >= targetKm) { stopIdx = j; break }
    }
    if (stopIdx < 0) stopIdx = routeCoords.length - 1

    var drivingKmToStop = stopDistFromStart - cumulativeKm
    if (drivingKmToStop <= 0) drivingKmToStop = 10

    var arrivalSoC = Math.round(((remainingRangeKm - drivingKmToStop) / (rangeKm / batteryPercent)) * 100)
    arrivalSoC = Math.max(minChargeSoC, Math.min(arrivalSoC, batteryPercent))

    var kwhNeeded = vehicle.battery_kwh * (0.8 - arrivalSoC / 100)
    if (kwhNeeded <= 0) kwhNeeded = vehicle.battery_kwh * 0.5

    var chargeKw = getChargeKw(slot.slot_type)
    var chargeSeconds = chargeKw > 0 ? (kwhNeeded / chargeKw) * 3600 : 1800
    var rate = parseFloat(slot.rate_per_kwh) || 10
    var cost = kwhNeeded * rate

    stops.push({
      station: s,
      name: s.name || s.address,
      address: s.address,
      lat: stationLat,
      lng: stationLng,
      distanceKm: Math.round(stopDistFromStart),
      arrivalSoC: arrivalSoC,
      chargeTime: Math.round(chargeSeconds),
      cost: Math.round(cost * 100) / 100,
      slotType: slot.slot_type,
      rateUsed: rate,
      distToRoute: bestDist,
    })

    var chargedKwh = kwhNeeded
    var addedRange = (chargedKwh / whPerKm) * 1000
    remainingRangeKm = addedRange + (remainingRangeKm - drivingKmToStop)
    remainingRangeKm = Math.min(remainingRangeKm, rangeKm * 1.2)
    cumulativeKm = stopDistFromStart
    lastStopIdx = stopIdx

    if (stops.length >= 6) break
  }

  return stops
}

export function generateRouteOptions(routeCoords, totalDistanceM, vehicle, batteryPercent, stations) {
  var defaultStops = findChargingStops(routeCoords, totalDistanceM, vehicle, batteryPercent, stations)
  var totalKm = totalDistanceM / 1000
  var driveTimeHours = totalKm / 80
  var totalChargeSeconds = defaultStops.reduce(function (sum, s) { return sum + s.chargeTime }, 0)
  var totalChargeHours = totalChargeSeconds / 3600

  var options = []

  options.push({
    id: 'fewest',
    label: 'Fewest Stops',
    description: defaultStops.length + ' charging stop(s)',
    stops: defaultStops,
    totalDriveTime: driveTimeHours,
    totalChargeTime: totalChargeHours,
    totalTime: driveTimeHours + totalChargeHours,
  })

  if (stations && stations.length > 0) {
    var fastStops = findChargingStops(routeCoords, totalDistanceM, vehicle, batteryPercent,
      stations.filter(function (s) {
        return s.slots && s.slots.some(function (sl) {
          return sl.slot_type === 'DC_FAST' || sl.slot_type === 'DC_ULTRA'
        })
      })
    )
    if (fastStops.length > 0) {
      var fastChargeSec = fastStops.reduce(function (sum, s) { return sum + s.chargeTime }, 0)
      options.push({
        id: 'fast',
        label: 'Fastest Charge',
        description: fastStops.length + ' stop(s) at DC fast stations',
        stops: fastStops,
        totalDriveTime: driveTimeHours,
        totalChargeTime: fastChargeSec / 3600,
        totalTime: driveTimeHours + fastChargeSec / 3600,
      })
    }
  }

  if (defaultStops.length > 0) {
    var bufferStops = findChargingStops(routeCoords, totalDistanceM, vehicle, batteryPercent * 0.8, stations)
    if (bufferStops.length > defaultStops.length || (bufferStops.length > 0 && defaultStops.length === 0)) {
      var bufChargeSec = bufferStops.reduce(function (sum, s) { return sum + s.chargeTime }, 0)
      options.push({
        id: 'buffer',
        label: 'More Buffer',
        description: bufferStops.length + ' stop(s) — extra safety margin',
        stops: bufferStops,
        totalDriveTime: driveTimeHours,
        totalChargeTime: bufChargeSec / 3600,
        totalTime: driveTimeHours + bufChargeSec / 3600,
      })
    }
  }

  return options
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
