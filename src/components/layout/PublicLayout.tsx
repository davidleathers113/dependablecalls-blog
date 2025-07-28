import { Outlet, Link } from 'react-router-dom'
import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { navigateToHomeSection } from '../../utils/navigation'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import ErrorBoundary from '../common/ErrorBoundary'
import { PublicLayoutFallbackUI } from '../common/FallbackUI'
import { Logo } from '../common/Logo'

// Social media links
const socialLinks = [
  {
    name: 'Facebook',
    href: 'https://facebook.com/dependablecalls',
    icon: (props: React.SVGProps<SVGSVGElement>) => (
      <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
        <path
          fillRule="evenodd"
          d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  {
    name: 'Twitter',
    href: 'https://twitter.com/dependablecalls',
    icon: (props: React.SVGProps<SVGSVGElement>) => (
      <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
        <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
      </svg>
    ),
  },
  {
    name: 'LinkedIn',
    href: 'https://linkedin.com/company/dependablecalls',
    icon: (props: React.SVGProps<SVGSVGElement>) => (
      <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
        <path
          fillRule="evenodd"
          d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  {
    name: 'YouTube',
    href: 'https://youtube.com/dependablecalls',
    icon: (props: React.SVGProps<SVGSVGElement>) => (
      <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
        <path
          fillRule="evenodd"
          d="M19.812 5.418c.861.23 1.538.907 1.768 1.768C21.998 8.746 22 12 22 12s0 3.255-.418 4.814a2.504 2.504 0 0 1-1.768 1.768c-1.56.419-7.814.419-7.814.419s-6.255 0-7.814-.419a2.505 2.505 0 0 1-1.768-1.768C2 15.255 2 12 2 12s0-3.255.417-4.814a2.507 2.507 0 0 1 1.768-1.768C5.744 5 11.998 5 11.998 5s6.255 0 7.814.418ZM15.194 12 10 15V9l5.194 3Z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
]

export default function PublicLayout() {
  const { user } = useAuthStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="bg-gray-50">
      {/* Skip to main content link for keyboard navigation */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 bg-primary-600 text-white px-6 py-3 z-50 rounded-br-md"
      >
        Skip to main content
      </a>
      {/* Navigation */}
      <nav className="bg-white shadow-sm flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/" className="py-2 inline-block min-h-[44px] flex items-center group">
                <Logo variant="default" />
              </Link>
            </div>

            <div className="hidden md:flex items-center space-x-4">
              <button
                onClick={() => navigateToHomeSection('features')}
                className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium cursor-pointer min-h-[44px] flex items-center"
              >
                Features
              </button>
              <button
                onClick={() => navigateToHomeSection('about')}
                className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium cursor-pointer min-h-[44px] flex items-center"
              >
                About
              </button>
              <Link
                to="/blog"
                className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium min-h-[44px] inline-flex items-center"
              >
                Blog
              </Link>

              {user ? (
                <Link
                  to="/app/dashboard"
                  className="bg-primary-600 text-white hover:bg-primary-700 px-4 py-2 rounded-md text-sm font-medium min-h-[44px] inline-flex items-center"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium min-h-[44px] inline-flex items-center"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="bg-primary-600 text-white hover:bg-primary-700 px-4 py-2 rounded-md text-sm font-medium min-h-[44px] inline-flex items-center"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-gray-700 hover:text-primary-600 p-2 rounded-md min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Toggle mobile menu"
              >
                {mobileMenuOpen ? (
                  <XMarkIcon className="h-6 w-6" />
                ) : (
                  <Bars3Icon className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-200">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <button
                onClick={() => {
                  navigateToHomeSection('features')
                  setMobileMenuOpen(false)
                }}
                className="block w-full text-left text-gray-700 hover:text-primary-600 hover:bg-gray-50 px-3 py-3 rounded-md text-base font-medium transition-colors min-h-[44px]"
              >
                Features
              </button>
              <button
                onClick={() => {
                  navigateToHomeSection('about')
                  setMobileMenuOpen(false)
                }}
                className="block w-full text-left text-gray-700 hover:text-primary-600 hover:bg-gray-50 px-3 py-3 rounded-md text-base font-medium transition-colors min-h-[44px]"
              >
                About
              </button>
              <Link
                to="/blog"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-gray-700 hover:text-primary-600 hover:bg-gray-50 px-3 py-3 rounded-md text-base font-medium transition-colors min-h-[44px]"
              >
                Blog
              </Link>

              {user ? (
                <Link
                  to="/app/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block bg-primary-600 text-white hover:bg-primary-700 px-3 py-3 rounded-md text-base font-medium transition-colors min-h-[44px]"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block text-gray-700 hover:text-primary-600 hover:bg-gray-50 px-3 py-3 rounded-md text-base font-medium transition-colors min-h-[44px]"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block bg-primary-600 text-white hover:bg-primary-700 px-3 py-3 rounded-md text-base font-medium transition-colors min-h-[44px]"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main id="main-content">
        <ErrorBoundary context="PublicLayout - Main Content" fallback={<PublicLayoutFallbackUI />}>
          <Outlet />
        </ErrorBoundary>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="mb-4">
                <Logo variant="white" size="lg" />
              </div>
              <p className="text-gray-400">
                The most trusted pay-per-call network for quality lead generation.
              </p>
            </div>

            <div>
              <h4 className="text-lg font-semibold mb-4">Product</h4>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => navigateToHomeSection('features')}
                    className="text-gray-400 hover:text-white text-left py-2 px-1 -mx-1 inline-block min-h-[44px]"
                  >
                    Features
                  </button>
                </li>
                <li>
                  <Link to="/blog" className="text-gray-400 hover:text-white py-2 px-1 -mx-1 inline-block min-h-[44px]">
                    Blog
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-semibold mb-4">Company</h4>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => navigateToHomeSection('about')}
                    className="text-gray-400 hover:text-white text-left py-2 px-1 -mx-1 inline-block min-h-[44px]"
                  >
                    About Us
                  </button>
                </li>
                <li>
                  <Link to="/contact" className="text-gray-400 hover:text-white py-2 px-1 -mx-1 inline-block min-h-[44px]">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link to="/careers" className="text-gray-400 hover:text-white py-2 px-1 -mx-1 inline-block min-h-[44px]">
                    Careers
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-semibold mb-4">Legal</h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/privacy" className="text-gray-400 hover:text-white py-2 px-1 -mx-1 inline-block min-h-[44px]">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="text-gray-400 hover:text-white py-2 px-1 -mx-1 inline-block min-h-[44px]">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link to="/compliance" className="text-gray-400 hover:text-white py-2 px-1 -mx-1 inline-block min-h-[44px]">
                    Compliance
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-700">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center">
              <div className="flex justify-center space-x-6 md:order-2">
                {socialLinks.map((item) => (
                  <a
                    key={item.name}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white transition-colors duration-200 p-2 -m-2 inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded"
                    aria-label={`Visit ${item.name}`}
                  >
                    <item.icon className="h-6 w-6" aria-hidden="true" />
                  </a>
                ))}
              </div>
              <div className="mt-8 md:mt-0 md:order-1">
                <p className="text-center md:text-left text-gray-400">
                  &copy; {new Date().getFullYear()} DependableCalls. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
