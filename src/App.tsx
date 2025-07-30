import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider, QueryErrorResetBoundary } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { ErrorBoundary } from 'react-error-boundary'
import { ErrorBoundary as CustomErrorBoundary } from './components/common/ErrorBoundary'
import { UnauthorizedError } from './components/common/FallbackUI'
import React, { useEffect, Suspense } from 'react'
import { useAuthStore } from './store/authStore'
import { captureError } from './lib/monitoring'
import { QueryErrorFallback } from './components/ui/QueryErrorFallback'
import { CSPProvider } from './lib/CSPProvider'
// // import { useReducedMotion } from './hooks/useReducedMotion' // Removed for build

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

// Blog Pages - Temporarily disabled for deployment
// const BlogPage = React.lazy(() => 
//   import(/* webpackPrefetch: true, webpackChunkName: "blog" */ './pages/public/BlogPage')
// )
// const BlogPostPage = React.lazy(() => 
//   import(/* webpackPrefetch: true, webpackChunkName: "blog-post" */ './pages/public/BlogPostPage')
// )
// const BlogCategoryPage = React.lazy(() => 
//   import(/* webpackChunkName: "blog-category" */ './pages/public/BlogCategoryPage')
// )
// const BlogAuthorPage = React.lazy(() => 
//   import(/* webpackChunkName: "blog-author" */ './pages/public/BlogAuthorPage')
// )

// Demo Pages (Development Only)
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

// Loading component for lazy-loaded routes
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  )
}

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <CustomErrorBoundary
      context="ProtectedRoute - Authentication"
      fallback={<UnauthorizedError onGoHome={() => (window.location.href = '/')} />}
      onError={(error, errorInfo) => {
        // Log authentication-related errors
        captureError(error, {
          errorBoundary: 'protected-route',
          componentStack: errorInfo.componentStack,
          context: 'authentication',
          user: user?.id || 'unknown',
        })
      }}
    >
      {children}
    </CustomErrorBoundary>
  )
}

function App() {
  const { checkSession } = useAuthStore()

  useEffect(() => {
    checkSession()
  }, [checkSession])

  // Add resource error tracking to identify 404s and other loading issues
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
        
        console.error('Resource loading error:', {
          type: target.tagName.toLowerCase(),
          url: resourceUrl,
          message: 'Failed to load resource'
        })

        // Also capture in monitoring if available
        captureError(new Error(`Failed to load ${target.tagName.toLowerCase()}: ${resourceUrl}`), {
          errorBoundary: 'resource-loading',
          context: 'resource-error',
          resourceType: target.tagName.toLowerCase(),
          resourceUrl
        })
      }
    }

    window.addEventListener('error', handleResourceError, true)

    return () => {
      window.removeEventListener('error', handleResourceError, true)
    }
  }, [])

  return (
    <CSPProvider>
      <div className="min-h-screen flex flex-col">
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
                    {/* Blog Routes - Temporarily disabled for deployment */}
                    {/* <Route
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
                    /> */}
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
  )
}

export default App
