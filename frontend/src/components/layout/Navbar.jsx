import { Link, useLocation } from 'react-router-dom'
import { FiSun, FiMoon, FiLogOut, FiBatteryCharging, FiUser, FiMenu, FiX } from 'react-icons/fi'
import { useState } from 'react'
import NotificationBell from '../notifications/NotificationBell'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { logout as logoutApi } from '../../api/auth'

var GUEST_LINKS = [
  { label: 'Home', path: '/' },
  { label: 'About', path: '/about' },
  { label: 'Features', path: '/features' },
  { label: 'Contact', path: '/contact' },
]

var APP_LINKS = [
  { label: 'Map', path: '/map' },
  { label: 'Trips', path: '/trips' },
  { label: 'Dashboard', path: '/dashboard' },
]

export default function Navbar() {
  var { user, logoutUser } = useAuth()
  var { dark, toggle: toggleTheme } = useTheme()
  var location = useLocation()
  var [mobileOpen, setMobileOpen] = useState(false)

  function handleLogout() {
    try { logoutApi(localStorage.getItem('refresh_token')) } catch (e) {}
    logoutUser()
    window.location.href = '/login'
  }

  var links = user ? APP_LINKS : GUEST_LINKS

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 z-50">
      <div className="h-full max-w-7xl mx-auto px-4 flex items-center justify-between">

        <Link to="/" className="flex items-center gap-2.5 no-underline shrink-0">
          <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
            <FiBatteryCharging className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-emerald-600" style={{fontFamily: "'Space Grotesk', sans-serif"}}>
            EcoCharge
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {links.map(function (link) {
            var isActive = location.pathname === link.path
            return (
              <Link
                key={link.path}
                to={link.path}
                className={
                  'px-4 py-1.5 text-sm rounded-lg transition-colors no-underline ' +
                  (isActive
                    ? 'text-emerald-600 bg-emerald-600/10 font-medium'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800')
                }
              >
                {link.label}
              </Link>
            )
          })}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? <FiSun className="w-4 h-4" /> : <FiMoon className="w-4 h-4" />}
          </button>

          {user && <NotificationBell />}

          {user && (
            <div className="hidden sm:flex items-center gap-2">
              <Link
                to="/dashboard"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors no-underline"
              >
                <div className="w-6 h-6 bg-emerald-600/10 rounded-full flex items-center justify-center">
                  <FiUser className="w-3 h-3 text-emerald-600" />
                </div>
                <span className="font-medium">{user.username}</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full uppercase text-gray-400">
                  {user.role === 'SUPER_ADMIN' ? 'Admin' : user.role === 'STATION_OWNER' ? 'Owner' : 'Driver'}
                </span>
              </Link>
              <button
                onClick={handleLogout}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Logout"
              >
                <FiLogOut className="w-4 h-4" />
              </button>
            </div>
          )}

          {!user && (
            <div className="hidden sm:flex items-center gap-2">
              <Link
                to="/login"
                className="px-4 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors no-underline"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="px-4 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors no-underline"
              >
                Get Started
              </Link>
            </div>
          )}

          <button
            onClick={function () { setMobileOpen(!mobileOpen) }}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <FiX className="w-4 h-4" /> : <FiMenu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 pb-4">
          {links.map(function (link) {
            var isActive = location.pathname === link.path
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={function () { setMobileOpen(false) }}
                className={
                  'block px-4 py-2.5 text-sm rounded-lg no-underline ' +
                  (isActive
                    ? 'text-emerald-600 bg-emerald-600/10 font-medium'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800')
                }
              >
                {link.label}
              </Link>
            )
          })}
          {!user && (
            <div className="flex items-center gap-2 mt-2 px-4">
              <Link
                to="/login"
                onClick={function () { setMobileOpen(false) }}
                className="flex-1 px-4 py-2.5 text-sm text-center text-gray-500 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 no-underline"
              >
                Log in
              </Link>
              <Link
                to="/register"
                onClick={function () { setMobileOpen(false) }}
                className="flex-1 px-4 py-2.5 text-sm text-center font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 no-underline"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  )
}
