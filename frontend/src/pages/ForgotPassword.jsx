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
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white dark:bg-gray-900 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 p-8 text-center">
          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FiCheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Check Your Email</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">
            If an account with <strong className="text-gray-900 dark:text-white">{email}</strong> exists, we've sent a password reset link.
          </p>
          <Link to="/login" className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
            Back to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white dark:bg-gray-900 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 p-8">
        <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 mb-6 transition-colors no-underline">
          <FiArrowLeft className="w-4 h-4" />
          Back to Login
        </Link>

        <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center mb-4">
          <FiMail className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Forgot Password?</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">
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
              className="w-full px-3.5 py-2.5 text-sm border border-emerald-200 dark:border-emerald-800/50 rounded-xl bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
      </div>
    </div>
  )
}
