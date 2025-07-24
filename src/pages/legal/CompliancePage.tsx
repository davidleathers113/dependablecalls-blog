import {
  ShieldCheckIcon,
  LockClosedIcon,
  CheckCircleIcon,
  DocumentTextIcon,
} from '@/components/icons'

const certifications = [
  {
    icon: ShieldCheckIcon,
    title: 'SOC 2 Type II Certified',
    description:
      'Our systems and processes are audited annually to ensure the highest standards of security and availability.',
  },
  {
    icon: LockClosedIcon,
    title: 'PCI DSS Compliant',
    description:
      'We maintain PCI compliance for secure payment processing and protection of financial data.',
  },
  {
    icon: CheckCircleIcon,
    title: 'TCPA Compliant',
    description:
      'Our platform helps ensure compliance with Telephone Consumer Protection Act regulations.',
  },
  {
    icon: DocumentTextIcon,
    title: 'GDPR & CCPA Ready',
    description:
      'We support data privacy requirements under GDPR and California Consumer Privacy Act.',
  },
]

const regulations = [
  {
    title: 'FCC Regulations',
    items: [
      'Compliance with robocall mitigation requirements',
      'STIR/SHAKEN implementation for call authentication',
      'Adherence to Do Not Call Registry requirements',
      'Regular compliance audits and reporting',
    ],
  },
  {
    title: 'State Regulations',
    items: [
      'State-specific telemarketing laws compliance',
      'Licensing requirements for different jurisdictions',
      'Time-of-day calling restrictions',
      'Industry-specific regulations (insurance, finance, etc.)',
    ],
  },
  {
    title: 'Data Protection',
    items: [
      'End-to-end encryption for sensitive data',
      'Regular security assessments and penetration testing',
      'Data retention and deletion policies',
      'Employee security training and background checks',
    ],
  },
]

export default function CompliancePage() {
  return (
    <div className="bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Compliance & Security</h1>
          <p className="text-xl text-gray-500 max-w-3xl mx-auto">
            DependableCalls maintains the highest standards of compliance and security to protect
            our partners and ensure regulatory adherence across all operations.
          </p>
        </div>

        {/* Certifications */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">Our Certifications</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {certifications.map((cert, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-6 flex items-start">
                <cert.icon className="h-12 w-12 text-primary-600 flex-shrink-0" />
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{cert.title}</h3>
                  <p className="text-gray-600">{cert.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Regulatory Compliance */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">
            Regulatory Compliance
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {regulations.map((reg, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">{reg.title}</h3>
                <ul className="space-y-2">
                  {reg.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="ml-2 text-gray-600">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Security Measures */}
        <section className="mb-16">
          <div className="bg-primary-50 rounded-lg p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Security Infrastructure</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Technical Security</h3>
                <ul className="space-y-2 text-gray-600">
                  <li>• 256-bit SSL encryption for all data transmission</li>
                  <li>• Multi-factor authentication for all accounts</li>
                  <li>• Real-time threat monitoring and response</li>
                  <li>• Regular security updates and patches</li>
                  <li>• Secure API endpoints with rate limiting</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Operational Security</h3>
                <ul className="space-y-2 text-gray-600">
                  <li>• 24/7 security operations center</li>
                  <li>• Incident response team and protocols</li>
                  <li>• Regular third-party security audits</li>
                  <li>• Comprehensive disaster recovery plan</li>
                  <li>• Strict access controls and monitoring</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Fraud Prevention */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">Fraud Prevention</h2>
          <div className="bg-white border border-gray-200 rounded-lg p-8">
            <p className="text-lg text-gray-600 mb-6">
              Our advanced fraud detection system uses machine learning and real-time analysis to
              protect all parties:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ul className="space-y-3">
                <li className="flex items-start">
                  <span className="text-primary-600 font-bold mr-2">•</span>
                  <span>Real-time call analysis and scoring</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary-600 font-bold mr-2">•</span>
                  <span>Duplicate and repeat caller detection</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary-600 font-bold mr-2">•</span>
                  <span>Geographic and demographic verification</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary-600 font-bold mr-2">•</span>
                  <span>Voice pattern and audio analysis</span>
                </li>
              </ul>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <span className="text-primary-600 font-bold mr-2">•</span>
                  <span>Network traffic pattern monitoring</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary-600 font-bold mr-2">•</span>
                  <span>Automated blocking of suspicious sources</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary-600 font-bold mr-2">•</span>
                  <span>Manual review processes for edge cases</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary-600 font-bold mr-2">•</span>
                  <span>Continuous model improvement and updates</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section className="text-center">
          <div className="bg-gray-50 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Questions About Compliance?</h2>
            <p className="text-lg text-gray-600 mb-6">
              Our compliance team is here to help with any questions about our security measures,
              certifications, or regulatory adherence.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/contact"
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
              >
                Contact Compliance Team
              </a>
              <a
                href="mailto:compliance@dependablecalls.com"
                className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                compliance@dependablecalls.com
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
