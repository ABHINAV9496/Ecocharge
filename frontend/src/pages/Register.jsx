import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { FiBatteryCharging, FiUser, FiMail, FiLock, FiSmartphone, FiTruck, FiArrowRight, FiPlus } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import { register as registerApi, login as loginApi } from '../api/auth'
import { getVehicles, createVehicle } from '../api/vehicles'

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
  var [selectedVehicle, setSelectedVehicle] = useState(null)
  var [showCustomForm, setShowCustomForm] = useState(false)
  var [customFormErrors, setCustomFormErrors] = useState({})
  var [customForm, setCustomForm] = useState({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    battery_kwh: '',
    consumption_wh_per_km: '',
    fast_charge_kw: '',
    ac_charge_kw: '',
  })
  var redirectTimerRef = useRef(null)

  function updateField(fieldName, value) {
    var updatedForm = Object.assign({}, form)
    updatedForm[fieldName] = value
    setForm(updatedForm)
  }

  function validateCustomForm() {
    var e = {}
    var make = customForm.make.trim()
    var model = customForm.model.trim()

    if (!make) e.make = 'Make is required'
    else if (make.length > 50) e.make = 'Max 50 characters'
    else if (!/^[A-Za-z\s.\-]+$/.test(make)) e.make = 'Only letters, spaces, hyphens and dots'

    if (!model) e.model = 'Model is required'
    else if (model.length > 50) e.model = 'Max 50 characters'
    else if (!/^[A-Za-z0-9\s\-]+$/.test(model)) e.model = 'Only letters, numbers, spaces and hyphens'

    var year = parseInt(customForm.year)
    if (!year || isNaN(year)) e.year = 'Year is required'
    else if (year < 2010 || year > new Date().getFullYear() + 1) e.year = 'Year must be 2010\u2013' + (new Date().getFullYear() + 1)

    var bat = parseFloat(customForm.battery_kwh)
    if (!bat || isNaN(bat)) e.battery_kwh = 'Battery capacity is required'
    else if (bat < 5 || bat > 250) e.battery_kwh = 'Must be 5\u2013250 kWh'

    var con = parseFloat(customForm.consumption_wh_per_km)
    if (!con || isNaN(con)) e.consumption_wh_per_km = 'Consumption is required'
    else if (con < 80 || con > 500) e.consumption_wh_per_km = 'Must be 80\u2013500 Wh/km'

    var fc = parseFloat(customForm.fast_charge_kw)
    if (fc && (fc < 0 || fc > 500)) e.fast_charge_kw = 'Must be 0\u2013500 kW'

    var ac = parseFloat(customForm.ac_charge_kw)
    if (ac && (ac < 0 || ac > 50)) e.ac_charge_kw = 'Must be 0\u201350 kW'

    setCustomFormErrors(e)
    return Object.keys(e).length === 0
  }

  function handleAddCustomVehicle() {
    setCustomFormErrors({})
    if (!validateCustomForm()) return
    var vehicle = {
      make: customForm.make.trim(),
      model: customForm.model.trim(),
      year: parseInt(customForm.year) || new Date().getFullYear(),
      battery_kwh: parseFloat(customForm.battery_kwh),
      consumption_wh_per_km: parseFloat(customForm.consumption_wh_per_km),
      fast_charge_kw: parseFloat(customForm.fast_charge_kw) || 0,
      ac_charge_kw: parseFloat(customForm.ac_charge_kw) || 0,
    }
    setSelectedVehicle(vehicle)
    updateField('car_model', vehicle.make + ' ' + vehicle.model)
    updateField('battery_capacity_kwh', vehicle.battery_kwh)
    setShowCustomForm(false)
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

      if (selectedVehicle) {
        var vehicleId
        if (selectedVehicle.id) {
          vehicleId = selectedVehicle.id
        } else {
          try {
            var saved = await createVehicle({
              make: selectedVehicle.make,
              model: selectedVehicle.model,
              year: selectedVehicle.year,
              battery_kwh: selectedVehicle.battery_kwh,
              consumption_wh_per_km: selectedVehicle.consumption_wh_per_km,
              fast_charge_kw: selectedVehicle.fast_charge_kw || 0,
              ac_charge_kw: selectedVehicle.ac_charge_kw || 0,
            })
            vehicleId = saved.data.id
          } catch (e) {
            console.error('Failed to create vehicle:', e)
          }
        }
        if (vehicleId) {
          localStorage.setItem('preferred_vehicle_id', vehicleId)
        }
      }

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

              {selectedVehicle ? (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-800 flex items-center justify-center">
                        <FiTruck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {selectedVehicle.make} {selectedVehicle.model}
                        </p>
                        <p className="text-xs text-gray-500">
                          {selectedVehicle.battery_kwh} kWh · {Math.round((selectedVehicle.battery_kwh * 0.9 / (selectedVehicle.consumption_wh_per_km || 180)) * 1000)} km range
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={function () { setSelectedVehicle(null); setShowCustomForm(false) }}
                      className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 font-medium"
                    >
                      Change
                    </button>
                  </div>
                </div>
              ) : showCustomForm ? (
                <div className="border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Add Your Vehicle</p>
                    <button
                      type="button"
                      onClick={function () { setShowCustomForm(false) }}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Back to selection
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Make</label>
                      <input type="text" value={customForm.make} onChange={function (e) { setCustomForm(Object.assign({}, customForm, { make: e.target.value.replace(/[^A-Za-z\s.\-]/g, '') })) }} placeholder="e.g. Tesla" className={'w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all text-sm ' + (customFormErrors.make ? 'border-red-400' : 'border-emerald-200 dark:border-emerald-800/50')} maxLength="50" />
                      {customFormErrors.make && <p className="text-[10px] text-red-500 mt-0.5">{customFormErrors.make}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Model</label>
                      <input type="text" value={customForm.model} onChange={function (e) { setCustomForm(Object.assign({}, customForm, { model: e.target.value.replace(/[^A-Za-z0-9\s\-]/g, '') })) }} placeholder="e.g. Model 3" className={'w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all text-sm ' + (customFormErrors.model ? 'border-red-400' : 'border-emerald-200 dark:border-emerald-800/50')} maxLength="50" />
                      {customFormErrors.model && <p className="text-[10px] text-red-500 mt-0.5">{customFormErrors.model}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Year</label>
                      <input type="number" value={customForm.year} onChange={function (e) { setCustomForm(Object.assign({}, customForm, { year: e.target.value })) }} className={'w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all text-sm ' + (customFormErrors.year ? 'border-red-400' : 'border-emerald-200 dark:border-emerald-800/50')} min="2010" max="2027" />
                      {customFormErrors.year && <p className="text-[10px] text-red-500 mt-0.5">{customFormErrors.year}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Battery (kWh)</label>
                      <input type="number" step="0.1" value={customForm.battery_kwh} onChange={function (e) { setCustomForm(Object.assign({}, customForm, { battery_kwh: e.target.value })) }} placeholder="e.g. 75" className={'w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all text-sm ' + (customFormErrors.battery_kwh ? 'border-red-400' : 'border-emerald-200 dark:border-emerald-800/50')} min="5" max="250" />
                      {customFormErrors.battery_kwh && <p className="text-[10px] text-red-500 mt-0.5">{customFormErrors.battery_kwh}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Consumption (Wh/km)</label>
                      <input type="number" value={customForm.consumption_wh_per_km} onChange={function (e) { setCustomForm(Object.assign({}, customForm, { consumption_wh_per_km: e.target.value })) }} placeholder="e.g. 180" className={'w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all text-sm ' + (customFormErrors.consumption_wh_per_km ? 'border-red-400' : 'border-emerald-200 dark:border-emerald-800/50')} min="80" max="500" />
                      {customFormErrors.consumption_wh_per_km && <p className="text-[10px] text-red-500 mt-0.5">{customFormErrors.consumption_wh_per_km}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Fast Charge (kW)</label>
                      <input type="number" value={customForm.fast_charge_kw} onChange={function (e) { setCustomForm(Object.assign({}, customForm, { fast_charge_kw: e.target.value })) }} placeholder="e.g. 50" className={'w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all text-sm ' + (customFormErrors.fast_charge_kw ? 'border-red-400' : 'border-emerald-200 dark:border-emerald-800/50')} min="0" max="500" />
                      {customFormErrors.fast_charge_kw && <p className="text-[10px] text-red-500 mt-0.5">{customFormErrors.fast_charge_kw}</p>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">AC Charge (kW)</label>
                    <input type="number" step="0.1" value={customForm.ac_charge_kw} onChange={function (e) { setCustomForm(Object.assign({}, customForm, { ac_charge_kw: e.target.value })) }} placeholder="e.g. 7.4" className={'w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all text-sm ' + (customFormErrors.ac_charge_kw ? 'border-red-400' : 'border-emerald-200 dark:border-emerald-800/50')} min="0" max="50" />
                    {customFormErrors.ac_charge_kw && <p className="text-[10px] text-red-500 mt-0.5">{customFormErrors.ac_charge_kw}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCustomVehicle}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <FiPlus className="w-4 h-4" />
                    Add Vehicle
                  </button>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">Car Model</label>
                  <div className="relative">
                    <FiTruck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
                    <select
                      value=""
                      onChange={function (e) {
                        var val = e.target.value
                        if (val === '__custom__') {
                          setShowCustomForm(true)
                          return
                        }
                        var selected = vehicles.find(function (v) {
                          return (v.make + ' ' + v.model) === val
                        })
                        if (selected) {
                          setSelectedVehicle(selected)
                          updateField('car_model', val)
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
                      <option value="__custom__">Add my own vehicle +</option>
                    </select>
                  </div>
                </div>
              )}
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
