/*
  Sidebar Navigation
  ------------------
  A vertical sidebar that shows navigation links based on the user's role.

  Role-based access:
  - DRIVER:         Map, Trips, Dashboard
  - STATION_OWNER:  Map, Dashboard, Admin
  - SUPER_ADMIN:    Map, Dashboard, Admin
  - GUEST:          Map

  The sidebar is fixed on the left side below the navbar.
  On small screens, it collapses to show only icons (no labels).
*/

import { Link, useLocation } from 'react-router-dom'
import { FiMap, FiGrid, FiNavigation, FiUsers, FiCalendar } from 'react-icons/fi'
import { useAuth } from '../../context/AuthContext'

// Define all available navigation items
// Each item has: path (URL), label (display name), icon, and allowed roles
var allNavItems = [
  { path: '/map',        label: 'Map',        icon: FiMap,        roles: ['DRIVER', 'GUEST', 'STATION_OWNER', 'SUPER_ADMIN'] },
  { path: '/bookings',   label: 'Bookings',   icon: FiCalendar,   roles: ['DRIVER'] },
  { path: '/trips',      label: 'Trip Planner', icon: FiNavigation, roles: ['DRIVER'] },
  { path: '/dashboard',  label: 'Dashboard',  icon: FiGrid,       roles: ['DRIVER', 'STATION_OWNER', 'SUPER_ADMIN'] },
  { path: '/admin',      label: 'Admin',      icon: FiUsers,      roles: ['SUPER_ADMIN'] },
]

export default function Sidebar() {
  var currentPath = useLocation().pathname
  var { user } = useAuth()

  // Only show navigation items that the user's role allows
  // For example, a DRIVER won't see the "Admin" link
  var visibleItems = allNavItems.filter(function (item) {
    return item.roles.indexOf(user.role) !== -1
  })

  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-16 md:w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col py-3 z-30">
      <nav className="flex flex-col gap-0.5 px-2">

        {visibleItems.map(function (item) {
          var ItemIcon = item.icon
          var isActive = currentPath === item.path

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 no-underline
                ${isActive
                  ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-medium'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300'
                }
              `}
            >
              <ItemIcon className="w-5 h-5" />

              <span className="hidden md:block text-sm">{item.label}</span>

              {/* Active indicator dot */}
              {isActive && (
                <div className="hidden md:block ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom section: show user role */}
      <div className="mt-auto px-4 py-3 border-t border-gray-200 dark:border-gray-800">
        <div className="hidden md:flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {user.role === 'SUPER_ADMIN' ? 'Administrator' :
             user.role === 'STATION_OWNER' ? 'Station Owner' :
             user.role === 'DRIVER' ? 'EV Driver' : 'Guest'}
          </span>
        </div>
      </div>
    </aside>
  )
}
