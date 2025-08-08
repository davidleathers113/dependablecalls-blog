import { usePageTitle } from '../../hooks/usePageTitle'
import { Link } from 'react-router-dom'

export default function TermsPage() {
  usePageTitle('Terms of Service')

  return (
    <div className="bg-white">
      <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="prose prose-lg max-w-none">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">Terms of Service</h1>
          
          <p className="text-gray-600 mb-8">
            Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Agreement to Terms</h2>
            <p className="text-gray-700 mb-4">
              By accessing or using the DependableCalls platform ("Service"), you agree to be bound
              by these Terms of Service ("Terms"). If you disagree with any part of these terms, you
              may not access the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Description of Service</h2>
            <p className="text-gray-700 mb-4">
              DependableCalls provides a pay-per-call platform that connects traffic suppliers with
              advertisers. Our Service includes call tracking, routing, fraud detection, analytics,
              and payment processing for qualifying phone calls.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. User Accounts</h2>
            
            <div className="bg-gray-50 rounded-lg p-6 mb-4">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Account Registration</h3>
              <ul className="list-disc pl-6 text-gray-700 space-y-1">
                <li>You must provide accurate, current, and complete information</li>
                <li>You are responsible for maintaining account security</li>
                <li>You must notify us immediately of any unauthorized access</li>
                <li>One person or entity may not maintain multiple accounts</li>
              </ul>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 mb-4">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Account Types</h3>
              <ul className="list-disc pl-6 text-gray-700 space-y-1">
                <li>
                  <strong>Suppliers:</strong> Traffic providers sending calls to the platform
                </li>
                <li>
                  <strong>Buyers:</strong> Advertisers receiving and paying for qualified calls
                </li>
                <li>
                  <strong>Admin:</strong> Platform administrators with full access
                </li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Acceptable Use</h2>
            <p className="text-gray-700 mb-4">You agree not to:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Violate any laws or regulations</li>
              <li>Submit fraudulent or misleading information</li>
              <li>Generate artificial or fraudulent calls</li>
              <li>Interfere with or disrupt the Service</li>
              <li>Attempt to gain unauthorized access to any systems</li>
              <li>Use the Service for any illegal or unauthorized purpose</li>
              <li>Violate the intellectual property rights of others</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Payment Terms</h2>
            
            <div className="bg-gray-50 rounded-lg p-6 mb-4">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">For Buyers</h3>
              <ul className="list-disc pl-6 text-gray-700 space-y-1">
                <li>Payment is due for all qualified calls as determined by our system</li>
                <li>Prices are set per campaign and may vary</li>
                <li>Invoices are generated weekly/monthly based on your agreement</li>
                <li>Late payments may result in service suspension</li>
              </ul>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 mb-4">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">For Suppliers</h3>
              <ul className="list-disc pl-6 text-gray-700 space-y-1">
                <li>Payments are made for qualified calls only</li>
                <li>Payout schedules vary (daily, weekly, or monthly)</li>
                <li>Minimum payout thresholds may apply</li>
                <li>We reserve the right to withhold payment for fraudulent activity</li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Call Quality and Fraud</h2>
            <p className="text-gray-700 mb-4">
              We employ advanced fraud detection systems to ensure call quality. We reserve the
              right to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Reject calls that don't meet quality standards</li>
              <li>Investigate suspicious activity</li>
              <li>Suspend or terminate accounts engaged in fraud</li>
              <li>Withhold payments for fraudulent calls</li>
              <li>Report illegal activities to law enforcement</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Intellectual Property</h2>
            <p className="text-gray-700 mb-4">
              The Service and its original content, features, and functionality are owned by
              DependableCalls and are protected by international copyright, trademark, patent, trade
              secret, and other intellectual property laws.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              8. Privacy and Data Protection
            </h2>
            <p className="text-gray-700 mb-4">
              Your use of the Service is also governed by our <Link to="/privacy" className="text-primary-600 hover:text-primary-700 font-medium">Privacy Policy</Link>. By using the Service,
              you consent to the collection and use of information as detailed in the Privacy
              Policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              9. Disclaimers and Limitations
            </h2>
            
            <div className="bg-gray-50 rounded-lg p-6 mb-4">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Service Availability</h3>
              <p className="text-gray-700">
                The Service is provided "as is" and "as available" without warranties of any kind. We
                do not guarantee uninterrupted or error-free operation of the Service.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 mb-4">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Limitation of Liability</h3>
              <p className="text-gray-700">
                To the maximum extent permitted by law, DependableCalls shall not be liable for any
                indirect, incidental, special, consequential, or punitive damages resulting from your
                use of the Service.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Indemnification</h2>
            <p className="text-gray-700 mb-4">
              You agree to indemnify and hold harmless DependableCalls, its officers, directors,
              employees, and agents from any claims, damages, losses, liabilities, and expenses
              arising from your use of the Service or violation of these Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Termination</h2>
            <p className="text-gray-700 mb-4">
              We may terminate or suspend your account immediately, without prior notice or
              liability, for any reason, including breach of these Terms. Upon termination, your
              right to use the Service will cease immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Governing Law</h2>
            <p className="text-gray-700 mb-4">
              These Terms shall be governed by and construed in accordance with the laws of
              California, United States, without regard to its conflict of law provisions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Changes to Terms</h2>
            <p className="text-gray-700 mb-4">
              We reserve the right to modify or replace these Terms at any time. If a revision is
              material, we will provide at least 30 days notice prior to any new terms taking
              effect.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">14. Contact Information</h2>
            <p className="text-gray-700 mb-4">If you have any questions about these Terms, please contact us at:</p>
            <div className="bg-gray-50 rounded-lg p-6">
              <p className="text-gray-700">
                <strong>DependableCalls Legal Department</strong><br />
                Email: legal@dependablecalls.com<br />
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
                to="/cookies" 
                className="inline-flex items-center text-primary-600 hover:text-primary-700 font-medium"
              >
                View Cookie Policy →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
