import { Link, useLocation } from 'react-router-dom'
import { FiSun, FiMoon, FiLogOut, FiBatteryCharging, FiUser } from 'react-icons/fi'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { logout as logoutApi } from '../../api/auth'

var NAV_LINKS = [
  { label: 'Home', path: '/' },
  { label: 'About', path: '/about' },
  { label: 'Features', path: '/features' },
  { label: 'Contact', path: '/contact' },
]

export default function Navbar() {
  var { user, logoutUser } = useAuth()
  var { dark, toggle: toggleTheme } = useTheme()
  var location = useLocation()

  function handleLogout() {
    try { logoutApi(localStorage.getItem('refresh_token')) } catch (e) {}
    logoutUser()
    window.location.href = '/login'
  }

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 z-50">
      <div className="h-full max-w-7xl mx-auto px-4 flex items-center justify-between">

        <Link to="/" className="flex items-center gap-2 no-underline shrink-0">
          <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <FiBatteryCharging className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-400 bg-clip-text text-transparent">
            EcoCharge
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(function (link) {
            var isActive = location.pathname === link.path
            return (
              <Link
                key={link.path}
                to={link.path}
                className={
                  'px-4 py-1.5 text-sm rounded-lg transition-colors no-underline ' +
                  (isActive
                    ? 'text-ev-green bg-ev-green/10 font-medium dark:text-emerald-400 dark:bg-emerald-900/20'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800')
                }
              >
                {link.label}
              </Link>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? <FiSun className="w-4 h-4" /> : <FiMoon className="w-4 h-4" />}
          </button>

          {user && (
            <div className="flex items-center gap-2">
              <Link
                to="/dashboard"
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors no-underline"
              >
                <div className="w-6 h-6 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center">
                  <FiUser className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="font-medium">{user.username}</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded-full uppercase">
                  {user.role === 'SUPER_ADMIN' ? 'Admin' : user.role === 'STATION_OWNER' ? 'Owner' : 'Driver'}
                </span>
              </Link>
              <button
                onClick={handleLogout}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Logout"
              >
                <FiLogOut className="w-4 h-4" />
              </button>
            </div>
          )}

          {!user && (
            <div className="flex items-center gap-1">
              <Link
                to="/login"
                className="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors no-underline"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="px-4 py-1.5 text-sm font-medium bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/20 transition-all no-underline"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
