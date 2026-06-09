/*
  Protected Route
  ---------------
  A wrapper component that checks if the user is logged in before
  showing the page. If not logged in, it redirects to the login page.

  It can also check for specific user roles. For example, the admin
  page requires the user to have role "SUPER_ADMIN" or "STATION_OWNER".

  How to use:
    <ProtectedRoute roles={['DRIVER']}>
      <DriverDashboard />
    </ProtectedRoute>
*/

import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function ProtectedRoute(props) {
  var children = props.children
  var allowedRoles = props.roles

  var { user, loading } = useAuth()
  var currentLocation = useLocation()

  // CASE 1: Still checking if the user is logged in (show loading spinner)
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center dark:bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-ev-green border-t-transparent" />
      </div>
    )
  }

  // CASE 2: User is NOT logged in (redirect to login page)
  if (!user) {
    // Save the page they tried to visit so we can redirect back after login
    return <Navigate to="/login" state={{ from: currentLocation }} replace />
  }

  // CASE 3: User doesn't have the required role (redirect to home)
  if (allowedRoles && allowedRoles.indexOf(user.role) === -1) {
    return <Navigate to="/" replace />
  }

  // CASE 4: All checks passed - show the actual page content
  return children
}
