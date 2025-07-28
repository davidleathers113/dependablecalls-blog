import { defineConfig } from 'cypress'
import codeCoverageTask from '@cypress/code-coverage/task'
import { lighthouse, prepareAudit } from '@cypress-audit/lighthouse'
import { pa11y } from '@cypress-audit/pa11y'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    viewportWidth: 1440,
    viewportHeight: 900,
    video: true,
    screenshotOnRunFailure: true,
    videosFolder: 'cypress/videos',
    screenshotsFolder: 'cypress/screenshots',
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    pageLoadTimeout: 30000,
    retries: {
      runMode: 2,
      openMode: 0,
    },
    env: {
      coverage: true,
      codeCoverage: {
        exclude: ['cypress/**/*.*'],
      },
    },
    setupNodeEvents(on, config) {
      // Code coverage
      codeCoverageTask(on, config)
      
      // Performance testing with Lighthouse
      on('before:browser:launch', (browser, launchOptions) => {
        prepareAudit(launchOptions)
        return launchOptions
      })
      
      on('task', {
        lighthouse: lighthouse(),
        pa11y: pa11y(),
        
        // Custom task for database seeding
        seedDatabase(data: any) {
          // Implementation would connect to test database
          console.log('Seeding database with:', data)
          return null
        },
        
        // Custom task for cleaning up test data
        cleanupTestData() {
          console.log('Cleaning up test data')
          return null
        },
        
        // Performance metrics collection
        logPerformanceMetrics(metrics: any) {
          console.log('Performance metrics:', metrics)
          return null
        },
      })
      
      return config
    },
    specPattern: 'tests/e2e/**/*.spec.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.ts',
    experimentalStudio: true,
    experimentalWebKitSupport: true,
  },
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/component.ts',
  },
})

// Type definitions for custom commands
declare global {
  namespace Cypress {
    interface Chainable {
      login(role: 'buyer' | 'supplier' | 'network' | 'admin'): Chainable<void>
      logout(): Chainable<void>
      seedTestData(scenario: string): Chainable<void>
      checkAccessibility(context?: any, options?: any): Chainable<void>
      measurePerformance(name: string): Chainable<void>
      interceptAPI(alias: string, response?: any): Chainable<void>
      waitForRealtime(event: string): Chainable<void>
      selectDateRange(start: string, end: string): Chainable<void>
      uploadFile(fileName: string, selector: string): Chainable<void>
      checkNotification(message: string): Chainable<void>
      dismissNotification(): Chainable<void>
    }
  }
}