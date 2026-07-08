import { Link } from 'react-router-dom'
import { FiMapPin, FiMessageCircle, FiNavigation, FiArrowRight, FiZap } from 'react-icons/fi'
import Navbar from '../components/layout/Navbar'

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Navbar />
      <main>
        <section className="pt-36 pb-24 px-4">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-full text-sm font-medium mb-8">
              <FiZap className="w-4 h-4" />
              Smart EV Trip Planning
            </div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-gray-900 dark:text-white mb-6 leading-[1.05] tracking-tight">
              Never Run Out of<br />
              <span className="text-emerald-600 dark:text-emerald-400">Charge</span> Again
            </h1>
            <p className="text-lg md:text-xl text-gray-800 dark:text-gray-500 max-w-2xl mx-auto mb-12 leading-relaxed">
              AI-powered trip planning, real-time charger availability, and smart battery prediction
              — all in one platform.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link
                to="/register"
                className="px-7 py-3 bg-emerald-600 text-white rounded-xl font-medium text-base hover:bg-emerald-700 transition-colors inline-flex items-center gap-2 shadow-sm"
              >
                Get Started
                <FiArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/map"
                className="px-7 py-3 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 rounded-xl font-medium text-base hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors inline-flex items-center gap-2"
              >
                <FiMapPin className="w-4 h-4" />
                Try the Map
              </Link>
            </div>
          </div>
        </section>

        <section className="pb-24 px-4 bg-gray-50 dark:bg-gray-950/20">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Everything you need,<br />
                <span className="text-emerald-600 dark:text-emerald-400">nothing you don't</span>
              </h2>
              <p className="text-gray-800 dark:text-gray-500 max-w-xl mx-auto">
                Built for EV drivers who want to spend more time driving and less time worrying.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
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
                  icon: FiNavigation,
                  title: 'AI Trip Planner',
                  desc: 'Get optimal routes with charging stops automatically placed along the way based on your EV model, battery level, and live conditions.',
                },
              ].map(function (feature) {
                return (
                  <div key={feature.title} className="group bg-white dark:bg-gray-900 rounded-2xl p-7 border border-emerald-100 dark:border-emerald-900/30 hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors">
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
      </main>
    </div>
  )
}
