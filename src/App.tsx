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

// Layouts
import PublicLayout from './components/layout/PublicLayout'
import AppLayout from './components/layout/AppLayout'

// Public Pages
import HomePage from './pages/public/HomePage'
import BlogPage from './pages/public/BlogPage'
import BlogPostPage from './pages/public/BlogPostPage'
import ContactPage from './pages/public/ContactPage'
import CareersPage from './pages/public/CareersPage'
import AboutPage from './pages/public/AboutPage'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'

// Legal Pages
import PrivacyPage from './pages/legal/PrivacyPage'
import TermsPage from './pages/legal/TermsPage'
import CompliancePage from './pages/legal/CompliancePage'

// Demo Pages (Development Only)
const ErrorDemoPage = import.meta.env.DEV ? React.lazy(() => import('./pages/ErrorDemo')) : null

// Authenticated Pages
import DashboardPage from './pages/dashboard/DashboardPage'
import CampaignsPage from './pages/campaigns/CampaignsPage'
import CreateCampaignPage from './pages/campaigns/CreateCampaignPage'
import CallsPage from './pages/calls/CallsPage'
import ReportsPage from './pages/reports/ReportsPage'
import BillingPage from './pages/billing/BillingPage'
import SettingsPage from './pages/settings/SettingsPage'

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
                    <Route index element={<HomePage />} />
                    <Route path="login" element={<LoginPage />} />
                    <Route path="register" element={<RegisterPage />} />
                    <Route path="forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="about" element={<AboutPage />} />
                    <Route path="blog" element={<BlogPage />} />
                    <Route path="blog/:slug" element={<BlogPostPage />} />
                    <Route path="contact" element={<ContactPage />} />
                    <Route path="careers" element={<CareersPage />} />
                    <Route path="privacy" element={<PrivacyPage />} />
                    <Route path="terms" element={<TermsPage />} />
                    <Route path="compliance" element={<CompliancePage />} />
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
                    <Route path="dashboard" element={<DashboardPage />} />
                    <Route path="campaigns" element={<CampaignsPage />} />
                    <Route path="campaigns/create" element={<CreateCampaignPage />} />
                    <Route path="calls" element={<CallsPage />} />
                    <Route path="reports" element={<ReportsPage />} />
                    <Route path="billing" element={<BillingPage />} />
                    <Route path="settings" element={<SettingsPage />} />
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
