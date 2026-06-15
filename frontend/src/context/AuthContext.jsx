/*
  Auth Context
  ------------
  This is the central place for managing user login state.

  What it does:
  - Stores the current logged-in user
  - Saves/loads tokens from browser storage (localStorage)
  - Provides login and logout functions to the whole app

  How to use in any component:
    import { useAuth } from '../context/AuthContext'
    function MyComponent() {
      var { user, loginUser, logoutUser } = useAuth()
    }
*/

import { createContext, useContext, useState, useEffect } from 'react'
import { getProfile } from '../api/auth'

// Create the context with a default value of null
// React will replace this with the actual value from AuthProvider
var AuthContext = createContext(null)

// This component wraps the entire app and provides auth state
export function AuthProvider(props) {
  var children = props.children

  // Try to load saved user from localStorage on startup
  // This way, if the user refreshes the page, they stay logged in
  var [user, setUser] = useState(function () {
    var savedUser = localStorage.getItem('user')
    if (savedUser) {
      return JSON.parse(savedUser)
    }
    return null
  })

  // While we're checking if the user is logged in, show a loading state
  var [loading, setLoading] = useState(true)

  // On first load, check if we have a saved session
  useEffect(function () {
    var token = localStorage.getItem('access_token')
    var savedUser = localStorage.getItem('user')

    if (token && savedUser) {
      var parsedUser = JSON.parse(savedUser)
      // Restore from localStorage immediately so the UI isn't blank
      setUser(parsedUser)

      // Then fetch fresh profile from backend to ensure role etc. are up-to-date
      getProfile()
        .then(function (res) {
          var freshUser = Object.assign({}, parsedUser, res.data)
          localStorage.setItem('user', JSON.stringify(freshUser))
          setUser(freshUser)
        })
        .catch(function () {
          // If profile fetch fails (e.g. token expired), keep the cached user
        })
    }

    // Done checking, stop showing the loading spinner
    setLoading(false)
  }, [])  // Empty array means this runs only once when the app starts

  // Save user info and tokens after successful login
  function loginUser(userData, accessToken, refreshToken) {
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('refresh_token', refreshToken)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }

  // Clear everything on logout
  function logoutUser() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    setUser(null)
  }

  // Update the current user's profile info (e.g., after editing)
  function updateUser(newData) {
    var updatedUser = Object.assign({}, user, newData)
    localStorage.setItem('user', JSON.stringify(updatedUser))
    setUser(updatedUser)
  }

  // Provide these values to all child components
  // Any component can access them using the useAuth() hook
  return (
    <AuthContext.Provider value={{
      user: user,
      loading: loading,
      loginUser: loginUser,
      logoutUser: logoutUser,
      updateUser: updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook that components use to access auth state
// This is simpler than using useContext directly
export function useAuth() {
  var context = useContext(AuthContext)
  // If someone tries to use useAuth outside of AuthProvider, show an error
  if (!context) {
    throw new Error('useAuth must be used inside of AuthProvider')
  }
  return context
}
