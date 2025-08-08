import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider, QueryErrorResetBoundary } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { ErrorBoundary } from 'react-error-boundary'
import { ErrorBoundary as CustomErrorBoundary } from './components/common/ErrorBoundary'
import { UnauthorizedError } from './components/common/FallbackUI'
import React, { useEffect, Suspense, startTransition } from 'react'
import { useAuthStore } from './store/authStore'
import { captureError } from './lib/monitoring'
import { QueryErrorFallback } from './components/ui/QueryErrorFallback'
import { CSPProvider } from './lib/CSPProvider'
import { ServiceWorkerProvider, UpdatePrompt, OfflineIndicator } from './components/performance/ServiceWorkerProvider'
import { performanceMonitor, useCriticalPreload } from './components/performance'
// // import { useReducedMotion } from './hooks/useReducedMotion' // Removed for build

// Navigator interface with connection property for network information
interface NavigatorWithConnection extends Navigator {
  connection?: {
    effectiveType?: string
  }
}

// Layouts - Keep these eager as they're used on every route
import PublicLayout from './components/layout/PublicLayout'
import AppLayout from './components/layout/AppLayout'

// Lazy load all pages for code splitting with magic comments for optimal loading
// Public Pages - Prefetch for better UX on navigation
const HomePage = React.lazy(() => 
  import(/* webpackPrefetch: true, webpackChunkName: "home" */ './pages/public/HomePage')
)
const ContactPage = React.lazy(() => 
  import(/* webpackPrefetch: true, webpackChunkName: "contact" */ './pages/public/ContactPage')
)
const CareersPage = React.lazy(() => 
  import(/* webpackChunkName: "careers" */ './pages/public/CareersPage')
)
const AboutPage = React.lazy(() => 
  import(/* webpackPrefetch: true, webpackChunkName: "about" */ './pages/public/AboutPage')
)

// Auth Pages - Preload critical auth flows
const LoginPage = React.lazy(() => 
  import(/* webpackPreload: true, webpackChunkName: "login" */ './pages/auth/LoginPage')
)
const RegisterPage = React.lazy(() => 
  import(/* webpackPreload: true, webpackChunkName: "register" */ './pages/auth/RegisterPage')
)
const ForgotPasswordPage = React.lazy(() => 
  import(/* webpackChunkName: "forgot-password" */ './pages/auth/ForgotPasswordPage')
)
const AuthCallbackPage = React.lazy(() => 
  import(/* webpackChunkName: "auth-callback" */ './pages/auth/AuthCallbackPage')
)

// Legal Pages - Low priority
const PrivacyPage = React.lazy(() => 
  import(/* webpackChunkName: "privacy" */ './pages/legal/PrivacyPage')
)
const TermsPage = React.lazy(() => 
  import(/* webpackChunkName: "terms" */ './pages/legal/TermsPage')
)
const CompliancePage = React.lazy(() => 
  import(/* webpackChunkName: "compliance" */ './pages/legal/CompliancePage')
)
const CookiePolicyPage = React.lazy(() => 
  import(/* webpackChunkName: "cookie-policy" */ './pages/legal/CookiePolicyPage')
)

// Alternative legal pages with user-friendly URLs
const PrivacyPolicyPage = React.lazy(() => 
  import(/* webpackChunkName: "privacy-policy" */ './pages/legal/PrivacyPolicyPage')
)
const TermsOfServicePage = React.lazy(() => 
  import(/* webpackChunkName: "terms-of-service" */ './pages/legal/TermsOfServicePage')
)

// Blog Pages
const BlogPage = React.lazy(() => 
  import(/* webpackPrefetch: true, webpackChunkName: "blog" */ './pages/public/BlogPage')
)
const BlogPostPage = React.lazy(() => 
  import(/* webpackPrefetch: true, webpackChunkName: "blog-post" */ './pages/public/BlogPostPage')
)
const BlogCategoryPage = React.lazy(() => 
  import(/* webpackChunkName: "blog-category" */ './pages/public/BlogCategoryPage')
)
const BlogAuthorPage = React.lazy(() => 
  import(/* webpackChunkName: "blog-author" */ './pages/public/BlogAuthorPage')
)

// Demo Pages
const DemoSelectorPage = React.lazy(() => 
  import(/* webpackChunkName: "demo-selector" */ './pages/demo/DemoSelector')
)
const DemoDashboardPage = React.lazy(() => 
  import(/* webpackChunkName: "demo-dashboard" */ './pages/demo/DemoDashboard')
)

