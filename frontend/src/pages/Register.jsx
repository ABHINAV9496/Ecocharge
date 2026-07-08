import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { FiBatteryCharging, FiUser, FiMail, FiLock, FiSmartphone, FiTruck, FiArrowRight } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import { register as registerApi, login as loginApi } from '../api/auth'
import { getVehicles } from '../api/vehicles'

export default function Register() {
  var [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    password2: '',
    role: 'DRIVER',
    phone_number: '',
    car_model: '',
    battery_capacity_kwh: 40,
  })

  var [errorMessage, setErrorMessage] = useState('')
  var [isLoading, setIsLoading] = useState(false)
  var [welcomeMessage, setWelcomeMessage] = useState('')
  var [vehicles, setVehicles] = useState([])
  var [vehicleMode, setVehicleMode] = useState('select')
  var redirectTimerRef = useRef(null)

  function updateField(fieldName, value) {
    var updatedForm = Object.assign({}, form)
    updatedForm[fieldName] = value
    setForm(updatedForm)
  }

  useEffect(function () {
    if (form.role === 'DRIVER') {
      getVehicles().then(function (res) {
        setVehicles(res.data || [])
      }).catch(function () { })
    }
  }, [form.role])

  useEffect(function () {
    return function () {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current)
      }
    }
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')

    if (form.password !== form.password2) {
      setErrorMessage('Passwords do not match')
      return
    }

    setIsLoading(true)

    try {
      var payload = {
        username: form.username,
        email: form.email,
        password: form.password,
        password2: form.password2,
        role: form.role,
        phone_number: form.phone_number,
        car_model: form.car_model,
        battery_capacity_kwh: form.battery_capacity_kwh,
      }

      var registerResponse = await registerApi(payload)
      var welcomeMsg = registerResponse.data.message || ''

      var loginResponse = await loginApi({
        username: form.username,
        password: form.password,
      })

      var data = loginResponse.data
      localStorage.setItem('access_token', data.access)
      localStorage.setItem('refresh_token', data.refresh)
      localStorage.setItem('user', JSON.stringify(data.user))

      setWelcomeMessage(welcomeMsg)

      redirectTimerRef.current = setTimeout(function () {
        window.location.href = '/map'
      }, 4000)

    } catch (error) {
      var message = 'Registration failed. Please try again.'

      if (error.response && error.response.data) {
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
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 px-4 py-8">
      <div className="w-full max-w-lg">

        <div className="text-center mb-8">
          <Link to="/login" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-emerald-600 transition-colors mb-6">
            ← Back to Login
          </Link>
          <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm">
            <FiBatteryCharging className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Create your account
          </h1>
          <p className="text-gray-400 dark:text-gray-500 mt-1 text-sm">
            Join EcoCharge and start planning EV trips
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-2xl p-7 border border-emerald-100 dark:border-emerald-900/30">

          {errorMessage && (
            <div className="mb-5 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl">
              {errorMessage}
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
              Account Information
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">Username</label>
                <div className="relative">
                  <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={form.username}
                    onChange={function (e) { updateField('username', e.target.value) }}
                    placeholder="Choose a username"
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-emerald-200 dark:border-emerald-800/50 rounded-xl bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">Email</label>
                <div className="relative">
                  <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={function (e) { updateField('email', e.target.value) }}
                    placeholder="your@email.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-emerald-200 dark:border-emerald-800/50 rounded-xl bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">Password</label>
                <div className="relative">
                  <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={form.password}
                    onChange={function (e) { updateField('password', e.target.value) }}
                    placeholder="Create a password"
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-emerald-200 dark:border-emerald-800/50 rounded-xl bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={form.password2}
                    onChange={function (e) { updateField('password2', e.target.value) }}
                    placeholder="Repeat password"
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-emerald-200 dark:border-emerald-800/50 rounded-xl bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
              Personal Details
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">Phone Number</label>
                <div className="relative">
                  <FiSmartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={form.phone_number}
                    onChange={function (e) { updateField('phone_number', e.target.value) }}
                    placeholder="+91 98765 43210"
                    className="w-full pl-10 pr-4 py-2.5 border border-emerald-200 dark:border-emerald-800/50 rounded-xl bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">I am a</label>
                <select
                  value={form.role}
                  onChange={function (e) { updateField('role', e.target.value) }}
                  className="w-full px-4 py-2.5 border border-emerald-200 dark:border-emerald-800/50 rounded-xl bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                >
                  <option value="DRIVER">EV Driver</option>
                  <option value="STATION_OWNER">Station Owner</option>
                </select>
              </div>
            </div>
          </div>

          {form.role === 'DRIVER' && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
                Vehicle Information
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">Car Model</label>
                  <div className="relative">
                    <FiTruck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
                    {vehicleMode === 'select' ? (
                      <select
                        value={form.car_model}
                        onChange={function (e) {
                          var val = e.target.value
                          if (val === '__custom__') {
                            setVehicleMode('custom')
                            return
                          }
                          updateField('car_model', val)
                          var selected = vehicles.find(function (v) {
                            return (v.make + ' ' + v.model) === val
                          })
                          if (selected) {
                            updateField('battery_capacity_kwh', selected.battery_kwh)
                          }
                        }}
                        className="w-full pl-10 pr-10 py-2.5 border border-emerald-200 dark:border-emerald-800/50 rounded-xl bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                      >
                        <option value="">Select your vehicle</option>
                        {vehicles.filter(function (v) { return v.is_builtin }).map(function (v) {
                          var label = v.make + ' ' + v.model + ' (' + v.year + ')'
                          return (
                            <option key={v.id} value={v.make + ' ' + v.model}>{label}</option>
                          )
                        })}
                        <option value="__custom__">Other / Add my own vehicle</option>
                      </select>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={form.car_model}
                          onChange={function (e) { updateField('car_model', e.target.value) }}
                          placeholder="e.g. Tata Nexon EV"
                          className="w-full pl-10 pr-4 py-2.5 border border-emerald-200 dark:border-emerald-800/50 rounded-xl bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                        />
                        <button
                          type="button"
                          onClick={function () { setVehicleMode('select') }}
                          className="px-3 py-2.5 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors whitespace-nowrap"
                        >
                          Browse
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">Battery (kWh)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.battery_capacity_kwh}
                    onChange={function (e) { updateField('battery_capacity_kwh', parseFloat(e.target.value)) }}
                    className="w-full px-4 py-2.5 border border-emerald-200 dark:border-emerald-800/50 rounded-xl bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
            {!isLoading && <FiArrowRight className="w-4 h-4" />}
          </button>

          <p className="mt-6 text-center text-sm text-gray-400 dark:text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-emerald-600 dark:text-emerald-400 font-medium hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
              Sign in
            </Link>
          </p>
        </form>

        {welcomeMessage && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center border border-emerald-100 dark:border-emerald-900/30">
              <div className="w-14 h-14 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                <FiBatteryCharging className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Welcome to EcoCharge!
              </h2>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                {welcomeMessage}
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-4">
                Redirecting to the map...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
