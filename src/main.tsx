import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import './index.css'
import App from './App.tsx'
import { initSentry, SentryErrorBoundary, captureError } from './lib/monitoring'
import { apm } from './lib/apm'
import { AppErrorFallback } from './components/ui/AppErrorFallback'

// Initialize Sentry monitoring
initSentry()

// Initialize Application Performance Monitoring
apm.init({
  enableWebVitals: true,
  enableResourceTiming: true,
  enableLongTasks: true,
  enablePaintTiming: true,
  sampleRate: import.meta.env.PROD ? 0.1 : 1.0,
})

// Track initial bundle size
apm.trackBundleSize()

// Track memory usage periodically
if (import.meta.env.DEV) {
  setInterval(() => apm.trackMemoryUsage(), 30000)
}

// Global error handlers for unhandled errors
window.addEventListener('error', (event) => {
  captureError(event.error || new Error(event.message), {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    type: 'global_error',
  })
})

window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
  captureError(error, {
    type: 'unhandled_promise_rejection',
  })
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SentryErrorBoundary fallback={AppErrorFallback}>
      <ErrorBoundary
        FallbackComponent={AppErrorFallback}
        onError={(error, errorInfo) => {
          // Capture error with additional context
          captureError(error, {
            errorBoundary: 'app-level',
            componentStack: errorInfo.componentStack,
            errorBoundaryStack: errorInfo.errorBoundaryStack,
          })
        }}
        onReset={() => {
          // Clear any persisted error state
          sessionStorage.removeItem('error-boundary-reset-count')

          // Track app recovery
          apm.trackEvent('app_error_boundary_reset', {
            timestamp: Date.now(),
          })
        }}
      >
        <App />
      </ErrorBoundary>
    </SentryErrorBoundary>
  </StrictMode>
)
