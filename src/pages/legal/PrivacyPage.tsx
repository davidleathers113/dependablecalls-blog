export default function PrivacyPage() {
  return (
    <div className="bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-8">Privacy Policy</h1>
        
        <div className="prose prose-lg text-gray-600 max-w-none">
          <p className="text-sm text-gray-500 mb-8">Last updated: January 20, 2025</p>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Introduction</h2>
            <p>
              DependableCalls ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, 
              use, disclose, and safeguard your information when you use our pay-per-call platform and related services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Information We Collect</h2>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Personal Information</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>Name and contact information (email, phone number, address)</li>
              <li>Business information (company name, role, industry)</li>
              <li>Payment and billing information</li>
              <li>Account credentials</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-2">Call Data</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>Call recordings and transcriptions</li>
              <li>Caller phone numbers and geographic data</li>
              <li>Call duration and quality metrics</li>
              <li>Campaign performance data</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-2">Technical Information</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>IP addresses and device information</li>
              <li>Browser type and operating system</li>
              <li>Usage data and analytics</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3. How We Use Your Information</h2>
            <p className="mb-4">We use the collected information for various purposes:</p>
            <ul className="list-disc pl-6">
              <li>To provide and maintain our services</li>
              <li>To process transactions and manage billing</li>
              <li>To detect and prevent fraud</li>
              <li>To improve our platform and user experience</li>
              <li>To communicate with you about services and updates</li>
              <li>To comply with legal obligations</li>
              <li>To protect our rights and the rights of our users</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Information Sharing and Disclosure</h2>
            <p className="mb-4">We may share your information in the following circumstances:</p>
            <ul className="list-disc pl-6">
              <li>With your consent or at your direction</li>
              <li>With our service providers and business partners</li>
              <li>To comply with legal requirements or respond to legal process</li>
              <li>To protect our rights, property, or safety</li>
              <li>In connection with a business transaction (merger, acquisition, etc.)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your information against unauthorized access, 
              alteration, disclosure, or destruction. These measures include encryption, access controls, and regular security audits.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Your Rights and Choices</h2>
            <p className="mb-4">You have certain rights regarding your personal information:</p>
            <ul className="list-disc pl-6">
              <li>Access and receive a copy of your data</li>
              <li>Update or correct inaccurate information</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict certain processing</li>
              <li>Data portability</li>
              <li>Withdraw consent</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Cookies and Tracking</h2>
            <p>
              We use cookies and similar tracking technologies to improve your experience on our platform. You can control cookie 
              preferences through your browser settings, though some features may not function properly without cookies.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Third-Party Links</h2>
            <p>
              Our services may contain links to third-party websites. We are not responsible for the privacy practices of these 
              external sites and encourage you to review their privacy policies.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Children's Privacy</h2>
            <p>
              Our services are not intended for individuals under the age of 18. We do not knowingly collect personal information 
              from children.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy 
              Policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Contact Us</h2>
            <p>If you have questions about this Privacy Policy, please contact us at:</p>
            <div className="mt-4 bg-gray-50 p-4 rounded-lg">
              <p className="font-semibold">DependableCalls</p>
              <p>Email: privacy@dependablecalls.com</p>
              <p>Phone: +1 (555) 123-4567</p>
              <p>Address: 123 Business Center, Suite 400, San Francisco, CA 94105</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}