// Development Demo Pages
const ErrorDemoPage = import.meta.env.DEV ? React.lazy(() => 
  import(/* webpackChunkName: "error-demo" */ './pages/ErrorDemo')
) : null

// Authenticated Pages - Preload dashboard, prefetch others
const DashboardPage = React.lazy(() => 
  import(/* webpackPreload: true, webpackChunkName: "dashboard" */ './pages/dashboard/DashboardPage')
)
const CampaignsPage = React.lazy(() => 
  import(/* webpackPrefetch: true, webpackChunkName: "campaigns" */ './pages/campaigns/CampaignsPage')
)
const CreateCampaignPage = React.lazy(() => 
  import(/* webpackChunkName: "create-campaign" */ './pages/campaigns/CreateCampaignPage')
)
const EditCampaignPage = React.lazy(() => 
  import(/* webpackChunkName: "edit-campaign" */ './pages/campaigns/EditCampaignPage')
)
const CallsPage = React.lazy(() => 
  import(/* webpackPrefetch: true, webpackChunkName: "calls" */ './pages/calls/CallsPage')
)
const ReportsPage = React.lazy(() => 
  import(/* webpackPrefetch: true, webpackChunkName: "reports" */ './pages/reports/ReportsPage')
)
const SettingsPage = React.lazy(() => 
  import(/* webpackPrefetch: true, webpackChunkName: "settings" */ './pages/settings/SettingsPage')
)

// Settings Pages - Common (prefetch on settings page visit)
const ProfileSettingsPage = React.lazy(() => 
  import(/* webpackChunkName: "settings-profile" */ './pages/settings/ProfileSettingsPage')
)
const NotificationSettingsPage = React.lazy(() => 
  import(/* webpackChunkName: "settings-notifications" */ './pages/settings/NotificationSettingsPage')
)
const SecuritySettingsPage = React.lazy(() => 
  import(/* webpackChunkName: "settings-security" */ './pages/settings/SecuritySettingsPage')
)
const AccountSettingsPage = React.lazy(() => 
  import(/* webpackChunkName: "settings-account" */ './pages/settings/AccountSettingsPage')
)

// Settings Pages - Supplier specific
const CallTrackingSettingsPage = React.lazy(() => 
  import(/* webpackChunkName: "settings-call-tracking" */ './pages/settings/CallTrackingSettingsPage')
)
const PayoutSettingsPage = React.lazy(() => 
  import(/* webpackChunkName: "settings-payouts" */ './pages/settings/PayoutSettingsPage')
)

// Settings Pages - Buyer specific
const CampaignDefaultsPage = React.lazy(() => 
  import(/* webpackChunkName: "settings-campaign-defaults" */ './pages/settings/CampaignDefaultsPage')
)
const BillingSettingsPage = React.lazy(() => 
  import(/* webpackChunkName: "settings-billing" */ './pages/settings/BillingSettingsPage')
)
const QualityStandardsPage = React.lazy(() => 
  import(/* webpackChunkName: "settings-quality" */ './pages/settings/QualityStandardsPage')
)

// Optimized loading component with skeleton animation
const PageLoader = React.memo(() => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="relative">
          {/* Main spinner */}
          <div className="inline-flex items-center justify-center w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          
          {/* Pulse animation overlay */}
          <div className="absolute inset-0 inline-flex items-center justify-center w-16 h-16 border-4 border-blue-200 rounded-full animate-pulse"></div>
        </div>
        
        <div className="mt-6 space-y-3">
          <p className="text-gray-700 font-medium">Loading...</p>
          
          {/* Skeleton text lines */}
          <div className="space-y-2">
            <div className="h-2 bg-gray-200 rounded animate-pulse mx-auto w-32"></div>
            <div className="h-2 bg-gray-200 rounded animate-pulse mx-auto w-24"></div>
          </div>
        </div>
      </div>
    </div>
  )
})

PageLoader.displayName = 'PageLoader'

