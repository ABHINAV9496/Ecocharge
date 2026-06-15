import { Link } from 'react-router-dom'
import { FiMail, FiMapPin, FiMessageCircle, FiBatteryCharging, FiSend, FiCheck } from 'react-icons/fi'
import { useState } from 'react'
import Navbar from '../components/layout/Navbar'
import { sendContactMessage } from '../api/contact'

export default function Contact() {
  var [sent, setSent] = useState(false)
  var [error, setError] = useState('')
  var [form, setForm] = useState({ name: '', email: '', message: '' })

  function updateField(field, value) {
    var next = Object.assign({}, form)
    next[field] = value
    setForm(next)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      await sendContactMessage(form)
      setSent(true)
    } catch (err) {
      setError('Failed to send message. Please try again later.')
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Navbar />
      <main>
        <section className="pt-32 pb-16 px-4">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-ev-green/10 text-ev-green rounded-full text-sm font-medium mb-6">
              Get in Touch
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              We'd Love to Hear<br />
              <span className="text-ev-green">From You</span>
            </h1>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              Have a question, suggestion, or want to partner with us? Reach out and we'll get back to you.
            </p>
          </div>
        </section>

        <section className="pb-24 px-4">
          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                <FiMail className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Email</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">hello@ecocharge.app</p>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                <FiMapPin className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Location</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Bengaluru, India</p>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                <FiMessageCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Social</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">@ecocharge_app</p>
            </div>
          </div>

          <div className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 shadow-sm">
              {sent ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FiCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Message Sent!</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">We'll get back to you within 24 hours.</p>
                  <button
                    onClick={function () { setSent(false); setForm({ name: '', email: '', message: '' }) }}
                    className="mt-6 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl">
                      {error}
                    </div>
                  )}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Name</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={function (e) { updateField('name', e.target.value) }}
                        placeholder="Your name"
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={function (e) { updateField('email', e.target.value) }}
                        placeholder="you@example.com"
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Message</label>
                    <textarea
                      rows={5}
                      value={form.message}
                      onChange={function (e) { updateField('message', e.target.value) }}
                      placeholder="Tell us what's on your mind..."
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-medium hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
                  >
                    <FiSend className="w-4 h-4" />
                    Send Message
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
