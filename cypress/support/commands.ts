/// <reference types="cypress" />

// Login command for different user types
Cypress.Commands.add('login', (role: 'buyer' | 'supplier' | 'network' | 'admin') => {
  const users = {
    buyer: { email: 'buyer@test.com', password: 'BuyerTest123!' },
    supplier: { email: 'supplier@test.com', password: 'SupplierTest123!' },
    network: { email: 'network@test.com', password: 'NetworkTest123!' },
    admin: { email: 'admin@test.com', password: 'AdminTest123!' },
  }

  const user = users[role]
  
  cy.session([role], () => {
    cy.visit('/login')
    cy.get('[data-testid="email-input"]').type(user.email)
    cy.get('[data-testid="password-input"]').type(user.password)
    cy.get('[data-testid="login-button"]').click()
    
    // Wait for redirect to dashboard
    cy.url().should('include', '/dashboard')
    
    // SECURITY FIX: Auth tokens now stored in httpOnly cookies, not localStorage
    // Verify authentication by checking user state instead
    cy.getCookie('dce_session').should('exist')
  })
})

// Logout command
Cypress.Commands.add('logout', () => {
  cy.get('[data-testid="user-menu"]').click()
  cy.get('[data-testid="logout-button"]').click()
  cy.url().should('include', '/login')
})

// Seed test data for specific scenarios
Cypress.Commands.add('seedTestData', (scenario: string) => {
  const scenarios: Record<string, any> = {
    'marketplace-with-calls': {
      calls: 50,
      buyers: 10,
      suppliers: 15,
      priceRange: [10, 100],
    },
    'empty-marketplace': {
      calls: 0,
      buyers: 5,
      suppliers: 5,
    },
    'high-volume': {
      calls: 1000,
      buyers: 100,
      suppliers: 200,
      transactions: 5000,
    },
    'single-buyer-flow': {
      calls: 20,
      buyers: 1,
      suppliers: 10,
      budget: 10000,
    },
  }

  cy.task('seedDatabase', scenarios[scenario] || {})
})

// Accessibility check command
Cypress.Commands.add('checkAccessibility', (context, options) => {
  const terminalLog = (violations: any[]) => {
    cy.task(
      'log',
      `${violations.length} accessibility violation${violations.length === 1 ? '' : 's'} ${
        violations.length === 1 ? 'was' : 'were'
      } detected`
    )
    
    const violationData = violations.map(({ id, impact, description, nodes }) => ({
      id,
      impact,
      description,
      nodes: nodes.length,
    }))
    
    cy.task('table', violationData)
  }

  cy.injectAxe()
  cy.checkA11y(context, options, terminalLog)
})

// Performance measurement
Cypress.Commands.add('measurePerformance', (name: string) => {
  cy.window().then((win) => {
    const performance = win.performance
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    
    const metrics = {
      name,
      timestamp: Date.now(),
      loadTime: navigationEntry.loadEventEnd - navigationEntry.loadEventStart,
      domContentLoaded: navigationEntry.domContentLoadedEventEnd - navigationEntry.domContentLoadedEventStart,
      firstPaint: 0,
      firstContentfulPaint: 0,
      largestContentfulPaint: 0,
    }
    
    // Get paint metrics
    const paintEntries = performance.getEntriesByType('paint')
    paintEntries.forEach((entry) => {
      if (entry.name === 'first-paint') {
        metrics.firstPaint = entry.startTime
      } else if (entry.name === 'first-contentful-paint') {
        metrics.firstContentfulPaint = entry.startTime
      }
    })
    
    cy.task('logPerformanceMetrics', metrics)
  })
})

// API interceptor helper
Cypress.Commands.add('interceptAPI', (alias: string, response?: any) => {
  const apiMap: Record<string, string> = {
    'dashboard': '/api/v1/*/dashboard/stats',
    'marketplace': '/api/v1/marketplace/search*',
    'purchase': '/api/v1/purchases/create',
    'inventory': '/api/v1/inventory*',
    'analytics': '/api/v1/analytics/*',
    'users': '/api/v1/users/*',
    'calls': '/api/v1/calls/*',
    'transactions': '/api/v1/transactions/*',
  }

  const endpoint = apiMap[alias] || alias
  
  if (response) {
    cy.intercept('*', endpoint, response).as(alias)
  } else {
    cy.intercept('*', endpoint).as(alias)
  }
})

// Wait for real-time updates
Cypress.Commands.add('waitForRealtime', (event: string) => {
  cy.window().then((win) => {
    return new Cypress.Promise((resolve) => {
      const listener = (e: CustomEvent) => {
        if (e.detail.type === event) {
          win.removeEventListener('realtime', listener)
          resolve(e.detail)
        }
      }
      win.addEventListener('realtime', listener)
      
      // Timeout after 10 seconds
      setTimeout(() => {
        win.removeEventListener('realtime', listener)
        resolve(null)
      }, 10000)
    })
  })
})

// Date range picker helper
Cypress.Commands.add('selectDateRange', (start: string, end: string) => {
  cy.get('[data-testid="date-range-picker"]').click()
  cy.get('[data-testid="start-date"]').clear().type(start)
  cy.get('[data-testid="end-date"]').clear().type(end)
  cy.get('[data-testid="apply-date-range"]').click()
})

// File upload helper
Cypress.Commands.add('uploadFile', (fileName: string, selector: string) => {
  cy.get(selector).attachFile(fileName)
})

// Notification helpers
Cypress.Commands.add('checkNotification', (message: string) => {
  cy.get('[data-testid="notification"]')
    .should('be.visible')
    .and('contain', message)
})

Cypress.Commands.add('dismissNotification', () => {
  cy.get('[data-testid="notification-close"]').click()
  cy.get('[data-testid="notification"]').should('not.exist')
})

// Helper to wait for loading states
Cypress.Commands.add('waitForLoading', () => {
  cy.get('[data-testid="loading-spinner"]').should('be.visible')
  cy.get('[data-testid="loading-spinner"]').should('not.exist')
})

// Helper for table operations
Cypress.Commands.add('sortTable', (column: string, order: 'asc' | 'desc' = 'asc') => {
  cy.get(`[data-testid="sort-${column}"]`).click()
  if (order === 'desc') {
    cy.get(`[data-testid="sort-${column}"]`).click()
  }
})

// Helper for pagination
Cypress.Commands.add('goToPage', (page: number) => {
  cy.get(`[data-testid="page-${page}"]`).click()
})

// Visual regression helper
Cypress.Commands.add('compareSnapshot', (name: string, options = {}) => {
  cy.screenshot(name, {
    capture: 'viewport',
    overwrite: true,
    ...options,
  })
})