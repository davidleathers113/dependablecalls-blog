import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider, QueryErrorResetBoundary } from '@tanstack/react-query'
import { ErrorBoundary } from 'react-error-boundary'
import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import { captureError, addBreadcrumb } from './lib/monitoring'
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

// Authenticated Pages
import DashboardPage from './pages/dashboard/DashboardPage'
import CampaignsPage from './pages/campaigns/CampaignsPage'
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
      fallback={<AuthProtectedFallbackUI />}
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

// Create QueryClient instance with error boundary integration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors (client errors)
        if (error instanceof Error && 'status' in error && typeof error.status === 'number') {
          if (error.status >= 400 && error.status < 500) {
            return false
          }
        }

        // Retry up to 2 times for other errors
        return failureCount < 2
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      useErrorBoundary: (error) => {
        // Use error boundary for critical errors that should crash the component
        if (error instanceof Error) {
          // Network errors that indicate complete connectivity loss
          if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
            return false // Handle gracefully, don't crash
          }

          // Authentication errors
          if ('status' in error && error.status === 401) {
            return false // Handle with auth redirect
          }

          // Server errors that might be temporary
          if ('status' in error && typeof error.status === 'number' && error.status >= 500) {
            return true // These should trigger error boundary
          }
        }

        return false
      },
    },
    mutations: {
      retry: 1,
      useErrorBoundary: (error) => {
        // Critical mutations that should crash on error
        if (error instanceof Error) {
          // Payment processing errors
          if (error.message.includes('payment') || error.message.includes('stripe')) {
            return true
          }

          // Data corruption errors
          if (error.message.includes('constraint') || error.message.includes('integrity')) {
            return true
          }
        }

        return false
      },
    },
  },
  queryCache: {
    onError: (error, query) => {
      // Log query errors for monitoring
      addBreadcrumb(`Query error: ${query.queryKey.join(', ')}`, 'query', 'error', {
        queryKey: query.queryKey,
        errorMessage: error.message,
      })

      // Capture non-boundary errors for tracking
      if (error instanceof Error && !query.meta?.useErrorBoundary) {
        captureError(error, {
          context: 'react-query',
          queryKey: query.queryKey,
          type: 'query_error',
        })
      }
    },
  },
  mutationCache: {
    onError: (error, variables, context, mutation) => {
      // Log mutation errors
      addBreadcrumb(
        `Mutation error: ${mutation.options.mutationKey?.join(', ') || 'unknown'}`,
        'mutation',
        'error',
        {
          mutationKey: mutation.options.mutationKey,
          errorMessage: error.message,
        }
      )

      // Capture non-boundary errors
      if (error instanceof Error && !mutation.meta?.useErrorBoundary) {
        captureError(error, {
          context: 'react-query',
          mutationKey: mutation.options.mutationKey,
          variables,
          type: 'mutation_error',
        })
      }
    },
  },
})

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
