import { FiMapPin, FiMessageCircle, FiCloud, FiNavigation, FiBatteryCharging, FiCalendar } from 'react-icons/fi'
import Navbar from '../components/layout/Navbar'

var FEATURES = [
  {
    icon: FiMapPin,
    title: 'Live Station Map',
    desc: 'Interactive map with real-time charging station locations, color-coded by status (active, maintenance, inactive). Switch between light, dark, and satellite views.',
  },
  {
    icon: FiNavigation,
    title: 'Route Planning',
    desc: 'Enter your start and destination, pick your EV model, and get a complete route with charging stops automatically placed along the way.',
  },
  {
    icon: FiBatteryCharging,
    title: 'Vehicle Profiles',
    desc: 'Choose from 15+ Indian EV models with accurate battery capacity, consumption rates, and charging speeds. Add custom vehicles too.',
  },
  {
    icon: FiMessageCircle,
    title: 'EcoBot AI Assistant',
    desc: 'Ask trip questions in natural language. EcoBot remembers your car model and preferences across conversations for personalized advice.',
  },
  {
    icon: FiCloud,
    title: 'Real-time Weather',
    desc: 'Current weather, 24-hour forecast, 7-day outlook, and route-specific conditions via Open-Meteo. Plan around rain, heat, or wind with confidence.',
  },
  {
    icon: FiCalendar,
    title: 'Bookings & Payments',
    desc: 'Reserve charging slots with concurrent-safe booking and secure Razorpay payments. Start, complete, or cancel sessions with full payment lifecycle.',
  },
]

export default function Features() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Navbar />
      <main>
        <section className="pt-36 pb-16 px-4">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-full text-sm font-medium mb-8">
              Features
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 tracking-tight">
              Everything You Need<br />
              <span className="text-emerald-600 dark:text-emerald-400">on the Road</span>
            </h1>
            <p className="text-lg text-gray-800 dark:text-gray-500 max-w-2xl mx-auto">
              From finding chargers to planning multi-stop routes, EcoCharge has you covered.
            </p>
          </div>
        </section>

        <section className="pb-24 px-4 bg-gray-50 dark:bg-gray-950/20">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map(function (feature) {
                return (
                  <div
                    key={feature.title}
                    className="group bg-white dark:bg-gray-900 rounded-2xl p-7 border border-emerald-100 dark:border-emerald-900/30 hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors"
                  >
                    <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center mb-5 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/40 transition-colors">
                      <feature.icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2.5">{feature.title}</h3>
                    <p className="text-sm text-gray-800 dark:text-gray-500 leading-relaxed">{feature.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="py-20 px-4 bg-emerald-50/50 dark:bg-emerald-950/20">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
                How It Works
              </h2>
              <p className="text-lg text-gray-800 dark:text-gray-500 max-w-xl mx-auto">
                Three simple steps from planning to charging.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: '01',
                  title: 'Create Account',
                  desc: 'Sign up, set up your vehicle profile with accurate battery specs, and you\'re ready to go.',
                },
                {
                  step: '02',
                  title: 'Plan Your Trip',
                  desc: 'Enter start and destination. EcoBot suggests the best route with charging stops placed automatically.',
                },
                {
                  step: '03',
                  title: 'Charge & Go',
                  desc: 'Navigate to any station, check real-time slot availability, book, and pay — all in one place.',
                },
              ].map(function (item) {
                return (
                  <div key={item.step} className="text-center">
                    <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center mx-auto mb-5">
                      <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{item.step}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2.5">{item.title}</h3>
                    <p className="text-sm text-gray-800 dark:text-gray-500 leading-relaxed max-w-xs mx-auto">{item.desc}</p>
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
