import { Link } from 'react-router-dom'
import { FiMapPin, FiUsers, FiGlobe, FiArrowRight } from 'react-icons/fi'
import Navbar from '../components/layout/Navbar'

export default function About() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Navbar />
      <main>
        <section className="pt-36 pb-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-full text-sm font-medium mb-8">
              About EcoCharge
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-[1.1] tracking-tight">
              Making EV Travel<br />
              <span className="text-emerald-600 dark:text-emerald-400">Effortless</span>
            </h1>
            <p className="text-lg text-gray-800 dark:text-gray-500 max-w-2xl mx-auto leading-relaxed">
              EcoCharge was built to solve one problem: range anxiety. We combine real-time charger data,
              AI-powered route planning, and detailed vehicle profiles so you never have to worry about
              finding your next charge.
            </p>
          </div>
        </section>

        <section className="py-16 px-4 bg-emerald-50/50 dark:bg-emerald-950/20">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-3 gap-5">
              {[
                { icon: FiMapPin, stat: '1,800+', label: 'Charging Stations' },
                { icon: FiUsers, stat: '15+', label: 'Supported EVs' },
                { icon: FiGlobe, stat: 'All India', label: 'Coverage' },
              ].map(function (item) {
                return (
                  <div key={item.label} className="bg-white dark:bg-gray-900 rounded-2xl p-8 border border-emerald-100 dark:border-emerald-900/30 text-center">
                    <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center mx-auto mb-5">
                      <item.icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="text-3xl md:text-4xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">{item.stat}</div>
                    <div className="text-sm text-gray-800 dark:text-gray-500">{item.label}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="py-24 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-10 text-center tracking-tight">Our Mission</h2>
            <div className="space-y-6 text-gray-800 dark:text-gray-400 text-lg leading-relaxed">
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

        <section className="py-20 px-4 bg-emerald-50/50 dark:bg-emerald-950/20">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
              See What We've Built
            </h2>
            <p className="text-lg text-gray-800 dark:text-gray-500 mb-8">
              Explore all the tools EcoCharge offers — from live maps to AI-powered trip planning.
            </p>
            <Link
              to="/features"
              className="inline-flex items-center gap-2 px-7 py-3 bg-emerald-600 text-white rounded-xl font-medium text-base hover:bg-emerald-700 transition-colors shadow-sm"
            >
              View Features
              <FiArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
