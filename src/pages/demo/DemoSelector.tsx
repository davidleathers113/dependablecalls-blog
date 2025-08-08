/**
 * Demo Selector Page
 * 
 * Allows users to choose which type of dashboard they want to preview.
 * Provides clear descriptions of each user type and their features.
 * 
 * This is the landing page for demo mode, accessible via "Try Demo" button.
 */

import { Link } from 'react-router-dom'
import { usePageTitle } from '../../hooks/usePageTitle'
import {
  UserIcon,
  ShoppingCartIcon,
  CogIcon,
  GlobeAltIcon,
  ArrowRightIcon,
  EyeIcon
} from '@heroicons/react/24/outline'

const demoOptions = [
  {
    id: 'supplier',
    title: 'Traffic Supplier',
    description: 'Generate and send high-quality calls to advertisers',
    features: [
      'Campaign management and optimization',
      'Real-time call tracking and analytics',
      'Quality score monitoring',
      'Payout tracking and reporting'
    ],
    icon: UserIcon,
    color: 'blue',
    route: '/demo/supplier'
  },
  {
    id: 'buyer',
    title: 'Media Buyer',
    description: 'Purchase qualified calls and leads for your business',
    features: [
      'Campaign creation and budgeting',
      'Lead quality filtering',
      'Performance analytics',
      'ROI optimization tools'
    ],
    icon: ShoppingCartIcon,
    color: 'green',
    route: '/demo/buyer'
  },
  {
    id: 'admin',
    title: 'Platform Administrator',
    description: 'Manage the entire platform and oversee operations',
    features: [
      'User and campaign management',
      'System monitoring and health',
      'Fraud detection and prevention',
      'Financial reporting and payouts'
    ],
    icon: CogIcon,
    color: 'purple',
    route: '/demo/admin'
  },
  {
    id: 'network',
    title: 'Network Operator',
    description: 'Oversee network performance and relationships',
    features: [
      'Network-wide analytics',
      'Partner relationship management',
      'Traffic flow optimization',
      'Revenue and growth tracking'
    ],
    icon: GlobeAltIcon,
    color: 'indigo',
    route: '/demo/network'
  }
]

export default function DemoSelector() {
  usePageTitle('Try Demo - Choose Your Experience')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-3">
                  <EyeIcon className="h-8 w-8 text-primary-600" />
                  <h1 className="text-2xl font-bold text-gray-900">
                    Platform Demo
                  </h1>
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  Explore the DCE platform from different user perspectives
                </p>
              </div>
              <div className="flex space-x-3">
                <Link
                  to="/login"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Demo Options */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Choose Your Demo Experience
          </h2>
          <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
            See the DCE platform from different user perspectives. Each demo showcases 
            real features with sample data - no registration required.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {demoOptions.map((option) => {
            const IconComponent = option.icon
            const colorClasses = {
              blue: 'bg-blue-500 text-white group-hover:bg-blue-600',
              green: 'bg-green-500 text-white group-hover:bg-green-600',
              purple: 'bg-purple-500 text-white group-hover:bg-purple-600',
              indigo: 'bg-indigo-500 text-white group-hover:bg-indigo-600'
            }

            return (
              <Link
                key={option.id}
                to={option.route}
                className="group relative bg-white p-6 rounded-lg shadow-md hover:shadow-lg border border-gray-200 transition-all duration-200 hover:-translate-y-1"
              >
                {/* Icon */}
                <div className="flex items-center mb-4">
                  <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${colorClasses[option.color as keyof typeof colorClasses]}`}>
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-xl font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                      {option.title}
                    </h3>
                  </div>
                </div>

                {/* Description */}
                <p className="text-gray-600 mb-4">
                  {option.description}
                </p>

                {/* Features */}
                <ul className="space-y-2 mb-6">
                  {option.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary-500 mt-2"></div>
                      <span className="ml-3 text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="flex items-center text-primary-600 font-medium group-hover:text-primary-700 transition-colors">
                  <span>Try {option.title} Demo</span>
                  <ArrowRightIcon className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            )
          })}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center bg-white rounded-lg p-8 shadow-sm border border-gray-200">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Ready to get started for real?
          </h3>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            These demos show you exactly what you'll get with a real DCE account. 
            Join thousands of performance marketers already using our platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Create Free Account
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}