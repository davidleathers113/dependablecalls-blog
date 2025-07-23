import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initSentry } from './lib/monitoring'
import { apm } from './lib/apm'

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
