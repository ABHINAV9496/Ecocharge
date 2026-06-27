import {
  FiInfo, FiCheckCircle, FiAlertTriangle, FiXCircle,
  FiCalendar, FiDollarSign, FiNavigation,
  FiCloud, FiCpu, FiShield,
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

export default function NotificationIcon(props) {
  var Icon = ICON_MAP[props.type] || FiInfo
  return <Icon className={props.className || 'w-4 h-4'} />
}
