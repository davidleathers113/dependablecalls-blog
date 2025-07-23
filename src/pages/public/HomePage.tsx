import { Link, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { handleHashChange } from '../../utils/navigation'
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
    description:
      'Monitor your calls as they happen with our advanced real-time dashboard and analytics.',
    icon: PhoneIcon,
  },
  {
    name: 'Fraud Prevention',
    description:
      'Industry-leading fraud detection powered by machine learning protects your campaigns.',
    icon: ShieldCheckIcon,
  },
  {
    name: 'Quality Scoring',
    description:
      'Automatic call quality scoring ensures you only pay for high-intent, qualified leads.',
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
  const navigate = useNavigate()

  const handlePricingClick = (plan: string) => {
    // Track the pricing plan selection and navigate to registration
    console.log(`Selected pricing plan: ${plan}`)
    navigate('/register', { state: { selectedPlan: plan } })
  }

  const handleContactSales = () => {
    navigate('/contact', { state: { inquiry: 'enterprise-pricing' } })
  }

  useEffect(() => {
    // Handle hash navigation on page load
    handleHashChange()

    // Listen for hash changes
    const handleHashChangeEvent = () => handleHashChange()
    window.addEventListener('hashchange', handleHashChangeEvent)

    return () => {
      window.removeEventListener('hashchange', handleHashChangeEvent)
    }
  }, [])

  return (
    <div>
      {/* Hero Section */}
      <div className="relative bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="relative z-10 pb-8 bg-white sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32">
            <main className="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
              <div className="sm:text-center lg:text-left">
                <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
                  <span className="block">The Most Trusted</span>
                  <span className="block text-primary-600">Pay-Per-Call Network</span>
                </h1>
                <p className="mt-3 text-base text-gray-500 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                  Connect quality callers with businesses that need them. Real-time tracking, fraud
                  prevention, and instant payouts make DependableCalls the platform of choice for
                  performance marketers.
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
                <dd className="order-1 text-5xl font-extrabold text-white">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="py-12 bg-white scroll-offset">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-base text-primary-600 font-semibold tracking-wide uppercase">
              Features
            </h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need to succeed
            </p>
            <p className="mt-4 max-w-2xl text-xl text-gray-500 lg:mx-auto">
              Our platform provides all the tools and features you need to run successful
              pay-per-call campaigns.
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
                  <dd className="mt-2 ml-16 text-base text-gray-500">{feature.description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div id="pricing" className="py-12 bg-gray-50 scroll-offset">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-base text-primary-600 font-semibold tracking-wide uppercase">
              Pricing
            </h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Simple, transparent pricing
            </p>
            <p className="mt-4 max-w-2xl text-xl text-gray-500 lg:mx-auto">
              Choose the plan that fits your business needs. All plans include our core features.
            </p>
          </div>

          <div className="mt-10">
            <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-6 lg:gap-8">
              {/* Basic Plan */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm divide-y divide-gray-200">
                <div className="p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Basic</h3>
                  <p className="mt-4 text-sm text-gray-500">Perfect for getting started</p>
                  <p className="mt-8">
                    <span className="text-4xl font-extrabold text-gray-900">$0</span>
                    <span className="text-base font-medium text-gray-500">/month</span>
                  </p>
                  <button
                    onClick={() => handlePricingClick('basic')}
                    className="mt-8 block w-full bg-gray-800 py-2 text-center text-sm font-semibold text-white rounded-md hover:bg-gray-900 transition-colors duration-200"
                  >
                    Get started
                  </button>
                </div>
                <div className="pt-6 pb-8 px-6">
                  <h4 className="text-xs font-medium text-gray-900 tracking-wide uppercase">
                    What's included
                  </h4>
                  <ul className="mt-6 space-y-4">
                    <li className="flex space-x-3">
                      <span className="text-green-500">✓</span>
                      <span className="text-sm text-gray-500">Up to 100 calls/month</span>
                    </li>
                    <li className="flex space-x-3">
                      <span className="text-green-500">✓</span>
                      <span className="text-sm text-gray-500">Basic analytics</span>
                    </li>
                    <li className="flex space-x-3">
                      <span className="text-green-500">✓</span>
                      <span className="text-sm text-gray-500">Email support</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Professional Plan */}
              <div className="bg-white border border-primary-500 rounded-lg shadow-sm divide-y divide-gray-200">
                <div className="p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Professional</h3>
                  <p className="mt-4 text-sm text-gray-500">Best for growing businesses</p>
                  <p className="mt-8">
                    <span className="text-4xl font-extrabold text-gray-900">$299</span>
                    <span className="text-base font-medium text-gray-500">/month</span>
                  </p>
                  <button
                    onClick={() => handlePricingClick('professional')}
                    className="mt-8 block w-full bg-primary-600 py-2 text-center text-sm font-semibold text-white rounded-md hover:bg-primary-700 transition-colors duration-200"
                  >
                    Start free trial
                  </button>
                </div>
                <div className="pt-6 pb-8 px-6">
                  <h4 className="text-xs font-medium text-gray-900 tracking-wide uppercase">
                    What's included
                  </h4>
                  <ul className="mt-6 space-y-4">
                    <li className="flex space-x-3">
                      <span className="text-green-500">✓</span>
                      <span className="text-sm text-gray-500">Up to 1,000 calls/month</span>
                    </li>
                    <li className="flex space-x-3">
                      <span className="text-green-500">✓</span>
                      <span className="text-sm text-gray-500">Advanced analytics</span>
                    </li>
                    <li className="flex space-x-3">
                      <span className="text-green-500">✓</span>
                      <span className="text-sm text-gray-500">Priority support</span>
                    </li>
                    <li className="flex space-x-3">
                      <span className="text-green-500">✓</span>
                      <span className="text-sm text-gray-500">API access</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Enterprise Plan */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm divide-y divide-gray-200">
                <div className="p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Enterprise</h3>
                  <p className="mt-4 text-sm text-gray-500">For high-volume operations</p>
                  <p className="mt-8">
                    <span className="text-4xl font-extrabold text-gray-900">Custom</span>
                  </p>
                  <button
                    onClick={handleContactSales}
                    className="mt-8 block w-full bg-gray-800 py-2 text-center text-sm font-semibold text-white rounded-md hover:bg-gray-900 transition-colors duration-200"
                  >
                    Contact sales
                  </button>
                </div>
                <div className="pt-6 pb-8 px-6">
                  <h4 className="text-xs font-medium text-gray-900 tracking-wide uppercase">
                    What's included
                  </h4>
                  <ul className="mt-6 space-y-4">
                    <li className="flex space-x-3">
                      <span className="text-green-500">✓</span>
                      <span className="text-sm text-gray-500">Unlimited calls</span>
                    </li>
                    <li className="flex space-x-3">
                      <span className="text-green-500">✓</span>
                      <span className="text-sm text-gray-500">Custom integrations</span>
                    </li>
                    <li className="flex space-x-3">
                      <span className="text-green-500">✓</span>
                      <span className="text-sm text-gray-500">Dedicated account manager</span>
                    </li>
                    <li className="flex space-x-3">
                      <span className="text-green-500">✓</span>
                      <span className="text-sm text-gray-500">24/7 phone support</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* About Section */}
      <div id="about" className="py-12 bg-white scroll-offset">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-base text-primary-600 font-semibold tracking-wide uppercase">
              About Us
            </h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              The trusted pay-per-call network
            </p>
            <p className="mt-4 max-w-2xl text-xl text-gray-500 lg:mx-auto">
              We've been connecting quality traffic providers with serious advertisers since 2020,
              building a reputation for transparency, reliability, and exceptional results.
            </p>
          </div>

          <div className="mt-10">
            <div className="space-y-10 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-10">
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900">Our Mission</h3>
                <p className="mt-2 text-base text-gray-500">
                  To create a transparent, fraud-free marketplace where traffic suppliers and
                  advertisers can build mutually beneficial relationships based on quality and
                  performance.
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900">Why Choose Us</h3>
                <p className="mt-2 text-base text-gray-500">
                  With industry-leading fraud detection, real-time analytics, and a commitment to
                  partner success, we're the platform of choice for serious performance marketers.
                </p>
              </div>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="text-center">
                <p className="text-4xl font-extrabold text-primary-600">$50M+</p>
                <p className="mt-2 text-base text-gray-500">Revenue Generated</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-extrabold text-primary-600">10K+</p>
                <p className="mt-2 text-base text-gray-500">Active Campaigns</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-extrabold text-primary-600">500+</p>
                <p className="mt-2 text-base text-gray-500">Trusted Partners</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-extrabold text-primary-600">24/7</p>
                <p className="mt-2 text-base text-gray-500">Support Available</p>
              </div>
            </div>
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
                className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-colors duration-200"
              >
                Get started
              </Link>
            </div>
            <div className="ml-3 inline-flex rounded-md shadow">
              <Link
                to="/contact"
                className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-primary-600 bg-white hover:bg-primary-50 transition-colors duration-200"
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
