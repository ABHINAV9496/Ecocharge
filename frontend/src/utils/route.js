export function haversine(lat1, lng1, lat2, lng2) {
  var R = 6371
  var dLat = (lat2 - lat1) * Math.PI / 180
  var dLng = (lng2 - lng1) * Math.PI / 180
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
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

export function findChargingStops(routeCoords, totalDistanceM, vehicle, batteryPercent, stations) {
  if (!stations || stations.length === 0 || !vehicle) return []

  var totalKm = totalDistanceM / 1000
  var usableKwh = vehicle.battery_kwh * (batteryPercent / 100) * 0.9
  var rangeKm = (usableKwh / vehicle.consumption_wh_per_km) * 1000

  if (rangeKm >= totalKm * 1.1) return []

  var numStops = Math.ceil(totalKm / (rangeKm * 0.7))
  if (numStops < 1) numStops = 1

  var stops = []
  var interval = numStops > 1 ? totalKm / numStops : totalKm * 0.5

  for (var i = 1; i <= numStops; i++) {
    var targetKm = interval * i
    var fraction = targetKm / totalKm
    if (fraction > 0.95) break

    var idx = Math.floor(fraction * (routeCoords.length - 1))
    var point = routeCoords[idx]
    if (!point) continue

    var nearest = findNearestStation(point, stations, 20)
    if (nearest) {
      var stopDist = Math.round(targetKm)
      var arrivalSoC = Math.max(10, Math.round(100 - (interval * vehicle.consumption_wh_per_km / (vehicle.battery_kwh * 9))))
      var chargeSeconds = 0
      if (vehicle.fast_charge_kw > 0) {
        var kwhNeeded = vehicle.battery_kwh * (0.8 - arrivalSoC / 100)
        chargeSeconds = (kwhNeeded / vehicle.fast_charge_kw) * 3600
      }
      stops.push({
        station: nearest,
        name: nearest.name || nearest.address,
        address: nearest.address,
        lat: nearest.latitude,
        lng: nearest.longitude,
        distanceKm: stopDist,
        arrivalSoC: arrivalSoC,
        chargeTime: chargeSeconds,
        cost: chargeSeconds > 0 ? (chargeSeconds / 3600) * 10 : 0,
      })
    }
  }

  return stops
}

export function generateRouteOptions(routeCoords, totalDistanceM, vehicle, batteryPercent, stations) {
  var defaultStops = findChargingStops(routeCoords, totalDistanceM, vehicle, batteryPercent, stations)
  var totalKm = totalDistanceM / 1000
  var driveTimeHours = totalDistanceM / 1000 / 80
  var totalChargeSeconds = defaultStops.reduce(function (sum, s) { return sum + s.chargeTime }, 0)
  var totalChargeHours = totalChargeSeconds / 3600
  var totalTimeHours = driveTimeHours + totalChargeHours

  var options = []

  // Option 1: Fewest stops (default)
  options.push({
    id: 'fewest',
    label: 'Fewest Stops',
    description: defaultStops.length + ' charging stop(s)',
    stops: defaultStops,
    totalDriveTime: driveTimeHours,
    totalChargeTime: totalChargeHours,
    totalTime: totalTimeHours,
  })

  // Option 2: Faster charging — prioritize stations with DC fast chargers
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
      var fastChargeHr = fastChargeSec / 3600
      options.push({
        id: 'fast',
        label: 'Fastest Charge',
        description: fastStops.length + ' stop(s) at DC fast stations',
        stops: fastStops,
        totalDriveTime: driveTimeHours,
        totalChargeTime: fastChargeHr,
        totalTime: driveTimeHours + fastChargeHr,
      })
    }
  }

  // Option 3: More buffer — more stops, shorter intervals
  if (defaultStops.length > 0) {
    var bufferStops = findChargingStops(routeCoords, totalDistanceM, vehicle, batteryPercent * 0.8, stations)
    if (bufferStops.length > defaultStops.length || (bufferStops.length > 0 && defaultStops.length === 0)) {
      var bufChargeSec = bufferStops.reduce(function (sum, s) { return sum + s.chargeTime }, 0)
      var bufChargeHr = bufChargeSec / 3600
      options.push({
        id: 'buffer',
        label: 'More Buffer',
        description: bufferStops.length + ' stop(s) — extra safety margin',
        stops: bufferStops,
        totalDriveTime: driveTimeHours,
        totalChargeTime: bufChargeHr,
        totalTime: driveTimeHours + bufChargeHr,
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
    var lng = coordinates[i][0]
    var lat = coordinates[i][1]
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
