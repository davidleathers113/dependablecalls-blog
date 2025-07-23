import {
  PhoneIcon,
  ChartBarIcon,
  UsersIcon,
  ShieldCheckIcon,
  CurrencyDollarIcon,
  BoltIcon,
} from '@heroicons/react/24/outline'

const values = [
  {
    name: 'Transparency',
    description: 'Complete visibility into all call metrics, pricing, and performance data.',
    icon: ChartBarIcon,
  },
  {
    name: 'Reliability',
    description: '99.9% uptime SLA with redundant systems and 24/7 monitoring.',
    icon: BoltIcon,
  },
  {
    name: 'Security',
    description: 'Industry-leading fraud detection and data protection standards.',
    icon: ShieldCheckIcon,
  },
  {
    name: 'Partnership',
    description: 'We succeed when our clients succeed. Your growth is our priority.',
    icon: UsersIcon,
  },
]

const team = [
  {
    name: 'Sarah Johnson',
    role: 'CEO & Founder',
    experience: '15+ years in performance marketing and telecommunications',
  },
  {
    name: 'Michael Chen',
    role: 'CTO',
    experience: '12+ years building scalable call tracking platforms',
  },
  {
    name: 'Emily Rodriguez',
    role: 'VP of Sales',
    experience: '10+ years in affiliate marketing and lead generation',
  },
  {
    name: 'David Kim',
    role: 'Head of Fraud Prevention',
    experience: '8+ years in cybersecurity and machine learning',
  },
]

const milestones = [
  { year: '2020', event: 'Company founded with mission to eliminate call fraud' },
  { year: '2021', event: 'Processed first 1 million calls with 99.2% quality score' },
  { year: '2022', event: 'Launched real-time analytics dashboard and API' },
  { year: '2023', event: 'Expanded to international markets and multi-language support' },
  { year: '2024', event: 'Introduced AI-powered fraud detection and call scoring' },
]

export default function AboutPage() {
  return (
    <div>
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-800 text-white">
        <div className="max-w-7xl mx-auto px-4 py-24 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold sm:text-5xl md:text-6xl">
              About DependableCalls
            </h1>
            <p className="mt-6 text-xl max-w-3xl mx-auto">
              Since 2020, we've been the trusted partner for performance marketers seeking
              transparency, quality, and results in pay-per-call advertising.
            </p>
          </div>
        </div>
      </div>

      {/* Mission Section */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-base text-primary-600 font-semibold tracking-wide uppercase">
              Our Mission
            </h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Building trust in performance marketing
            </p>
          </div>

          <div className="mt-10">
            <div className="space-y-10 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-10">
              <div className="bg-primary-50 rounded-lg p-8">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-primary-500 text-white mb-4">
                  <PhoneIcon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Quality First</h3>
                <p className="mt-2 text-base text-gray-500">
                  Every call is monitored, scored, and verified to ensure you only pay for genuine,
                  high-intent leads that drive real business value.
                </p>
              </div>

              <div className="bg-primary-50 rounded-lg p-8">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-primary-500 text-white mb-4">
                  <CurrencyDollarIcon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Fair Pricing</h3>
                <p className="mt-2 text-base text-gray-500">
                  Transparent pricing with no hidden fees. You see exactly what you're paying for
                  and can track ROI in real-time across all campaigns.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Values Section */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-base text-primary-600 font-semibold tracking-wide uppercase">
              Our Values
            </h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              What drives us every day
            </p>
          </div>

          <div className="mt-10">
            <div className="space-y-10 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-x-8 md:gap-y-10">
              {values.map((value) => (
                <div key={value.name} className="text-center">
                  <div className="flex items-center justify-center h-12 w-12 rounded-md bg-primary-500 text-white mx-auto">
                    <value.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-medium text-gray-900">{value.name}</h3>
                  <p className="mt-2 text-base text-gray-500">{value.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Section */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-base text-primary-600 font-semibold tracking-wide uppercase">
              Our Journey
            </h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Key milestones
            </p>
          </div>

          <div className="mt-10">
            <div className="space-y-8">
              {milestones.map((milestone) => (
                <div key={milestone.year} className="flex">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary-500 text-white font-semibold">
                      {milestone.year}
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="text-lg font-medium text-gray-900">{milestone.year}</div>
                    <div className="mt-1 text-base text-gray-500">{milestone.event}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Team Section */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-base text-primary-600 font-semibold tracking-wide uppercase">
              Leadership Team
            </h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Industry experts you can trust
            </p>
          </div>

          <div className="mt-10">
            <div className="space-y-8 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-8">
              {team.map((member) => (
                <div key={member.name} className="bg-white rounded-lg shadow-sm p-6">
                  <div className="text-center">
                    <div className="h-20 w-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <span className="text-white font-bold text-xl">
                        {member.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </span>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">{member.name}</h3>
                    <p className="text-sm text-primary-600 font-semibold">{member.role}</p>
                    <p className="mt-2 text-sm text-gray-500">{member.experience}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-16 bg-primary-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl">By the numbers</h2>
            <p className="mt-4 text-xl text-primary-200">Our track record speaks for itself</p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="text-center">
              <p className="text-4xl font-extrabold text-white">$50M+</p>
              <p className="mt-2 text-base text-primary-200">Revenue Generated</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-extrabold text-white">2.5M+</p>
              <p className="mt-2 text-base text-primary-200">Calls Per Month</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-extrabold text-white">94%</p>
              <p className="mt-2 text-base text-primary-200">Average Quality Score</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-extrabold text-white">99.9%</p>
              <p className="mt-2 text-base text-primary-200">Uptime SLA</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:py-16 lg:px-8 lg:flex lg:items-center lg:justify-between">
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            <span className="block">Ready to work with us?</span>
            <span className="block text-primary-600">Let's discuss your needs.</span>
          </h2>
          <div className="mt-8 flex lg:mt-0 lg:flex-shrink-0">
            <div className="inline-flex rounded-md shadow">
              <a
                href="/contact"
                className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
              >
                Contact us
              </a>
            </div>
            <div className="ml-3 inline-flex rounded-md shadow">
              <a
                href="/register"
                className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-primary-600 bg-white hover:bg-primary-50"
              >
                Get started
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
