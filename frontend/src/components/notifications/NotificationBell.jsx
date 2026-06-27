import { useState, useRef, useEffect } from 'react'
import { FiBell } from 'react-icons/fi'
import { useNotifications } from '../../context/NotificationContext'
import NotificationDropdown from './NotificationDropdown'

export default function NotificationBell() {
  var { unreadCount } = useNotifications()
  var [open, setOpen] = useState(false)
  var ref = useRef(null)

  useEffect(function () {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClick)
    }

    return function () {
      document.removeEventListener('mousedown', handleClick)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={function () { setOpen(function (v) { return !v }) }}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title="Notifications"
      >
        <FiBell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <NotificationDropdown onClose={function () { setOpen(false) }} />
      )}
    </div>
  )
}