// Optimized Protected Route Component with performance tracking
const ProtectedRoute = React.memo(({ children }: { children: React.ReactNode }) => {
  const { user, loading, isDemoMode } = useAuthStore()
  const renderStart = React.useRef(performance.now())

  // Track authentication check performance
  React.useEffect(() => {
    if (!loading) {
      const authCheckTime = performance.now() - renderStart.current
      performanceMonitor.trackComponentRender('AuthCheck', authCheckTime)
    }
  }, [loading])

  if (loading) {
    return <PageLoader />
  }

  // Allow access if user is authenticated OR in demo mode
  if (!user && !isDemoMode) {
    return <Navigate to="/login" replace />
  }

  return (
    <CustomErrorBoundary
      context={isDemoMode ? "DemoProtectedRoute" : "ProtectedRoute - Authentication"}
      fallback={<UnauthorizedError onGoHome={() => (window.location.href = '/')} />}
      onError={(error, errorInfo) => {
        // Log authentication-related errors
        captureError(error, {
          errorBoundary: isDemoMode ? 'demo-protected-route' : 'protected-route',
          componentStack: errorInfo.componentStack,
          context: isDemoMode ? 'demo-authentication' : 'authentication',
          user: user?.id || (isDemoMode ? 'demo-user' : 'unknown'),
        })
      }}
    >
      {children}
    </CustomErrorBoundary>
  )
})

ProtectedRoute.displayName = 'ProtectedRoute'

