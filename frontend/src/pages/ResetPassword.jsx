import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FiLock, FiCheckCircle, FiAlertCircle } from 'react-icons/fi'
import { confirmPasswordReset } from '../api/auth'

export default function ResetPassword() {
  var [searchParams] = useSearchParams()
  var uid = searchParams.get('uid')
  var token = searchParams.get('token')

  var [password, setPassword] = useState('')
  var [password2, setPassword2] = useState('')
  var [done, setDone] = useState(false)
  var [loading, setLoading] = useState(false)
  var [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!password || !password2) {
      setError('Please fill in both fields')
      return
    }
    if (password !== password2) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    setError('')
    try {
      await confirmPasswordReset(uid, token, password, password2)
      setDone(true)
    } catch (err) {
      var msg = 'Something went wrong. Your link may have expired.'
      if (err.response?.data?.error) {
        msg = Array.isArray(err.response.data.error) ? err.response.data.error.join(', ') : err.response.data.error
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!uid || !token) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 text-center shadow-sm">
          <div className="w-14 h-14 bg-red-100 dark:bg-red-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FiAlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Invalid Reset Link</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <Link to="/forgot-password" className="text-sm font-medium text-emerald-500 hover:text-emerald-600 transition-colors">
            Request New Link
          </Link>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 text-center shadow-sm">
          <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FiCheckCircle className="w-7 h-7 text-emerald-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Password Reset!</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Your password has been successfully reset. You can now log in with your new password.
          </p>
          <Link to="/login" className="inline-block px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-medium rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/20">
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 shadow-sm">
        <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center mb-4">
          <FiLock className="w-6 h-6 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Set New Password</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Enter your new password below.
        </p>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">New Password</label>
            <input
              type="password"
              value={password}
              onChange={function (e) { setPassword(e.target.value) }}
              placeholder="At least 8 characters"
              required
              minLength={8}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={password2}
              onChange={function (e) { setPassword2(e.target.value) }}
              placeholder="Repeat your password"
              required
              minLength={8}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-medium rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
