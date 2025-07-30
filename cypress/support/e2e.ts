// Import Cypress commands
import './commands'
import '@cypress/code-coverage/support'
import 'cypress-real-events/support'
import 'cypress-file-upload'
import '@cypress-audit/lighthouse/commands'
import '@cypress-audit/pa11y/commands'

// Performance tracking
let performanceMetrics: Record<string, number> = {}

beforeEach(() => {
  // Clear performance metrics
  performanceMetrics = {}
  
  // Set up API interceptors
  cy.intercept('GET', '/api/v1/*/dashboard/stats', { fixture: 'dashboard-stats.json' }).as('dashboardStats')
  cy.intercept('GET', '/api/v1/marketplace/search*', { fixture: 'marketplace-listings.json' }).as('marketplaceSearch')
  cy.intercept('GET', '/api/v1/calls*', { fixture: 'calls.json' }).as('getCalls')
  cy.intercept('GET', '/api/v1/users/me', { fixture: 'current-user.json' }).as('getCurrentUser')
  
  // Mock WebSocket connections
  cy.window().then((win) => {
    // @ts-expect-error - Overriding WebSocket for testing purposes to mock real-time connections
    win.WebSocket = class MockWebSocket {
      constructor(url: string) {
        console.log('WebSocket connection to:', url)
      }
      send() {}
      close() {}
      addEventListener() {}
      removeEventListener() {}
    }
  })
})

afterEach(() => {
  // Log performance metrics
  if (Object.keys(performanceMetrics).length > 0) {
    cy.task('logPerformanceMetrics', performanceMetrics)
  }
})

// Error handling
Cypress.on('uncaught:exception', (err) => {
  // Ignore ResizeObserver errors
  if (err.message.includes('ResizeObserver')) {
    return false
  }
  // Ignore known React hydration warnings in dev
  if (err.message.includes('Hydration failed')) {
    return false
  }
  // Let other errors fail the test
  return true
})

// Screenshot naming
Cypress.Screenshot.defaults({
  screenshotOnRunFailure: true,
  onAfterScreenshot($el, props) {
    // Add timestamp to screenshot names
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    props.name = `${props.name}-${timestamp}`
  },
})

// Performance observer
Cypress.on('window:before:load', (win) => {
  // Add performance observer
  if ('PerformanceObserver' in win) {
    const observer = new win.PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry) => {
        if (entry.entryType === 'navigation') {
          performanceMetrics.loadTime = entry.duration
          performanceMetrics.domContentLoaded = entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart
        } else if (entry.entryType === 'largest-contentful-paint') {
          performanceMetrics.lcp = entry.startTime
        } else if (entry.entryType === 'first-input') {
          performanceMetrics.fid = entry.processingStart - entry.startTime
        }
      })
    })
    
    observer.observe({ entryTypes: ['navigation', 'largest-contentful-paint', 'first-input'] })
  }
})

// Custom error messages
chai.use((_chai, utils) => {
  utils.addMethod(_chai.Assertion.prototype, 'accessible', function () {
    const element = utils.flag(this, 'object')
    const isAccessible = element.attr('aria-label') || element.attr('aria-labelledby') || element.text()
    
    this.assert(
      isAccessible,
      'expected #{this} to be accessible (have aria-label, aria-labelledby, or text content)',
      'expected #{this} not to be accessible',
      element
    )
  })
})

// Test data cleanup
after(() => {
  cy.task('cleanupTestData')
})