import { Link } from 'react-router-dom'
import { FiMapPin, FiMessageCircle, FiTrendingUp, FiNavigation, FiBatteryCharging, FiSliders } from 'react-icons/fi'
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
    icon: FiTrendingUp,
    title: 'Smart Predictions',
    desc: 'ML-powered battery consumption predictions considering elevation, weather, traffic, and your specific EV model for accurate range estimates.',
  },
  {
    icon: FiSliders,
    title: 'Customizable Range',
    desc: 'Adjust your battery level with a slider to see real-time range estimates. Plan exactly when and where you need to stop to charge.',
  },
]

export default function Features() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Navbar />
      <main>
        <section className="pt-32 pb-16 px-4">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-ev-green/10 text-ev-green rounded-full text-sm font-medium mb-6">
              Features
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              Everything You Need<br />
              <span className="text-ev-green">on the Road</span>
            </h1>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              From finding chargers to planning multi-stop routes, EcoCharge has you covered.
            </p>
          </div>
        </section>

        <section className="pb-20 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map(function (feature) {
                return (
                  <div
                    key={feature.title}
                    className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:border-ev-green/50 transition-colors"
                  >
                    <feature.icon className="w-10 h-10 text-ev-green mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="py-16 px-4 bg-gray-50 dark:bg-gray-900">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              See It in Action
            </h2>
            <p className="text-lg text-gray-500 dark:text-gray-400 mb-8">
              Try the interactive map and plan your first trip in seconds.
            </p>
            <Link
              to="/map"
              className="inline-flex items-center gap-2 px-8 py-3 bg-ev-green text-white rounded-xl font-medium text-lg hover:bg-green-600 transition-colors"
            >
              <FiMapPin className="w-5 h-5" />
              Open Map
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
