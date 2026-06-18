import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FiMail, FiArrowLeft, FiCheckCircle } from 'react-icons/fi'
import { requestPasswordReset } from '../api/auth'

export default function ForgotPassword() {
  var [email, setEmail] = useState('')
  var [sent, setSent] = useState(false)
  var [loading, setLoading] = useState(false)
  var [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 text-center shadow-sm">
          <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FiCheckCircle className="w-7 h-7 text-emerald-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Check Your Email</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            If an account with <strong>{email}</strong> exists, we've sent a password reset link.
          </p>
          <Link to="/login" className="text-sm font-medium text-emerald-500 hover:text-emerald-600 transition-colors">
            Back to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 shadow-sm">
        <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-6 transition-colors">
          <FiArrowLeft className="w-4 h-4" />
          Back to Login
        </Link>

        <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center mb-4">
          <FiMail className="w-6 h-6 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Forgot Password?</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Enter your email address and we'll send you a link to reset your password.
        </p>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={function (e) { setEmail(e.target.value) }}
              placeholder="you@example.com"
              required
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-medium rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
      </div>
    </div>
  )
}
