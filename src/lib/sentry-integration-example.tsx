/**
 * Example of how to integrate the new Sentry configuration into your React app
 * 
 * This file shows how to:
 * 1. Initialize Sentry in your main.tsx
 * 2. Use Sentry utilities throughout your app
 * 3. Set up error boundaries with Sentry
 */

// main.tsx example
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initSentry } from './lib/sentry-config'
import App from './App'

// Initialize Sentry before rendering the app
initSentry()

const root = createRoot(document.getElementById('root')!)
root.render(
  <StrictMode>
    <App />
  </StrictMode>
)

// App.tsx example with Sentry Error Boundary
import { BrowserRouter } from 'react-router-dom'
import { SentryErrorBoundary } from './lib/sentry-config'
import { ErrorFallback } from './components/ErrorFallback'

function App() {
  return (
    <SentryErrorBoundary
      fallback={ErrorFallback}
      showDialog={false}
    >
      <BrowserRouter>
        {/* Your app routes */}
      </BrowserRouter>
    </SentryErrorBoundary>
  )
}

// Example of tracking user authentication
import { setSentryUser, clearSentryUser } from './lib/sentry-config'

// On successful login
const handleLogin = async (credentials: LoginCredentials) => {
  try {
    const user = await loginUser(credentials)
    
    // Set Sentry user context
    setSentryUser({
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    })
    
    // Continue with login flow...
  } catch (error) {
    // Error will be automatically captured by Sentry
    throw error
  }
}

// On logout
const handleLogout = () => {
  clearSentryUser()
  // Continue with logout flow...
}

// Example of using performance monitoring
import { withPerformanceMonitoring } from './lib/sentry-config'

const fetchDashboardData = async () => {
  return await withPerformanceMonitoring(
    'dashboard.load',
    async () => {
      const [calls, campaigns, analytics] = await Promise.all([
        api.getCalls(),
        api.getCampaigns(),
        api.getAnalytics(),
      ])
      
      return { calls, campaigns, analytics }
    },
    { page: 'dashboard' }
  )
}

// Example of manual error capture with context
import { captureError, addBreadcrumb } from './lib/sentry-config'

const processPayment = async (paymentData: PaymentData) => {
  try {
    // Add breadcrumb for debugging
    addBreadcrumb('Processing payment', 'payment', 'info', {
      amount: paymentData.amount,
      currency: paymentData.currency,
    })
    
    const result = await stripeClient.processPayment(paymentData)
    return result
  } catch (error) {
    // Capture with additional context
    captureError(error, {
      paymentId: paymentData.id,
      amount: paymentData.amount,
      customerId: paymentData.customerId,
      errorType: 'payment_processing',
    })
    
    throw error
  }
}

// Example of tracking custom events
import { trackEvent } from './lib/sentry-config'

const CampaignForm = () => {
  const handleSubmit = (data: CampaignData) => {
    // Track important business events
    trackEvent('campaign_created', {
      campaignType: data.type,
      budget: data.budget,
      targeting: data.targeting,
      important: true, // Will also send to Sentry as a message
    })
    
    // Continue with form submission...
  }
  
  return (
    <div>Your form component</div>
  )
}

// Example of component profiling for performance
import { withComponentProfiling } from './lib/sentry-config'

const DashboardChart = ({ data }: { data: ChartData }) => {
  // Component logic...
  return <div>{/* Chart rendering */}</div>
}

// Wrap component with profiling
export default withComponentProfiling(DashboardChart, 'DashboardChart')