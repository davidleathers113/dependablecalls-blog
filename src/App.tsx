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

// Layouts - Keep these eager as they're used on every route
import PublicLayout from './components/layout/PublicLayout'
import AppLayout from './components/layout/AppLayout'

// Lazy load all pages for code splitting
// Public Pages
const HomePage = React.lazy(() => import('./pages/public/HomePage'))
const BlogPage = React.lazy(() => import('./pages/public/BlogPage'))
const BlogPostPage = React.lazy(() => import('./pages/public/BlogPostPage'))
const ContactPage = React.lazy(() => import('./pages/public/ContactPage'))
const CareersPage = React.lazy(() => import('./pages/public/CareersPage'))
const AboutPage = React.lazy(() => import('./pages/public/AboutPage'))
const LoginPage = React.lazy(() => import('./pages/auth/LoginPage'))
const RegisterPage = React.lazy(() => import('./pages/auth/RegisterPage'))
const ForgotPasswordPage = React.lazy(() => import('./pages/auth/ForgotPasswordPage'))

// Legal Pages
const PrivacyPage = React.lazy(() => import('./pages/legal/PrivacyPage'))
const TermsPage = React.lazy(() => import('./pages/legal/TermsPage'))
const CompliancePage = React.lazy(() => import('./pages/legal/CompliancePage'))

// Demo Pages (Development Only)
const ErrorDemoPage = import.meta.env.DEV ? React.lazy(() => import('./pages/ErrorDemo')) : null

// Authenticated Pages
const DashboardPage = React.lazy(() => import('./pages/dashboard/DashboardPage'))
const CampaignsPage = React.lazy(() => import('./pages/campaigns/CampaignsPage'))
const CreateCampaignPage = React.lazy(() => import('./pages/campaigns/CreateCampaignPage'))
const EditCampaignPage = React.lazy(() => import('./pages/campaigns/EditCampaignPage'))
const CallsPage = React.lazy(() => import('./pages/calls/CallsPage'))
const ReportsPage = React.lazy(() => import('./pages/reports/ReportsPage'))
const BillingPage = React.lazy(() => import('./pages/billing/BillingPage'))
const SettingsPage = React.lazy(() => import('./pages/settings/SettingsPage'))

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

  return (
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
                      path="about"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <AboutPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="blog"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <BlogPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="blog/:slug"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <BlogPostPage />
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
                      path="billing"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <BillingPage />
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
                    />
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
  )
}

export default App