function App() {
  const { checkSession } = useAuthStore()
  
  // Preload critical resources
  useCriticalPreload([
    { href: '/assets/fonts/inter-var.woff2', options: { as: 'font', crossorigin: 'anonymous' } },
    { href: '/assets/images/logo.svg', options: { as: 'image' } }
  ])

  // Initialize session check with performance tracking
  useEffect(() => {
    const sessionStart = performance.now()
    
    startTransition(() => {
      checkSession().finally(() => {
        const sessionTime = performance.now() - sessionStart
        performanceMonitor.trackComponentRender('SessionCheck', sessionTime)
      })
    })
  }, [checkSession])

  // Enhanced resource error tracking with performance impact analysis
  useEffect(() => {
    const handleResourceError = (event: Event) => {
      if (event.target instanceof HTMLImageElement || 
          event.target instanceof HTMLScriptElement || 
          event.target instanceof HTMLLinkElement) {
        const target = event.target
        const resourceUrl = 
          target instanceof HTMLImageElement ? target.src :
          target instanceof HTMLScriptElement ? target.src :
          target instanceof HTMLLinkElement ? target.href : 'unknown'
        
        const errorDetails = {
          type: target.tagName.toLowerCase(),
          url: resourceUrl,
          message: 'Failed to load resource',
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          connectionType: (navigator as NavigatorWithConnection).connection?.effectiveType || 'unknown'
        }
        
        console.error('Resource loading error:', errorDetails)

        // Track performance impact
        performanceMonitor.trackComponentRender(`ResourceError-${errorDetails.type}`, 0)
        
        // Also capture in monitoring if available
        captureError(new Error(`Failed to load ${target.tagName.toLowerCase()}: ${resourceUrl}`), {
          errorBoundary: 'resource-loading',
          context: 'resource-error',
          resourceType: target.tagName.toLowerCase(),
          resourceUrl,
          ...errorDetails
        })
      }
    }

    // Performance monitoring for navigation timing
    const logNavigationTiming = () => {
      if ('performance' in window && window.performance.navigation) {
        const navTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        if (navTiming) {
          console.log('Navigation Performance:', {
            dns: navTiming.domainLookupEnd - navTiming.domainLookupStart,
            connect: navTiming.connectEnd - navTiming.connectStart,
            request: navTiming.responseStart - navTiming.requestStart,
            response: navTiming.responseEnd - navTiming.responseStart,
            domParsing: navTiming.domContentLoadedEventStart - navTiming.responseEnd,
            domReady: navTiming.domContentLoadedEventEnd - navTiming.domContentLoadedEventStart,
            loadComplete: navTiming.loadEventEnd - navTiming.loadEventStart
          })
        }
      }
    }

    window.addEventListener('error', handleResourceError, true)
    window.addEventListener('load', logNavigationTiming, { once: true })

    return () => {
      window.removeEventListener('error', handleResourceError, true)
      window.removeEventListener('load', logNavigationTiming)
    }
  }, [])
  
  // Memory usage monitoring in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const logMemoryUsage = () => {
        const memStats = performanceMonitor.getMemoryStats()
        if (memStats && memStats.usagePercent > 70) {
          console.warn('High memory usage detected:', memStats)
        }
      }
      
      const interval = setInterval(logMemoryUsage, 30000) // Check every 30s
      return () => clearInterval(interval)
    }
  }, [])

  return (
    <ServiceWorkerProvider enableUpdatePrompt={true}>
      <CSPProvider>
        <div className="min-h-screen flex flex-col">
          {/* Performance indicators */}
          <UpdatePrompt />
          <OfflineIndicator />
          
          <QueryClientProvider client={queryClient}>
            <QueryErrorResetBoundary>
              {({ reset }) => (
                <ErrorBoundary
                  FallbackComponent={QueryErrorFallback}
                  onError={(error, errorInfo) => {
                    // Capture React Query related errors
                    captureError(error, {
                      errorBoundary: 'query-level',
                      componentStack: errorInfo.componentStack,
                      context: 'react-query-boundary',
                    })
                  }}
                  onReset={reset}
                >
              <Router>
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<PublicLayout />}>
                    <Route
                      index
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <HomePage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="login"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <LoginPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="register"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <RegisterPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="forgot-password"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <ForgotPasswordPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="auth/callback"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <AuthCallbackPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="about"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <AboutPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="contact"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <ContactPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="careers"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <CareersPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="privacy"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <PrivacyPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="terms"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <TermsPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="compliance"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <CompliancePage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="cookies"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <CookiePolicyPage />
                        </Suspense>
                      }
                    />
                    {/* Alternative routes for legal pages (user-friendly URLs) */}
                    <Route
                      path="privacy-policy"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <PrivacyPolicyPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="terms-of-service"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <TermsOfServicePage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="cookie-policy"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <CookiePolicyPage />
                        </Suspense>
                      }
                    />
                    {/* Blog Routes */}
                    <Route
                      path="blog"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <BlogPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="blog/post/:slug"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <BlogPostPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="blog/category/:slug"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <BlogCategoryPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="blog/author/:slug"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <BlogAuthorPage />
                        </Suspense>
                      }
                    />
                    {/* Demo routes */}
                    <Route
                      path="demo"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <DemoSelectorPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="demo/:userType"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <DemoDashboardPage />
                        </Suspense>
                      }
                    />

                    {/* Development-only demo routes */}
                    {import.meta.env.DEV && ErrorDemoPage && (
                      <Route
                        path="error-demo"
                        element={
                          <Suspense fallback={<div>Loading demo...</div>}>
                            <ErrorDemoPage />
                          </Suspense>
                        }
                      />
                    )}
                  </Route>

                  {/* Protected app routes */}
                  <Route
                    path="/app"
                    element={
                      <ProtectedRoute>
                        <AppLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<Navigate to="/app/dashboard" replace />} />
                    <Route
                      path="dashboard"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <DashboardPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="campaigns"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <CampaignsPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="campaigns/create"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <CreateCampaignPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="campaigns/:id/edit"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <EditCampaignPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="calls"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <CallsPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="reports"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <ReportsPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="settings"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <SettingsPage />
                        </Suspense>
                      }
                    >
                      <Route
                        path="profile"
                        element={
                          <Suspense fallback={<PageLoader />}>
                            <ProfileSettingsPage />
                          </Suspense>
                        }
                      />
                      <Route
                        path="notifications"
                        element={
                          <Suspense fallback={<PageLoader />}>
                            <NotificationSettingsPage />
                          </Suspense>
                        }
                      />
                      <Route
                        path="security"
                        element={
                          <Suspense fallback={<PageLoader />}>
                            <SecuritySettingsPage />
                          </Suspense>
                        }
                      />
                      <Route
                        path="account"
                        element={
                          <Suspense fallback={<PageLoader />}>
                            <AccountSettingsPage />
                          </Suspense>
                        }
                      />
                      <Route
                        path="call-tracking"
                        element={
                          <Suspense fallback={<PageLoader />}>
                            <CallTrackingSettingsPage />
                          </Suspense>
                        }
                      />
                      <Route
                        path="payouts"
                        element={
                          <Suspense fallback={<PageLoader />}>
                            <PayoutSettingsPage />
                          </Suspense>
                        }
                      />
                      <Route
                        path="campaign-defaults"
                        element={
                          <Suspense fallback={<PageLoader />}>
                            <CampaignDefaultsPage />
                          </Suspense>
                        }
                      />
                      <Route
                        path="billing"
                        element={
                          <Suspense fallback={<PageLoader />}>
                            <BillingSettingsPage />
                          </Suspense>
                        }
                      />
                      <Route
                        path="quality-standards"
                        element={
                          <Suspense fallback={<PageLoader />}>
                            <QualityStandardsPage />
                          </Suspense>
                        }
                      />
                    </Route>
                  </Route>

                  {/* Catch all */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Router>
            </ErrorBoundary>
          )}
        </QueryErrorResetBoundary>
      </QueryClientProvider>
    </div>
    </CSPProvider>
    </ServiceWorkerProvider>
  )
}

// Performance report in development
if (process.env.NODE_ENV === 'development') {
  window.addEventListener('beforeunload', () => {
    console.log(performanceMonitor.generateReport())
  })
}

export default React.memo(App)
