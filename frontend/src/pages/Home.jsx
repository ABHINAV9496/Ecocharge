import { Link } from 'react-router-dom'
import { FiBatteryCharging, FiMapPin, FiMessageCircle, FiTrendingUp, FiArrowRight } from 'react-icons/fi'
import Navbar from '../components/layout/Navbar'

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Navbar />
      <main>
        <section className="pt-32 pb-20 px-4">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-ev-green/10 text-ev-green rounded-full text-sm font-medium mb-6">
              <FiBatteryCharging className="w-4 h-4" />
              Smart EV Trip Planning
            </div>
            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
              Never Run Out of<br />
              <span className="text-ev-green">Charge</span> Again
            </h1>
            <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-10">
              AI-powered trip planning, real-time charger availability, and smart battery prediction
              — all in one platform.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link
                to="/register"
                className="px-8 py-3 bg-ev-green text-white rounded-xl font-medium text-lg hover:bg-green-600 transition-colors"
              >
                Get Started
              </Link>
              <Link
                to="/map"
                className="px-8 py-3 border-2 border-ev-green text-ev-green rounded-xl font-medium text-lg hover:bg-ev-green/5 transition-colors inline-flex items-center gap-2"
              >
                Try the Map
                <FiArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="px-8 py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium text-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </section>

        <section className="py-20 px-4 bg-gray-50 dark:bg-gray-900">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: FiMapPin,
                  title: 'Live Station Map',
                  desc: 'Find charging stations with real-time slot availability. Color-coded markers show available, occupied, and fault status.',
                },
                {
                  icon: FiMessageCircle,
                  title: 'EcoBot AI Assistant',
                  desc: 'Ask trip questions in natural language. EcoBot remembers your car model and preferences across conversations.',
                },
                {
                  icon: FiTrendingUp,
                  title: 'Smart Predictions',
                  desc: 'ML-powered battery consumption predictions considering elevation, weather, traffic, and your specific EV model.',
                },
              ].map(function (feature) {
                return (
                  <div key={feature.title} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                    <feature.icon className="w-10 h-10 text-ev-green mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">{feature.desc}</p>
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
