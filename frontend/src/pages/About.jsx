import { Link } from 'react-router-dom'
import { FiBatteryCharging, FiMapPin, FiUsers, FiGlobe } from 'react-icons/fi'
import Navbar from '../components/layout/Navbar'

export default function About() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Navbar />
      <main>
        <section className="pt-32 pb-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-ev-green/10 text-ev-green rounded-full text-sm font-medium mb-6">
              About EcoCharge
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
              Making EV Travel<br />
              <span className="text-ev-green">Effortless</span>
            </h1>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-10">
              EcoCharge was built to solve one problem: range anxiety. We combine real-time charger data,
              AI-powered route planning, and detailed vehicle profiles so you never have to worry about
              finding your next charge.
            </p>
          </div>
        </section>

        <section className="py-16 px-4 bg-gray-50 dark:bg-gray-900">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: FiMapPin, stat: '1,800+', label: 'Charging Stations' },
                { icon: FiUsers, stat: '15+', label: 'Supported EVs' },
                { icon: FiGlobe, stat: 'All India', label: 'Coverage' },
              ].map(function (item) {
                return (
                  <div key={item.label} className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700 text-center">
                    <item.icon className="w-10 h-10 text-ev-green mx-auto mb-4" />
                    <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{item.stat}</div>
                    <div className="text-gray-500 dark:text-gray-400">{item.label}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">Our Mission</h2>
            <div className="space-y-6 text-gray-600 dark:text-gray-400 text-lg leading-relaxed">
              <p>
                Electric vehicles are the future, but the charging infrastructure still has gaps. We believe
                the best way to accelerate EV adoption is to make long-distance travel as easy as possible
                for current EV owners.
              </p>
              <p>
                EcoCharge aggregates data from Open Charge Map and community contributions to give you the
                most up-to-date view of available chargers. Our AI-powered trip planner considers your
                specific vehicle's battery, consumption, and charging speed to suggest optimal routes with
                charging stops built in.
              </p>
              <p>
                We're a small team passionate about sustainable transport and building tools that make a
                real difference in people's daily lives.
              </p>
            </div>
          </div>
        </section>

        <section className="py-16 px-4 bg-gray-50 dark:bg-gray-900">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Ready to Plan Your Next Trip?
            </h2>
            <p className="text-lg text-gray-500 dark:text-gray-400 mb-8">
              Try the map now — no account required.
            </p>
            <Link
              to="/map"
              className="inline-flex items-center gap-2 px-8 py-3 bg-ev-green text-white rounded-xl font-medium text-lg hover:bg-green-600 transition-colors"
            >
              <FiBatteryCharging className="w-5 h-5" />
              Open Map
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
