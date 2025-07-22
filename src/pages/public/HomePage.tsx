import { Link } from 'react-router-dom'
import { 
  PhoneIcon, 
  ChartBarIcon, 
  ShieldCheckIcon, 
  CurrencyDollarIcon,
  BoltIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline'

const features = [
  {
    name: 'Real-Time Call Tracking',
    description: 'Monitor your calls as they happen with our advanced real-time dashboard and analytics.',
    icon: PhoneIcon,
  },
  {
    name: 'Fraud Prevention',
    description: 'Industry-leading fraud detection powered by machine learning protects your campaigns.',
    icon: ShieldCheckIcon,
  },
  {
    name: 'Quality Scoring',
    description: 'Automatic call quality scoring ensures you only pay for high-intent, qualified leads.',
    icon: ChartBarIcon,
  },
  {
    name: 'Flexible Payouts',
    description: 'Choose from daily, weekly, or monthly payouts with multiple payment methods.',
    icon: CurrencyDollarIcon,
  },
  {
    name: 'Instant Routing',
    description: 'Calls are routed to the best buyer in milliseconds based on your criteria.',
    icon: BoltIcon,
  },
  {
    name: 'Global Coverage',
    description: 'Accept calls from anywhere with support for international numbers and routing.',
    icon: GlobeAltIcon,
  },
]

const stats = [
  { label: 'Active Campaigns', value: '10,000+' },
  { label: 'Calls Per Month', value: '2.5M+' },
  { label: 'Average Quality Score', value: '94%' },
  { label: 'Uptime SLA', value: '99.9%' },
]

export default function HomePage() {
  return (
    <div>
      {/* Hero Section */}
      <div className="relative bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="relative z-10 pb-8 bg-white sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32">
            <main className="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
              <div className="sm:text-center lg:text-left">
                <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
                  <span className="block">The Most Trusted</span>
                  <span className="block text-primary-600">Pay-Per-Call Network</span>
                </h1>
                <p className="mt-3 text-base text-gray-500 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                  Connect quality callers with businesses that need them. Real-time tracking, fraud prevention, and instant payouts make DependableCalls the platform of choice for performance marketers.
                </p>
                <div className="mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start">
                  <div className="rounded-md shadow">
                    <Link
                      to="/register"
                      className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 md:py-4 md:text-lg md:px-10"
                    >
                      Get Started
                    </Link>
                  </div>
                  <div className="mt-3 sm:mt-0 sm:ml-3">
                    <Link
                      to="/login"
                      className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-primary-700 bg-primary-100 hover:bg-primary-200 md:py-4 md:text-lg md:px-10"
                    >
                      Login
                    </Link>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
        <div className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2">
          <div className="h-56 w-full bg-gradient-to-br from-primary-500 to-primary-700 sm:h-72 md:h-96 lg:w-full lg:h-full" />
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-primary-700">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
              Trusted by thousands of performance marketers
            </h2>
          </div>
          <dl className="mt-10 text-center sm:max-w-3xl sm:mx-auto sm:grid sm:grid-cols-2 sm:gap-8 lg:max-w-none lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col mt-10 sm:mt-0">
                <dt className="order-2 mt-2 text-lg leading-6 font-medium text-primary-200">
                  {stat.label}
                </dt>
                <dd className="order-1 text-5xl font-extrabold text-white">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-base text-primary-600 font-semibold tracking-wide uppercase">Features</h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need to succeed
            </p>
            <p className="mt-4 max-w-2xl text-xl text-gray-500 lg:mx-auto">
              Our platform provides all the tools and features you need to run successful pay-per-call campaigns.
            </p>
          </div>

          <div className="mt-10">
            <dl className="space-y-10 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-x-8 md:gap-y-10">
              {features.map((feature) => (
                <div key={feature.name} className="relative">
                  <dt>
                    <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-primary-500 text-white">
                      <feature.icon className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <p className="ml-16 text-lg leading-6 font-medium text-gray-900">
                      {feature.name}
                    </p>
                  </dt>
                  <dd className="mt-2 ml-16 text-base text-gray-500">
                    {feature.description}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gray-50">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:py-16 lg:px-8 lg:flex lg:items-center lg:justify-between">
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            <span className="block">Ready to get started?</span>
            <span className="block text-primary-600">Start your free trial today.</span>
          </h2>
          <div className="mt-8 flex lg:mt-0 lg:flex-shrink-0">
            <div className="inline-flex rounded-md shadow">
              <Link
                to="/register"
                className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
              >
                Get started
              </Link>
            </div>
            <div className="ml-3 inline-flex rounded-md shadow">
              <Link
                to="/contact"
                className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-primary-600 bg-white hover:bg-primary-50"
              >
                Contact sales
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}