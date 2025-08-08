import { usePageTitle } from '../../hooks/usePageTitle'
import { Link } from 'react-router-dom'

export default function CookiePolicyPage() {
  usePageTitle('Cookie Policy')

  return (
    <div className="bg-white">
      <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="prose prose-lg max-w-none">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">Cookie Policy</h1>
          
          <p className="text-gray-600 mb-8">
            Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. What Are Cookies</h2>
            <p className="text-gray-700 mb-4">
              Cookies are small text files that are placed on your device when you visit our website. 
              They help us provide you with a better experience by remembering your preferences and 
              understanding how you use our platform.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. How We Use Cookies</h2>
            <p className="text-gray-700 mb-4">
              DependableCalls uses cookies for the following purposes:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><strong>Essential Cookies:</strong> Required for the website to function properly, including authentication and security features.</li>
              <li><strong>Performance Cookies:</strong> Help us understand how visitors interact with our website by collecting anonymous information.</li>
              <li><strong>Functionality Cookies:</strong> Remember your preferences and settings to provide a personalized experience.</li>
              <li><strong>Analytics Cookies:</strong> Allow us to measure and analyze website traffic to improve our services.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Types of Cookies We Use</h2>
            
            <div className="bg-gray-50 rounded-lg p-6 mb-4">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Session Cookies</h3>
              <p className="text-gray-700">
                Temporary cookies that are deleted when you close your browser. These are essential for 
                navigating our website and using its features.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 mb-4">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Persistent Cookies</h3>
              <p className="text-gray-700">
                Cookies that remain on your device for a set period or until you delete them. These help us 
                recognize you when you return to our website.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 mb-4">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Third-Party Cookies</h3>
              <p className="text-gray-700">
                Cookies set by third-party services we use, including:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Stripe for payment processing</li>
                <li>Supabase for authentication</li>
                <li>Analytics providers for website insights</li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Your Cookie Choices</h2>
            <p className="text-gray-700 mb-4">
              You have several options for managing cookies:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><strong>Browser Settings:</strong> Most browsers allow you to refuse cookies or delete cookies. Please refer to your browser's help section for instructions.</li>
              <li><strong>Essential Cookies:</strong> Please note that blocking essential cookies may prevent you from using certain features of our platform.</li>
              <li><strong>Opt-Out Links:</strong> You can opt out of third-party analytics cookies through their respective opt-out mechanisms.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Cookie List</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cookie Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Purpose
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      sb-access-token
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      Authentication token for secure access
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      Session
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      sb-refresh-token
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      Token refresh for extended sessions
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      7 days
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      user-preferences
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      Stores user interface preferences
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      1 year
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      _stripe_mid
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      Stripe fraud prevention
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      1 year
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Updates to This Policy</h2>
            <p className="text-gray-700 mb-4">
              We may update this Cookie Policy from time to time. We will notify you of any changes by 
              posting the new policy on this page and updating the "Last Updated" date.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Contact Us</h2>
            <p className="text-gray-700 mb-4">
              If you have questions about our Cookie Policy, please contact us at:
            </p>
            <div className="bg-gray-50 rounded-lg p-6">
              <p className="text-gray-700">
                <strong>DependableCalls</strong><br />
                Email: privacy@dependablecalls.com<br />
                Phone: 1-800-CALLS-US<br />
                Address: 123 Business Ave, Suite 100, San Francisco, CA 94107
              </p>
            </div>
          </section>

          <div className="mt-12 pt-8 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4">
              <Link 
                to="/privacy" 
                className="inline-flex items-center text-primary-600 hover:text-primary-700 font-medium"
              >
                View Privacy Policy →
              </Link>
              <Link 
                to="/terms" 
                className="inline-flex items-center text-primary-600 hover:text-primary-700 font-medium"
              >
                View Terms of Service →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}