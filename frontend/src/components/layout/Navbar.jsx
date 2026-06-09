/*
  Navbar
  ------
  The top navigation bar that appears on every page.

  Sections:
  - Left: Logo (EcoCharge brand)
  - Right: Dark mode toggle + User menu or Login/Register buttons

  The navbar has a glass-morphism effect (semi-transparent with blur).
*/

import { Link, useNavigate } from 'react-router-dom'
import { FiSun, FiMoon, FiLogOut, FiBatteryCharging, FiUser } from 'react-icons/fi'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { logout as logoutApi } from '../../api/auth'

export default function Navbar() {
  var { user, logoutUser } = useAuth()
  var { dark, toggle: toggleTheme } = useTheme()
  var navigate = useNavigate()

  // Log the user out and redirect to login page
  function handleLogout() {
    var refreshToken = localStorage.getItem('refresh_token')

    // Try to blacklist the token on the server (optional - fire and forget)
    logoutApi(refreshToken).catch(function (error) {
      console.error('Logout API call failed (this is usually fine):', error)
    })

    // Clear local state and redirect
    logoutUser()
    navigate('/login')
  }

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 z-50">
      <div className="h-full px-4 flex items-center justify-between">

        {/* LEFT SECTION: Logo and Brand Name */}
        <Link to="/" className="flex items-center gap-2 no-underline">
          <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <FiBatteryCharging className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-400 bg-clip-text text-transparent">
            EcoCharge
          </span>
        </Link>

        {/* RIGHT SECTION: Theme Toggle + User Menu */}
        <div className="flex items-center gap-2">

          {/* Dark Mode Toggle Button */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? <FiSun className="w-4 h-4" /> : <FiMoon className="w-4 h-4" />}
          </button>

          {/* If user is logged in: show user info + logout button */}
          {user && (
            <div className="flex items-center gap-2">
              {/* User name and role badge */}
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

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Logout"
              >
                <FiLogOut className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* If user is NOT logged in: show login + register buttons */}
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
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
