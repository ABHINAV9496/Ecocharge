import {
  FiInfo, FiCheckCircle, FiAlertTriangle, FiXCircle,
  FiCalendar, FiDollarSign, FiNavigation,
  FiCloud, FiCpu, FiShield, FiMapPin, FiPlay, FiFlag, FiEdit,
} from 'react-icons/fi'

var ICON_MAP = {
  INFO: FiInfo,
  SUCCESS: FiCheckCircle,
  WARNING: FiAlertTriangle,
  ERROR: FiXCircle,
  BOOKING: FiCalendar,
  PAYMENT: FiDollarSign,
  TRIP: FiNavigation,
  WEATHER: FiCloud,
  AI: FiCpu,
  ADMIN: FiShield,
}

function tripIcon(title) {
  var t = (title || '').toLowerCase()
  if (t.indexOf('planned') !== -1) return FiEdit
  if (t.indexOf('started') !== -1) return FiPlay
  if (t.indexOf('completed') !== -1) return FiFlag
  if (t.indexOf('stop') !== -1) return FiMapPin
  return FiNavigation
}

export default function NotificationIcon(props) {
  var Icon = ICON_MAP[props.type] || FiInfo
  if (props.type === 'TRIP' && props.title) {
    Icon = tripIcon(props.title)
  }
  return <Icon className={props.className || 'w-4 h-4'} />
}
