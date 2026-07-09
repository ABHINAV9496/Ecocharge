import { useState } from 'react'

var COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

var SIZES = {
  sm: { box: 'w-8 h-8', text: 'text-xs' },
  md: { box: 'w-14 h-14', text: 'text-sm' },
  lg: { box: 'w-28 h-28', text: 'text-lg' },
}

function InitialsBadge(props) {
  var { make, model, dims } = props
  var initials = (make[0] + model[0]).toUpperCase()
  var color = COLORS[make.length % COLORS.length]
  return (
    <div className={dims.box + ' rounded-lg flex items-center justify-center shrink-0'} style={{ backgroundColor: color }}>
      <span className={'text-white font-bold leading-none ' + dims.text}>{initials}</span>
    </div>
  )
}

export default function VehicleImage(props) {
  var { vehicle, size, className } = props
  var [failed, setFailed] = useState(false)
  var dims = SIZES[size] || SIZES.sm

  if (!vehicle) return null

  if (failed) {
    return <InitialsBadge make={vehicle.make} model={vehicle.model} dims={dims} />
  }

  return (
    <img
      src={'/vehicles/' + vehicle.id + '.png'}
      alt={vehicle.make + ' ' + vehicle.model}
      className={dims.box + ' object-contain rounded-lg shrink-0 bg-gray-800 ' + (className || '')}
      onError={function () { setFailed(true) }}
      loading="lazy"
    />
  )
}
