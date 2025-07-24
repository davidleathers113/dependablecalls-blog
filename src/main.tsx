import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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

// Track initial bundle size (skip in StrictMode double-invocation)
if (!import.meta.env.DEV) {
  apm.trackBundleSize()
}

// Track memory usage periodically with proper disposal
let memInterval: number | undefined
if (import.meta.env.DEV) {
  memInterval = window.setInterval(() => apm.trackMemoryUsage(), 30_000)
}

// Attach global handlers with cleanup function
function attachGlobalHandlers() {
  const onError = (event: ErrorEvent) => {
    // Sentry SDK already captures these, but we add custom context
    captureError(event.error || new Error(event.message), {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      type: 'global_error',
    })
  }

  const onRejection = (event: PromiseRejectionEvent) => {
    // Sentry SDK already captures these, but we add custom context
    captureError(event.reason instanceof Error ? event.reason : new Error(String(event.reason)), {
      type: 'unhandled_promise_rejection',
    })
  }

  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)

  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
    if (memInterval) clearInterval(memInterval)
  }
}

const detach = attachGlobalHandlers()

// Hot-module reload cleanup
if (import.meta.hot) {
  import.meta.hot.dispose(detach)
}

// Prevent multiple React roots on HMR
const container = document.getElementById('root')!
const root =
  (container as unknown as { _reactRoot?: ReturnType<typeof createRoot> })._reactRoot ??
  ((container as unknown as { _reactRoot?: ReturnType<typeof createRoot> })._reactRoot =
    createRoot(container))

root.render(
  <StrictMode>
    <SentryErrorBoundary
      showDialog={false} // Prevent duplicate error dialogs
      fallback={({ error, resetError, eventId }) => (
        <AppErrorFallback
          error={error instanceof Error ? error : new Error(String(error))}
          resetErrorBoundary={resetError}
          errorInfo={{ eventId }}
        />
      )}
    >
      <App />
    </SentryErrorBoundary>
  </StrictMode>
)
