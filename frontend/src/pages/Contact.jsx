import { FiMail, FiMapPin, FiClock, FiChevronDown, FiSend, FiCheck } from 'react-icons/fi'
import { useState } from 'react'
import Navbar from '../components/layout/Navbar'
import { sendContactMessage } from '../api/contact'

export default function Contact() {
  var [sent, setSent] = useState(false)
  var [error, setError] = useState('')
  var [form, setForm] = useState({ name: '', email: '', message: '' })
  var [openIndex, setOpenIndex] = useState(-1)

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
        <section className="pt-36 pb-16 px-4">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-full text-sm font-medium mb-8">
              Get in Touch
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 tracking-tight">
              We'd Love to Hear<br />
              <span className="text-emerald-600 dark:text-emerald-400">From You</span>
            </h1>
            <p className="text-lg text-gray-800 dark:text-gray-500 max-w-2xl mx-auto">
              Have a question, suggestion, or want to partner with us? Reach out and we'll get back to you.
            </p>
          </div>
        </section>

        <section className="pb-24 px-4 bg-gray-50 dark:bg-gray-950/20">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 mb-20">
            <div>
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 p-8 shadow-sm h-full">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Contact Information</h3>
                <div className="space-y-6">
                  {[
                    { icon: FiMail, label: 'Email', value: 'hello@ecocharge.app', desc: "We'll respond within 24 hours." },
                    { icon: FiMapPin, label: 'Location', value: 'Bengaluru, India', desc: 'Our team is based in Karnataka.' },
                    { icon: FiClock, label: 'Support Hours', value: 'Mon\u2013Sat, 9 AM \u2013 6 PM IST', desc: 'We typically respond within 2 hours.' },
                  ].map(function (item) {
                    return (
                      <div key={item.label} className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                          <item.icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.label}</p>
                          <p className="text-sm text-gray-800 dark:text-gray-400">{item.value}</p>
                          <p className="text-xs text-gray-800 dark:text-gray-500 mt-0.5">{item.desc}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div>
              <div className="bg-white dark:bg-gray-900 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-8 shadow-sm h-full">
                {sent ? (
                  <div className="text-center py-8">
                    <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FiCheck className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Message Sent!</h3>
                    <p className="text-sm text-gray-800 dark:text-gray-500">We'll get back to you within 24 hours.</p>
                    <button
                      onClick={function () { setSent(false); setForm({ name: '', email: '', message: '' }) }}
                      className="mt-6 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
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
                        <label className="block text-sm font-medium text-gray-800 dark:text-gray-400 mb-1.5">Name</label>
                        <input
                          type="text"
                          value={form.name}
                          onChange={function (e) { updateField('name', e.target.value) }}
                          placeholder="Your name"
                          required
                          className="w-full px-4 py-2.5 border border-gray-200 dark:border-emerald-800/50 rounded-xl bg-white dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-800 dark:text-gray-400 mb-1.5">Email</label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={function (e) { updateField('email', e.target.value) }}
                          placeholder="you@example.com"
                          required
                          className="w-full px-4 py-2.5 border border-gray-200 dark:border-emerald-800/50 rounded-xl bg-white dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-800 dark:text-gray-400 mb-1.5">Message</label>
                      <textarea
                        rows={5}
                        value={form.message}
                        onChange={function (e) { updateField('message', e.target.value) }}
                        placeholder="Tell us what's on your mind..."
                        required
                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-emerald-800/50 rounded-xl bg-white dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all resize-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      <FiSend className="w-4 h-4" />
                      Send Message
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>

          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4 text-center tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-gray-800 dark:text-gray-500 text-center mb-12 max-w-xl mx-auto">
              Quick answers to common questions about EcoCharge.
            </p>
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 p-8 shadow-sm">
              {[
                { q: 'How do I book a charging slot?', a: 'Navigate to the map, select a station, choose an available slot based on type and time, and complete payment via Razorpay. You\'ll receive a confirmation instantly and can track your booking from the dashboard.' },
                { q: 'How does route planning work?', a: 'Enter your start point and destination, pick your EV model, and the AI-powered planner generates an optimal route with charging stops placed automatically. It considers battery level, consumption, and charging speeds.' },
                { q: 'Can I save my vehicle profile?', a: 'Yes, choose from 15+ built-in Indian EV models (Tata Nexon, MG ZS, etc.) with accurate battery capacity, consumption rates, and charging speeds. You can also add custom vehicles with your own specs.' },
                { q: 'How does the EcoBot AI assistant work?', a: 'EcoBot uses Groq LLM (Llama 3.3 70B) with real-time access to station data, weather forecasts, and route planning tools. Just ask trip questions in natural language — it remembers your vehicle preferences across conversations.' },
                { q: 'Is EcoCharge available across all of India?', a: 'We aggregate data from Open Charge Map and community contributions, covering charging stations across India with real-time availability. Coverage is strongest in major cities and along key highway routes.' },
                { q: 'Does the map show real-time station status?', a: 'Yes, stations are color-coded on the map — green for available, orange for occupied, red for fault or maintenance. You can filter by connector type, slot status, and view real-time availability for every slot.' },
              ].map(function (item, i) {
                var open = openIndex === i
                return (
                  <div key={i} className="border-b border-gray-200 dark:border-gray-800 last:border-0">
                    <button
                      onClick={function () { setOpenIndex(open ? -1 : i) }}
                      className="w-full flex items-center justify-between py-4 text-left gap-4"
                    >
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{item.q}</span>
                      <FiChevronDown className={'w-4 h-4 text-gray-800 dark:text-gray-400 shrink-0 transition-transform duration-200 ' + (open ? 'rotate-180' : '')} />
                    </button>
                    {open && (
                      <p className="pb-4 text-sm text-gray-800 dark:text-gray-500 leading-relaxed">{item.a}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
