/*
  Register Page
  -------------
  A registration form for new users to create an EcoCharge account.

  Flow:
  1. User fills in their details (username, email, password, phone, car info)
  2. Clicks "Create Account"
  3. Frontend sends the data to Django backend
  4. If successful: automatically logs the user in and redirects to map
  5. If error: shows what went wrong

  The form collects:
  - Account info: username, email, password (with confirmation)
  - Personal info: phone number, role (Driver or Station Owner)
  - Vehicle info: car model, battery capacity

  BUG FIX NOTE: The password2 field MUST be sent to the backend.
  The Django RegisterSerializer requires it for validation.
*/

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { FiBatteryCharging, FiUser, FiMail, FiLock, FiSmartphone, FiTruck, FiArrowRight } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import { register as registerApi, login as loginApi } from '../api/auth'

export default function Register() {
  // All the form fields in one object
  var [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    password2: '',       // password confirmation (must match password)
    role: 'DRIVER',       // default role is Driver
    phone_number: '',
    car_model: '',
    battery_capacity_kwh: 40,
  })

  var [errorMessage, setErrorMessage] = useState('')
  var [isLoading, setIsLoading] = useState(false)

  var { loginUser } = useAuth()
  var navigate = useNavigate()

  // Update a single field in the form when the user types
  function updateField(fieldName, value) {
    var updatedForm = Object.assign({}, form)
    updatedForm[fieldName] = value
    setForm(updatedForm)
  }

  // Called when the form is submitted
  async function handleSubmit(event) {
    event.preventDefault()  // Don't reload the page
    setErrorMessage('')

    // Check that passwords match BEFORE sending to server
    if (form.password !== form.password2) {
      setErrorMessage('Passwords do not match')
      return
    }

    setIsLoading(true)

    try {
      // IMPORTANT: Send ALL fields including password2 to the backend
      // The Django RegisterSerializer checks password2 to confirm passwords match
      var payload = {
        username: form.username,
        email: form.email,
        password: form.password,
        password2: form.password2,  // Must send this! Backend requires it.
        role: form.role,
        phone_number: form.phone_number,
        car_model: form.car_model,
        battery_capacity_kwh: form.battery_capacity_kwh,
      }

      // Step 1: Register the user
      await registerApi(payload)

      // Step 2: Auto-login after successful registration
      var loginResponse = await loginApi({
        username: form.username,
        password: form.password,
      })

      var data = loginResponse.data
      loginUser(data.user, data.access, data.refresh)

      // Step 3: Redirect to the map
      navigate('/map')

    } catch (error) {
      // Show a user-friendly error message from the backend
      var message = 'Registration failed. Please try again.'

      if (error.response && error.response.data) {
        // Django returns errors as an object like: { "username": ["Already exists"] }
        // Get the first error message
        var errorData = error.response.data
        var firstKey = Object.keys(errorData)[0]
        var firstError = errorData[firstKey]
        if (Array.isArray(firstError)) {
          message = firstError[0]
        } else {
          message = firstError
        }
      }

      setErrorMessage(message)
      console.error('Registration error:', error)

    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-emerald-50 dark:from-gray-950 dark:via-gray-900 dark:to-emerald-950 px-4 py-8">
      <div className="w-full max-w-lg">

        {/* HEADER */}
        <div className="text-center mb-8">
          <Link to="/login" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-emerald-500 transition-colors mb-4">
            ← Back to Login
          </Link>
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-500/20">
            <FiBatteryCharging className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Create your account
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Join EcoCharge and start planning EV trips
          </p>
        </div>

        {/* REGISTRATION FORM */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-xl border border-gray-200 dark:border-gray-800">

          {/* Error banner */}
          {errorMessage && (
            <div className="mb-5 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-lg">
              {errorMessage}
            </div>
          )}

          {/* SECTION 1: Account Information */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
              Account Information
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Username</label>
                <div className="relative">
                  <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={form.username}
                    onChange={function (e) { updateField('username', e.target.value) }}
                    placeholder="Choose a username"
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
                <div className="relative">
                  <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={function (e) { updateField('email', e.target.value) }}
                    placeholder="your@email.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
                <div className="relative">
                  <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={form.password}
                    onChange={function (e) { updateField('password', e.target.value) }}
                    placeholder="Create a password"
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={form.password2}
                    onChange={function (e) { updateField('password2', e.target.value) }}
                    placeholder="Repeat password"
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Personal Details */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
              Personal Details
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Phone Number</label>
                <div className="relative">
                  <FiSmartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={form.phone_number}
                    onChange={function (e) { updateField('phone_number', e.target.value) }}
                    placeholder="+91 98765 43210"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">I am a</label>
                <select
                  value={form.role}
                  onChange={function (e) { updateField('role', e.target.value) }}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                >
                  <option value="DRIVER">EV Driver</option>
                  <option value="STATION_OWNER">Station Owner</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 3: Vehicle Information */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
              Vehicle Information
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {/* Car Model */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Car Model</label>
                <div className="relative">
                  <FiTruck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={form.car_model}
                    onChange={function (e) { updateField('car_model', e.target.value) }}
                    placeholder="e.g. Tata Nexon EV"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Battery Capacity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Battery (kWh)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.battery_capacity_kwh}
                  onChange={function (e) { updateField('battery_capacity_kwh', parseFloat(e.target.value)) }}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-medium hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
            {!isLoading && <FiArrowRight className="w-4 h-4" />}
          </button>

          {/* LINK TO LOGIN */}
          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
