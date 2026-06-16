import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { FiBatteryCharging, FiUser, FiLock, FiArrowRight } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import { login as loginApi, googleLogin as googleLoginApi } from '../api/auth'

var GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export default function Login() {
  var [form, setForm] = useState({
    username: '',
    password: '',
  })

  var [errorMessage, setErrorMessage] = useState('')
  var [googleError, setGoogleError] = useState('')
  var [isLoading, setIsLoading] = useState(false)
  var googleBtnRef = useRef(null)

  var { loginUser } = useAuth()
  var navigate = useNavigate()
  var location = useLocation()

  var redirectTo = '/map'
  if (location.state && location.state.from) {
    redirectTo = location.state.from.pathname
  }

  function doRedirect(userRole) {
    var target = userRole === 'SUPER_ADMIN' ? '/dashboard' : '/map'
    if (location.state && location.state.from) {
      target = location.state.from.pathname
    }
    window.location.href = target
  }

  // Load Google Sign-In script
  useEffect(function () {
    if (!GOOGLE_CLIENT_ID || !googleBtnRef.current) return

    var script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = function () {
      if (window.google && googleBtnRef.current) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
          locale: 'en_US',
        })
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          width: googleBtnRef.current.offsetWidth || 320,
        })
      }
    }
    document.body.appendChild(script)

    return function () {
      if (document.body.contains(script)) document.body.removeChild(script)
    }
  }, [])

  async function handleGoogleResponse(response) {
    if (!response || !response.credential) {
      setGoogleError('Google sign-in failed. Please try again.')
      return
    }
    setGoogleError('')
    setIsLoading(true)
    try {
      var res = await googleLoginApi(response.credential)
      var data = res.data
      loginUser(data.user, data.access, data.refresh)
      doRedirect(data.user.role)
    } catch (error) {
      var msg = 'Google sign-in failed.'
      if (error.response && error.response.data && error.response.data.error) {
        msg = error.response.data.error
      }
      setGoogleError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')
    setIsLoading(true)

    try {
      var response = await loginApi(form)
      var data = response.data
      loginUser(data.user, data.access, data.refresh)
      doRedirect(data.user.role)
    } catch (error) {
      var message = 'Login failed. Please try again.'
      if (error.response && error.response.data && error.response.data.error) {
        message = error.response.data.error
      }
      setErrorMessage(message)
    } finally {
      setIsLoading(false)
    }
  }

  function updateField(fieldName, value) {
    var updatedForm = Object.assign({}, form)
    updatedForm[fieldName] = value
    setForm(updatedForm)
  }

  var hasGoogleConfig = GOOGLE_CLIENT_ID.length > 0

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-emerald-50 dark:from-gray-950 dark:via-gray-900 dark:to-emerald-950 px-4">
      <div className="w-full max-w-md">

        {/* HEADER */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-emerald-500 transition-colors mb-4">
            ← Back to Home
          </Link>
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-500/20">
            <FiBatteryCharging className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome back
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Sign in to your EcoCharge account
          </p>
        </div>

        {/* LOGIN FORM */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-xl border border-gray-200 dark:border-gray-800">

          {errorMessage && (
            <div className="mb-5 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-lg">
              {errorMessage}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Username</label>
            <div className="relative">
              <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={form.username}
                onChange={function (e) { updateField('username', e.target.value) }}
                placeholder="Enter your username"
                required
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
            <div className="relative">
              <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="password"
                value={form.password}
                onChange={function (e) { updateField('password', e.target.value) }}
                placeholder="Enter your password"
                required
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-medium hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
            {!isLoading && <FiArrowRight className="w-4 h-4" />}
          </button>

          {/* Divider */}
          {hasGoogleConfig && (
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700" />
              <span className="text-xs text-gray-400 uppercase">or</span>
              <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700" />
            </div>
          )}

          {/* Google Sign-In button */}
          {hasGoogleConfig && (
            <div>
              <div ref={googleBtnRef} className="flex justify-center" />
              {googleError && (
                <p className="mt-2 text-xs text-red-500 text-center">{googleError}</p>
              )}
            </div>
          )}

          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline">
              Create one
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
