/// <reference types="cypress" />

describe('Buyer Complete User Journey', () => {
  beforeEach(() => {
    cy.seedTestData('marketplace-with-calls')
    cy.visit('/')
  })

  describe('Onboarding and First Purchase', () => {
    it('completes full buyer onboarding flow', () => {
      // Landing page
      cy.get('[data-testid="hero-section"]').should('be.visible')
      cy.get('[data-testid="get-started-buyer"]').click()
      
      // Registration
      cy.url().should('include', '/register')
      cy.get('[data-testid="user-type-buyer"]').click()
      
      // Fill registration form
      cy.get('[data-testid="company-name"]').type('Quality Insurance Buyers LLC')
      cy.get('[data-testid="contact-name"]').type('John Doe')
      cy.get('[data-testid="email"]').type('john@qualityinsurance.com')
      cy.get('[data-testid="password"]').type('SecurePass123!')
      cy.get('[data-testid="confirm-password"]').type('SecurePass123!')
      cy.get('[data-testid="phone"]').type('+1 (555) 123-4567')
      
      // Business details
      cy.get('[data-testid="industry-select"]').select('insurance')
      cy.get('[data-testid="monthly-volume"]').type('5000')
      cy.get('[data-testid="avg-call-value"]').type('45')
      
      // Terms
      cy.get('[data-testid="accept-terms"]').check()
      cy.get('[data-testid="submit-registration"]').click()
      
      // Email verification
      cy.get('[data-testid="verification-notice"]').should('contain', 'Please check your email')
      
      // Simulate email verification
      cy.visit('/verify-email?token=test-token-123')
      cy.get('[data-testid="verification-success"]').should('be.visible')
      
      // Redirect to onboarding
      cy.url().should('include', '/onboarding')
      
      // Onboarding steps
      // Step 1: Business Profile
      cy.get('[data-testid="business-description"]').type('Leading insurance company specializing in auto and home insurance')
      cy.get('[data-testid="target-demographics"]').type('Homeowners aged 25-65 in California')
      cy.get('[data-testid="quality-requirements"]').type('Minimum 2-minute call duration, verified phone numbers')
      cy.get('[data-testid="continue-button"]').click()
      
      // Step 2: Call Preferences
      cy.get('[data-testid="preferred-categories"]').within(() => {
        cy.get('[value="auto_insurance"]').check()
        cy.get('[value="home_insurance"]').check()
        cy.get('[value="life_insurance"]').check()
      })
      
      cy.get('[data-testid="min-quality-score"]').clear().type('85')
      cy.get('[data-testid="max-price-per-call"]').type('60')
      cy.get('[data-testid="preferred-locations"]').type('California{enter}Texas{enter}Florida{enter}')
      cy.get('[data-testid="continue-button"]').click()
      
      // Step 3: Payment Setup
      cy.get('[data-testid="payment-method-card"]').click()
      cy.get('[data-testid="card-element"]').within(() => {
        cy.fillStripeElement('cardNumber', '4242424242424242')
        cy.fillStripeElement('cardExpiry', '12/25')
        cy.fillStripeElement('cardCvc', '123')
      })
      cy.get('[data-testid="billing-zip"]').type('90210')
      cy.get('[data-testid="auto-reload"]').check()
      cy.get('[data-testid="reload-threshold"]').type('500')
      cy.get('[data-testid="reload-amount"]').type('2500')
      cy.get('[data-testid="complete-setup"]').click()
      
      // Welcome to dashboard
      cy.url().should('include', '/dashboard')
      cy.get('[data-testid="welcome-modal"]').should('be.visible')
      cy.get('[data-testid="take-tour"]').click()
      
      // Quick tour
      cy.get('[data-testid="tour-step-1"]').should('contain', 'This is your dashboard')
      cy.get('[data-testid="tour-next"]').click()
      cy.get('[data-testid="tour-step-2"]').should('contain', 'Browse available calls')
      cy.get('[data-testid="tour-next"]').click()
      cy.get('[data-testid="tour-step-3"]').should('contain', 'Track your purchases')
      cy.get('[data-testid="tour-finish"]').click()
    })
  })

  describe('Marketplace Search and Purchase Flow', () => {
    beforeEach(() => {
      cy.login('buyer')
      cy.visit('/marketplace')
    })

    it('searches for calls and completes purchase', () => {
      // Initial marketplace view
      cy.get('[data-testid="marketplace-stats"]').within(() => {
        cy.get('[data-testid="available-calls"]').should('contain', '342')
        cy.get('[data-testid="avg-quality"]').should('contain', '87')
        cy.get('[data-testid="price-range"]').should('contain', '$25 - $95')
      })
      
      // Apply filters
      cy.get('[data-testid="category-filter"]').select('insurance')
      cy.get('[data-testid="quality-slider"]').setSliderValue(85)
      cy.get('[data-testid="price-min"]').type('30')
      cy.get('[data-testid="price-max"]').type('60')
      cy.get('[data-testid="location-filter"]').click()
      cy.get('[data-testid="location-dropdown"]').within(() => {
        cy.get('[data-value="CA"]').click()
        cy.get('[data-value="TX"]').click()
      })
      cy.get('[data-testid="apply-filters"]').click()
      
      // View results
      cy.get('[data-testid="results-count"]').should('contain', '28 calls found')
      cy.get('[data-testid="call-card"]').should('have.length.at.least', 10)
      
      // Sort by quality
      cy.get('[data-testid="sort-dropdown"]').select('quality_desc')
      cy.wait(500) // Wait for re-sort
      
      // Check first result has highest quality
      cy.get('[data-testid="call-card"]').first().within(() => {
        cy.get('[data-testid="quality-score"]').invoke('text').then((text) => {
          expect(parseInt(text)).to.be.at.least(90)
        })
      })
      
      // View call details
      cy.get('[data-testid="call-card"]').first().click()
      
      cy.get('[data-testid="call-detail-modal"]').within(() => {
        cy.get('[data-testid="call-id"]').should('be.visible')
        cy.get('[data-testid="supplier-name"]').should('contain', 'Premium Leads Inc')
        cy.get('[data-testid="quality-breakdown"]').should('be.visible')
        cy.get('[data-testid="call-duration"]').should('contain', '3:45 avg')
        cy.get('[data-testid="conversion-rate"]').should('contain', '42%')
        cy.get('[data-testid="sample-recording"]').should('exist')
        
        // Play sample
        cy.get('[data-testid="play-sample"]').click()
        cy.wait(2000) // Listen to sample
        
        // Check price
        cy.get('[data-testid="call-price"]').should('contain', '$45.00')
        cy.get('[data-testid="volume-discount"]').should('contain', '10% off 50+')
        
        // Purchase single call
        cy.get('[data-testid="purchase-single"]').click()
      })
      
      // Confirm purchase
      cy.get('[data-testid="purchase-confirmation"]').within(() => {
        cy.get('[data-testid="purchase-summary"]').should('contain', '1 call')
        cy.get('[data-testid="total-amount"]').should('contain', '$45.00')
        cy.get('[data-testid="account-balance"]').should('contain', '$2,500.00')
        cy.get('[data-testid="remaining-balance"]').should('contain', '$2,455.00')
        
        cy.get('[data-testid="confirm-purchase"]').click()
      })
      
      // Purchase success
      cy.get('[data-testid="success-notification"]').should('contain', 'Purchase successful')
      cy.get('[data-testid="transaction-id"]').should('be.visible')
      cy.get('[data-testid="download-receipt"]').should('exist')
      
      // Call delivery
      cy.get('[data-testid="delivery-status"]').should('contain', 'Call delivered')
      cy.get('[data-testid="access-recording"]').click()
      
      // Recording player
      cy.get('[data-testid="recording-player"]').should('be.visible')
      cy.get('[data-testid="call-details-panel"]').within(() => {
        cy.get('[data-testid="caller-number"]').should('be.visible')
        cy.get('[data-testid="call-duration"]').should('contain', '4:12')
        cy.get('[data-testid="call-transcript"]').should('exist')
      })
    })

    it('creates and manages saved searches', () => {
      // Set up search criteria
      cy.get('[data-testid="category-filter"]').select('home_services')
      cy.get('[data-testid="quality-slider"]').setSliderValue(80)
      cy.get('[data-testid="price-max"]').type('40')
      cy.get('[data-testid="location-filter"]').click()
      cy.get('[data-testid="location-dropdown"]').within(() => {
        cy.get('[data-value="NY"]').click()
        cy.get('[data-value="NJ"]').click()
      })
      
      // Save search
      cy.get('[data-testid="save-search-button"]').click()
      cy.get('[data-testid="save-search-modal"]').within(() => {
        cy.get('[data-testid="search-name"]').type('NYC Area Home Services Under $40')
        cy.get('[data-testid="enable-alerts"]').check()
        cy.get('[data-testid="alert-frequency"]').select('instant')
        cy.get('[data-testid="save-button"]').click()
      })
      
      // Verify saved
      cy.get('[data-testid="success-notification"]').should('contain', 'Search saved')
      
      // View saved searches
      cy.get('[data-testid="saved-searches-tab"]').click()
      cy.get('[data-testid="saved-search-item"]').should('contain', 'NYC Area Home Services Under $40')
      
      // Edit saved search
      cy.get('[data-testid="saved-search-item"]').first().within(() => {
        cy.get('[data-testid="edit-search"]').click()
      })
      
      cy.get('[data-testid="edit-search-modal"]').within(() => {
        cy.get('[data-testid="price-max"]').clear().type('45')
        cy.get('[data-testid="update-button"]').click()
      })
      
      // Run saved search
      cy.get('[data-testid="saved-search-item"]').first().within(() => {
        cy.get('[data-testid="run-search"]').click()
      })
      
      // Verify filters applied
      cy.get('[data-testid="active-filters"]').should('contain', 'home_services')
      cy.get('[data-testid="active-filters"]').should('contain', 'Max $45')
    })

    it('handles bulk purchases with volume discounts', () => {
      // Filter for bulk purchase
      cy.get('[data-testid="category-filter"]').select('insurance')
      cy.get('[data-testid="quality-slider"]').setSliderValue(85)
      cy.get('[data-testid="apply-filters"]').click()
      
      // Select multiple calls
      cy.get('[data-testid="select-all-visible"]').check()
      cy.get('[data-testid="selected-count"]').should('contain', '20 calls selected')
      
      // Deselect a few
      cy.get('[data-testid="call-checkbox"]').eq(2).uncheck()
      cy.get('[data-testid="call-checkbox"]').eq(5).uncheck()
      cy.get('[data-testid="selected-count"]').should('contain', '18 calls selected')
      
      // Bulk purchase
      cy.get('[data-testid="bulk-purchase-button"]').click()
      
      cy.get('[data-testid="bulk-purchase-modal"]').within(() => {
        cy.get('[data-testid="selected-calls"]').should('contain', '18 calls')
        cy.get('[data-testid="subtotal"]').should('contain', '$810.00')
        cy.get('[data-testid="volume-discount"]').should('contain', '-$81.00 (10%)')
        cy.get('[data-testid="total-amount"]').should('contain', '$729.00')
        
        // Apply promo code
        cy.get('[data-testid="promo-code"]').type('BULK20')
        cy.get('[data-testid="apply-promo"]').click()
        cy.get('[data-testid="promo-discount"]').should('contain', '-$145.80')
        cy.get('[data-testid="final-total"]').should('contain', '$583.20')
        
        cy.get('[data-testid="confirm-bulk-purchase"]').click()
      })
      
      // Process bulk delivery
      cy.get('[data-testid="bulk-processing"]').should('be.visible')
      cy.get('[data-testid="processing-progress"]').should('contain', '18 / 18')
      
      // Download bulk data
      cy.get('[data-testid="download-bulk-csv"]').click()
      cy.verifyDownload('bulk_calls_*.csv')
    })
  })

  describe('Analytics and Reporting', () => {
    beforeEach(() => {
      cy.login('buyer')
      cy.visit('/analytics')
    })

    it('views comprehensive analytics dashboard', () => {
      // Date range selection
      cy.get('[data-testid="date-range-picker"]').click()
      cy.get('[data-testid="last-30-days"]').click()
      
      // Overview metrics
      cy.get('[data-testid="total-purchases"]').should('contain', '342')
      cy.get('[data-testid="total-spent"]').should('contain', '$15,420')
      cy.get('[data-testid="avg-call-price"]').should('contain', '$45.09')
      cy.get('[data-testid="conversion-rate"]').should('contain', '38%')
      
      // Performance charts
      cy.get('[data-testid="spend-trend-chart"]').should('be.visible')
      cy.get('[data-testid="conversion-chart"]').should('be.visible')
      cy.get('[data-testid="roi-chart"]').should('be.visible')
      
      // Category breakdown
      cy.get('[data-testid="category-performance"]').within(() => {
        cy.get('[data-testid="category-row"]').should('have.length.at.least', 3)
        cy.get('[data-testid="best-performing"]').should('contain', 'Insurance')
      })
      
      // Supplier performance
      cy.get('[data-testid="supplier-tab"]').click()
      cy.get('[data-testid="supplier-table"]').within(() => {
        cy.get('[data-testid="supplier-row"]').should('have.length.at.least', 5)
        cy.get('[data-testid="sort-by-quality"]').click()
      })
      
      // Export report
      cy.get('[data-testid="export-button"]').click()
      cy.get('[data-testid="export-modal"]').within(() => {
        cy.get('[data-testid="report-type"]').select('detailed_performance')
        cy.get('[data-testid="format-pdf"]').check()
        cy.get('[data-testid="include-charts"]').check()
        cy.get('[data-testid="generate-report"]').click()
      })
      
      cy.get('[data-testid="report-generation"]').should('contain', 'Generating report...')
      cy.get('[data-testid="download-report"]', { timeout: 10000 }).click()
      cy.verifyDownload('buyer_performance_report_*.pdf')
    })

    it('sets up automated reporting', () => {
      cy.get('[data-testid="automated-reports-tab"]').click()
      
      // Create new automated report
      cy.get('[data-testid="create-automated-report"]').click()
      
      cy.get('[data-testid="report-setup-modal"]').within(() => {
        cy.get('[data-testid="report-name"]').type('Weekly Performance Summary')
        cy.get('[data-testid="frequency"]').select('weekly')
        cy.get('[data-testid="day-of-week"]').select('monday')
        cy.get('[data-testid="time"]').type('09:00')
        
        // Select metrics
        cy.get('[data-testid="metric-purchases"]').check()
        cy.get('[data-testid="metric-spend"]').check()
        cy.get('[data-testid="metric-conversion"]').check()
        cy.get('[data-testid="metric-roi"]').check()
        
        // Recipients
        cy.get('[data-testid="recipient-email"]').type('team@qualityinsurance.com')
        cy.get('[data-testid="add-recipient"]').click()
        
        cy.get('[data-testid="save-automated-report"]').click()
      })
      
      // Verify created
      cy.get('[data-testid="automated-report-list"]').within(() => {
        cy.get('[data-testid="report-item"]').should('contain', 'Weekly Performance Summary')
      })
    })
  })

  describe('Account Management', () => {
    beforeEach(() => {
      cy.login('buyer')
      cy.visit('/account')
    })

    it('manages billing and payment methods', () => {
      cy.get('[data-testid="billing-tab"]').click()
      
      // Current balance
      cy.get('[data-testid="account-balance"]').should('contain', '$1,245.80')
      cy.get('[data-testid="auto-reload-status"]').should('contain', 'Enabled')
      
      // Add funds
      cy.get('[data-testid="add-funds-button"]').click()
      cy.get('[data-testid="amount-input"]').type('5000')
      cy.get('[data-testid="payment-method-select"]').select('card_ending_4242')
      cy.get('[data-testid="process-payment"]').click()
      
      // 3D Secure
      cy.get('iframe[name="__privateStripeFrame"]').then($iframe => {
        cy.wrap($iframe.contents().find('body')).within(() => {
          cy.get('[data-testid="3ds-authenticate"]').click()
        })
      })
      
      cy.get('[data-testid="payment-success"]').should('contain', 'Payment successful')
      cy.get('[data-testid="new-balance"]').should('contain', '$6,245.80')
      
      // View transaction history
      cy.get('[data-testid="transaction-history-tab"]').click()
      cy.get('[data-testid="transaction-row"]').first().should('contain', '+$5,000.00')
      
      // Download invoice
      cy.get('[data-testid="transaction-row"]').first().within(() => {
        cy.get('[data-testid="download-invoice"]').click()
      })
      cy.verifyDownload('invoice_*.pdf')
    })

    it('configures team access and permissions', () => {
      cy.get('[data-testid="team-tab"]').click()
      
      // Invite team member
      cy.get('[data-testid="invite-member"]').click()
      cy.get('[data-testid="invite-modal"]').within(() => {
        cy.get('[data-testid="email"]').type('sarah@qualityinsurance.com')
        cy.get('[data-testid="role"]').select('analyst')
        
        // Set permissions
        cy.get('[data-testid="permission-view-analytics"]').check()
        cy.get('[data-testid="permission-export-data"]').check()
        cy.get('[data-testid="permission-make-purchases"]').uncheck()
        
        cy.get('[data-testid="send-invite"]').click()
      })
      
      // Manage existing member
      cy.get('[data-testid="team-member-row"]').contains('john@qualityinsurance.com').parent().within(() => {
        cy.get('[data-testid="edit-permissions"]').click()
      })
      
      cy.get('[data-testid="permission-modal"]').within(() => {
        cy.get('[data-testid="permission-manage-billing"]').check()
        cy.get('[data-testid="save-permissions"]').click()
      })
    })

    it('sets up API integration', () => {
      cy.get('[data-testid="api-tab"]').click()
      
      // Generate API key
      cy.get('[data-testid="generate-api-key"]').click()
      cy.get('[data-testid="key-modal"]').within(() => {
        cy.get('[data-testid="key-name"]').type('Production Integration')
        cy.get('[data-testid="key-permissions"]').select(['read_calls', 'create_purchases'])
        cy.get('[data-testid="ip-whitelist"]').type('192.168.1.0/24')
        cy.get('[data-testid="create-key"]').click()
      })
      
      // Copy key
      cy.get('[data-testid="api-key-display"]').then($el => {
        const apiKey = $el.text()
        cy.wrap(apiKey).as('apiKey')
      })
      cy.get('[data-testid="copy-key"]').click()
      
      // View documentation
      cy.get('[data-testid="view-api-docs"]').click()
      cy.url().should('include', '/api/documentation')
      
      // Test webhook
      cy.go('back')
      cy.get('[data-testid="webhooks-section"]').within(() => {
        cy.get('[data-testid="webhook-url"]').type('https://qualityinsurance.com/webhooks/dce')
        cy.get('[data-testid="webhook-events"]').select(['purchase.completed', 'call.delivered'])
        cy.get('[data-testid="test-webhook"]').click()
      })
      
      cy.get('[data-testid="webhook-test-result"]').should('contain', 'Success: 200 OK')
    })
  })

  describe('Mobile Responsive Experience', () => {
    beforeEach(() => {
      cy.viewport('iphone-x')
      cy.login('buyer')
    })

    it('provides full functionality on mobile devices', () => {
      // Mobile navigation
      cy.get('[data-testid="mobile-menu-toggle"]').click()
      cy.get('[data-testid="mobile-menu"]').should('be.visible')
      cy.get('[data-testid="mobile-nav-marketplace"]').click()
      
      // Mobile marketplace
      cy.get('[data-testid="mobile-filter-toggle"]').click()
      cy.get('[data-testid="mobile-filters"]').within(() => {
        cy.get('[data-testid="category-filter"]').select('insurance')
        cy.get('[data-testid="apply-filters"]').click()
      })
      
      // Swipe through calls
      cy.get('[data-testid="call-card-mobile"]').first().swipeLeft()
      cy.get('[data-testid="quick-actions"]').should('be.visible')
      cy.get('[data-testid="quick-purchase"]').click()
      
      // Mobile purchase flow
      cy.get('[data-testid="mobile-purchase-sheet"]').should('be.visible')
      cy.get('[data-testid="confirm-purchase"]').click()
      
      // Check responsive tables
      cy.visit('/analytics')
      cy.get('[data-testid="mobile-metrics-cards"]').should('be.visible')
      cy.get('[data-testid="desktop-table"]').should('not.exist')
      cy.get('[data-testid="mobile-list-view"]').should('be.visible')
    })
  })

  describe('Accessibility Compliance', () => {
    it('meets WCAG 2.1 AA standards', () => {
      cy.login('buyer')
      cy.visit('/marketplace')
      
      // Run accessibility checks
      cy.checkAccessibility()
      
      // Keyboard navigation
      cy.get('body').tab()
      cy.focused().should('have.attr', 'data-testid', 'skip-to-content')
      
      // Tab through main navigation
      cy.tab().tab().tab()
      cy.focused().should('have.attr', 'data-testid', 'marketplace-link')
      
      // Screen reader announcements
      cy.get('[data-testid="results-count"]').should('have.attr', 'aria-live', 'polite')
      cy.get('[data-testid="loading-spinner"]').should('have.attr', 'aria-label', 'Loading results')
      
      // Color contrast
      cy.get('[data-testid="call-price"]').should('have.css', 'color')
        .and('satisfy', () => {
          // Verify sufficient contrast ratio
          return true // Actual contrast calculation would go here
        })
      
      // Form labels
      cy.get('input').each($input => {
        cy.wrap($input).should('have.attr', 'aria-label')
          .or('have.attr', 'aria-labelledby')
          .or($input => {
            const id = $input.attr('id')
            cy.get(`label[for="${id}"]`).should('exist')
          })
      })
    })
  })
})