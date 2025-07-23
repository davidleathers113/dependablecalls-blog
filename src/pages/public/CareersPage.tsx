import { Link } from 'react-router-dom'
import { BriefcaseIcon, MapPinIcon, CurrencyDollarIcon, ClockIcon } from '@heroicons/react/24/outline'

const jobOpenings = [
  {
    id: 1,
    title: 'Senior Full Stack Developer',
    department: 'Engineering',
    location: 'San Francisco, CA (Remote OK)',
    type: 'Full-time',
    salary: '$140k - $180k',
    description: 'We are looking for an experienced full stack developer to help build and scale our platform.',
    requirements: [
      '5+ years of experience with React and Node.js',
      'Strong understanding of database design and optimization',
      'Experience with real-time systems and WebSockets',
      'Knowledge of fraud detection systems is a plus',
    ],
  },
  {
    id: 2,
    title: 'Account Manager',
    department: 'Sales',
    location: 'Los Angeles, CA',
    type: 'Full-time',
    salary: '$70k - $90k + Commission',
    description: 'Join our sales team to manage and grow relationships with key advertisers and traffic partners.',
    requirements: [
      '3+ years of account management experience',
      'Experience in digital marketing or pay-per-call industry',
      'Strong communication and negotiation skills',
      'Ability to manage multiple client relationships',
    ],
  },
  {
    id: 3,
    title: 'Data Analyst',
    department: 'Analytics',
    location: 'Remote',
    type: 'Full-time',
    salary: '$90k - $120k',
    description: 'Help us make data-driven decisions by analyzing campaign performance and identifying trends.',
    requirements: [
      'Strong SQL and data visualization skills',
      'Experience with Python or R for data analysis',
      'Understanding of digital marketing metrics',
      'Ability to communicate insights to non-technical stakeholders',
    ],
  },
]

const benefits = [
  {
    title: 'Health & Wellness',
    items: ['100% covered health insurance', 'Dental and vision coverage', 'Mental health support', 'Gym membership reimbursement'],
  },
  {
    title: 'Work-Life Balance',
    items: ['Flexible working hours', 'Remote work options', 'Unlimited PTO policy', 'Paid parental leave'],
  },
  {
    title: 'Growth & Development',
    items: ['Learning & development budget', 'Conference attendance', 'Mentorship programs', 'Career advancement opportunities'],
  },
  {
    title: 'Compensation & Perks',
    items: ['Competitive salaries', 'Equity options', 'Performance bonuses', 'Company retreats'],
  },
]

export default function CareersPage() {
  return (
    <div className="bg-white">
      {/* Header */}
      <div className="bg-gray-50">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:py-16 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl">
              Join Our Team
            </h1>
            <p className="mt-4 text-xl text-gray-500 max-w-2xl mx-auto">
              Help us build the future of pay-per-call marketing. We're always looking for talented individuals to join our growing team.
            </p>
          </div>
        </div>
      </div>

      {/* Company Culture */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-gray-900">Why Work at DependableCalls?</h2>
          <p className="mt-4 text-lg text-gray-500 max-w-3xl mx-auto">
            We're a fast-growing company with a mission to revolutionize the pay-per-call industry. 
            Our team is passionate about building great products and delivering exceptional value to our partners.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {benefits.map((benefit, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{benefit.title}</h3>
              <ul className="space-y-2">
                {benefit.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span className="text-gray-600 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Open Positions */}
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 text-center mb-8">Open Positions</h2>
          <div className="space-y-6">
            {jobOpenings.map((job) => (
              <div key={job.id} className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{job.title}</h3>
                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
                        <div className="flex items-center">
                          <BriefcaseIcon className="h-4 w-4 mr-1" />
                          {job.department}
                        </div>
                        <div className="flex items-center">
                          <MapPinIcon className="h-4 w-4 mr-1" />
                          {job.location}
                        </div>
                        <div className="flex items-center">
                          <ClockIcon className="h-4 w-4 mr-1" />
                          {job.type}
                        </div>
                        <div className="flex items-center">
                          <CurrencyDollarIcon className="h-4 w-4 mr-1" />
                          {job.salary}
                        </div>
                      </div>
                    </div>
                    <Link
                      to="/contact"
                      className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm font-medium"
                    >
                      Apply Now
                    </Link>
                  </div>
                  <p className="mt-4 text-gray-600">{job.description}</p>
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Requirements:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {job.requirements.map((req, index) => (
                        <li key={index} className="text-sm text-gray-600">{req}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Application CTA */}
        <div className="mt-16 bg-primary-50 rounded-lg p-8 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Don't see a position that fits?
          </h3>
          <p className="text-lg text-gray-600 mb-6">
            We're always interested in meeting talented people. Send us your resume and let us know how you can contribute to our team.
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            Get in Touch
          </Link>
        </div>
      </div>
    </div>
  )
}