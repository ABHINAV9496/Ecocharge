import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts'

function CustomTooltip(props) {
  var { active, payload, label } = props
  if (!active || !payload || !payload.length) return null
  var soc = payload[0].value
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="text-gray-500 dark:text-gray-400">{label} km</p>
      <p className="font-semibold" style={{ color: soc > 15 ? '#10b981' : '#ef4444' }}>{soc}%</p>
    </div>
  )
}

export default function BatteryChart({ batteryProfile, stops }) {
  if (!batteryProfile || batteryProfile.length < 2) return null

  var stopMarkers = []
  if (stops && stops.length > 0) {
    var stopMap = {}
    for (var i = 0; i < stops.length; i++) {
      var s = stops[i]
      stopMap[s.distance_from_start_km] = s.departure_soc_percent
    }
    for (var j = 0; j < batteryProfile.length; j++) {
      var p = batteryProfile[j]
      if (stopMap[p.dist_km] != null) {
        stopMarkers.push({ dist_km: p.dist_km, soc_percent: stopMap[p.dist_km], isStop: true })
      } else {
        stopMarkers.push({ dist_km: p.dist_km, soc_percent: null, isStop: false })
      }
    }
  }

  var maxDist = batteryProfile[batteryProfile.length - 1].dist_km
  var maxSoc = 100

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Battery Level</p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={batteryProfile} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis
            dataKey="dist_km"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickFormatter={function (v) { return v + 'km' }}
            domain={[0, maxDist]}
            type="number"
            allowDataOverflow
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickFormatter={function (v) { return v + '%' }}
            domain={[0, (dataMax) => Math.max(100, Math.ceil(dataMax / 10) * 10)]}
            type="number"
            allowDataOverflow={true}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={15} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: 'Safety', position: 'insideBottomRight', fontSize: 9, fill: '#ef4444' }} />
          <Line
            type="monotone"
            dataKey="soc_percent"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#10b981' }}
          />
          {stopMarkers.length > 0 && (
            <Line
              type="monotone"
              data={stopMarkers.filter(function (m) { return m.isStop })}
              dataKey="soc_percent"
              stroke="none"
              dot={{ r: 5, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }}
              activeDot={false}
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> SOC</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Charge stop</span>
        <span className="flex items-center gap-1"><span className="w-0.5 h-2.5 bg-red-500 inline-block" /> Safety buffer</span>
      </div>
    </div>
  )
}
