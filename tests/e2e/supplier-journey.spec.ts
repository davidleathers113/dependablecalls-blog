/// <reference types="cypress" />

describe('Supplier Complete User Journey', () => {
  beforeEach(() => {
    cy.seedTestData('empty-marketplace')
    cy.visit('/')
  })

  describe('Supplier Onboarding and Setup', () => {
    it('completes full supplier registration and onboarding', () => {
      // Landing page - supplier path
      cy.get('[data-testid="hero-section"]').should('be.visible')
      cy.get('[data-testid="supplier-cta"]').click()
      
      // Supplier benefits page
      cy.url().should('include', '/suppliers')
      cy.get('[data-testid="supplier-benefits"]').should('be.visible')
      cy.get('[data-testid="expected-earnings-calculator"]').within(() => {
        cy.get('[data-testid="monthly-calls"]').type('5000')
        cy.get('[data-testid="avg-price"]').type('40')
        cy.get('[data-testid="calculate-earnings"]').click()
        cy.get('[data-testid="estimated-revenue"]').should('contain', '$200,000')
      })
      
      cy.get('[data-testid="start-selling-button"]').click()
      
      // Registration
      cy.url().should('include', '/register')
      cy.get('[data-testid="user-type-supplier"]').click()
      
      // Company information
      cy.get('[data-testid="company-name"]').type('Premium Lead Generation LLC')
      cy.get('[data-testid="dba-name"]').type('CallPro Solutions')
      cy.get('[data-testid="tax-id"]').type('87-1234567')
      cy.get('[data-testid="business-type"]').select('llc')
      
      // Contact details
      cy.get('[data-testid="primary-contact"]').type('Jane Smith')
      cy.get('[data-testid="email"]').type('jane@callprosolutions.com')
      cy.get('[data-testid="password"]').type('SupplierPass456!')
      cy.get('[data-testid="confirm-password"]').type('SupplierPass456!')
      cy.get('[data-testid="phone"]').type('+1 (555) 987-6543')
      
      // Business details
      cy.get('[data-testid="lead-sources"]').within(() => {
        cy.get('[value="organic_seo"]').check()
        cy.get('[value="paid_search"]').check()
        cy.get('[value="social_media"]').check()
      })
      cy.get('[data-testid="monthly-volume"]').type('10000')
      cy.get('[data-testid="primary-verticals"]').select(['insurance', 'home_services', 'legal'])
      
      // Compliance
      cy.get('[data-testid="tcpa-compliant"]').check()
      cy.get('[data-testid="consent-recording"]').check()
      cy.get('[data-testid="accept-terms"]').check()
      cy.get('[data-testid="submit-registration"]').click()
      
      // Email verification
      cy.get('[data-testid="verification-notice"]').should('be.visible')
      cy.visit('/verify-email?token=supplier-token-456')
      
      // Onboarding flow
      cy.url().should('include', '/supplier/onboarding')
      
      // Step 1: Lead Quality Standards
      cy.get('[data-testid="lead-generation-methods"]').type('We use targeted PPC campaigns and organic SEO to generate high-intent leads')
      cy.get('[data-testid="quality-control-process"]').type('All calls are pre-screened by our AI system and human QA team')
      cy.get('[data-testid="avg-call-duration"]').type('4.5')
      cy.get('[data-testid="conversion-rate"]').type('35')
      cy.get('[data-testid="continue-button"]').click()
      
      // Step 2: Technical Setup
      cy.get('[data-testid="integration-method"]').select('api')
      cy.get('[data-testid="webhook-url"]').type('https://callprosolutions.com/webhooks/dce')
      cy.get('[data-testid="test-webhook"]').click()
      cy.get('[data-testid="webhook-test-success"]').should('be.visible')
      
      // Call tracking setup
      cy.get('[data-testid="tracking-provider"]').select('retreaver')
      cy.get('[data-testid="tracking-account-id"]').type('RET123456')
      cy.get('[data-testid="verify-integration"]').click()
      cy.get('[data-testid="integration-verified"]').should('be.visible')
      cy.get('[data-testid="continue-button"]').click()
      
      // Step 3: Banking and Payout
      cy.get('[data-testid="payout-method"]').select('ach')
      cy.get('[data-testid="bank-name"]').type('Chase Bank')
      cy.get('[data-testid="account-type"]').select('business_checking')
      cy.get('[data-testid="routing-number"]').type('021000021')
      cy.get('[data-testid="account-number"]').type('123456789')
      cy.get('[data-testid="account-holder-name"]').type('Premium Lead Generation LLC')
      
      // Tax information
      cy.get('[data-testid="tax-classification"]').select('llc')
      cy.get('[data-testid="w9-upload"]').attachFile('w9-form.pdf')
      cy.get('[data-testid="complete-setup"]').click()
      
      // Welcome dashboard
      cy.url().should('include', '/supplier/dashboard')
      cy.get('[data-testid="setup-complete-modal"]').should('be.visible')
      cy.get('[data-testid="create-first-listing"]').click()
    })
  })

  describe('Inventory Management', () => {
    beforeEach(() => {
      cy.login('supplier')
      cy.visit('/supplier/inventory')
    })

    it('creates and manages call listings', () => {
      // Create new listing
      cy.get('[data-testid="create-listing-button"]').click()
      
      cy.get('[data-testid="listing-form"]').within(() => {
        // Basic information
        cy.get('[data-testid="listing-title"]').type('High-Intent Auto Insurance Leads - California')
        cy.get('[data-testid="category"]').select('insurance')
        cy.get('[data-testid="subcategory"]').select('auto_insurance')
        
        // Call details
        cy.get('[data-testid="tracking-number"]').type('+18885551234')
        cy.get('[data-testid="destination-number"]').type('+18185559876')
        cy.get('[data-testid="expected-volume"]').type('200')
        cy.get('[data-testid="call-hours"]').select('business_hours')
        cy.get('[data-testid="timezone"]').select('America/Los_Angeles')
        
        // Quality metrics
        cy.get('[data-testid="avg-duration"]').type('3.5')
        cy.get('[data-testid="conversion-rate"]').type('40')
        cy.get('[data-testid="quality-score"]').should('have.value', '88') // Auto-calculated
        
        // Pricing
        cy.get('[data-testid="base-price"]').type('45')
        cy.get('[data-testid="volume-pricing"]').click()
        cy.get('[data-testid="tier-1-quantity"]').type('50')
        cy.get('[data-testid="tier-1-discount"]').type('10')
        cy.get('[data-testid="tier-2-quantity"]').type('100')
        cy.get('[data-testid="tier-2-discount"]').type('15')
        
        // Geographic targeting
        cy.get('[data-testid="geo-targeting"]').click()
        cy.get('[data-testid="states-select"]').select(['CA', 'NV', 'AZ'])
        cy.get('[data-testid="metro-areas"]').type('Los Angeles{enter}San Diego{enter}Phoenix{enter}')
        
        // Lead details
        cy.get('[data-testid="lead-source"]').select('paid_search')
        cy.get('[data-testid="keywords"]').type('auto insurance quotes{enter}cheap car insurance{enter}insurance comparison{enter}')
        cy.get('[data-testid="landing-page-url"]').type('https://autoinsurancequotes.com/california')
        
        // Compliance
        cy.get('[data-testid="tcpa-compliant"]').check()
        cy.get('[data-testid="consent-text"]').type('By submitting this form, you consent to receive calls...')
        cy.get('[data-testid="dnc-scrubbed"]').check()
        
        // Advanced settings
        cy.get('[data-testid="duplicate-window"]').type('30')
        cy.get('[data-testid="concurrent-limit"]').type('5')
        cy.get('[data-testid="buffer-percentage"]').type('20')
        
        cy.get('[data-testid="create-listing"]').click()
      })
      
      // Verify listing created
      cy.get('[data-testid="success-notification"]').should('contain', 'Listing created successfully')
      cy.get('[data-testid="listing-status"]').should('contain', 'Pending Review')
      
      // Quick approval for testing
      cy.get('[data-testid="admin-approve-listing"]').click() // Test helper
      cy.get('[data-testid="listing-status"]').should('contain', 'Active')
      
      // Edit listing
      cy.get('[data-testid="listing-row"]').first().within(() => {
        cy.get('[data-testid="edit-listing"]').click()
      })
      
      cy.get('[data-testid="edit-form"]').within(() => {
        cy.get('[data-testid="base-price"]').clear().type('48')
        cy.get('[data-testid="promotional-message"]').type('🔥 Limited time: Premium quality leads!')
        cy.get('[data-testid="save-changes"]').click()
      })
      
      // Pause listing
      cy.get('[data-testid="listing-row"]').first().within(() => {
        cy.get('[data-testid="pause-listing"]').click()
      })
      cy.get('[data-testid="pause-confirmation"]').within(() => {
        cy.get('[data-testid="pause-reason"]').select('inventory_management')
        cy.get('[data-testid="confirm-pause"]').click()
      })
      
      cy.get('[data-testid="listing-status"]').should('contain', 'Paused')
    })

    it('performs bulk upload of inventory', () => {
      // Open bulk upload
      cy.get('[data-testid="bulk-upload-button"]').click()
      
      // Download template
      cy.get('[data-testid="download-template"]').click()
      cy.verifyDownload('inventory_template.csv')
      
      // Upload filled template
      const csvContent = `tracking_number,category,destination_number,price,volume,duration,location
+18885551111,insurance,+18185551111,42,150,3.2,"CA,NV"
+18885552222,home_services,+18185552222,35,200,4.1,"TX,OK"
+18885553333,legal,+18185553333,55,100,5.5,"NY,NJ,CT"
+18885554444,financial,+18185554444,65,75,4.8,"FL,GA"`
      
      const file = new File([csvContent], 'bulk_inventory.csv', { type: 'text/csv' })
      
      cy.get('[data-testid="csv-upload"]').attachFile(file)
      
      // Preview upload
      cy.get('[data-testid="upload-preview"]').within(() => {
        cy.get('[data-testid="preview-row"]').should('have.length', 4)
        cy.get('[data-testid="validation-status"]').should('contain', '4 valid, 0 errors')
      })
      
      // Map custom fields
      cy.get('[data-testid="field-mapping"]').within(() => {
        cy.get('[data-testid="map-duration"]').select('duration')
        cy.get('[data-testid="map-location"]').select('location')
      })
      
      // Process upload
      cy.get('[data-testid="process-upload"]').click()
      
      // Monitor progress
      cy.get('[data-testid="upload-progress"]').should('be.visible')
      cy.get('[data-testid="progress-bar"]').should('have.attr', 'aria-valuenow', '100')
      
      // Verify results
      cy.get('[data-testid="upload-complete"]').within(() => {
        cy.get('[data-testid="successful-uploads"]').should('contain', '4')
        cy.get('[data-testid="failed-uploads"]').should('contain', '0')
      })
      
      // View uploaded listings
      cy.get('[data-testid="view-uploaded"]').click()
      cy.get('[data-testid="listing-row"]').should('have.length.at.least', 4)
    })

    it('manages dynamic pricing strategies', () => {
      // Navigate to pricing strategies
      cy.get('[data-testid="pricing-strategies-tab"]').click()
      
      // Create time-based pricing rule
      cy.get('[data-testid="add-pricing-rule"]').click()
      cy.get('[data-testid="rule-type"]').select('time_based')
      cy.get('[data-testid="rule-name"]').type('Peak Hours Premium')
      
      cy.get('[data-testid="time-slots"]').within(() => {
        // Morning peak
        cy.get('[data-testid="add-slot"]').click()
        cy.get('[data-testid="slot-1-start"]').type('08:00')
        cy.get('[data-testid="slot-1-end"]').type('10:00')
        cy.get('[data-testid="slot-1-adjustment"]').type('+15')
        
        // Evening peak
        cy.get('[data-testid="add-slot"]').click()
        cy.get('[data-testid="slot-2-start"]').type('17:00')
        cy.get('[data-testid="slot-2-end"]').type('19:00')
        cy.get('[data-testid="slot-2-adjustment"]').type('+20')
      })
      
      cy.get('[data-testid="apply-to-categories"]').select(['insurance', 'financial'])
      cy.get('[data-testid="save-rule"]').click()
      
      // Create volume-based pricing
      cy.get('[data-testid="add-pricing-rule"]').click()
      cy.get('[data-testid="rule-type"]').select('volume_based')
      cy.get('[data-testid="rule-name"]').type('Bulk Buyer Discount')
      
      cy.get('[data-testid="volume-tiers"]').within(() => {
        cy.get('[data-testid="tier-1-min"]').type('50')
        cy.get('[data-testid="tier-1-discount"]').type('10')
        cy.get('[data-testid="tier-2-min"]').type('100')
        cy.get('[data-testid="tier-2-discount"]').type('15')
        cy.get('[data-testid="tier-3-min"]').type('200')
        cy.get('[data-testid="tier-3-discount"]').type('20')
      })
      
      cy.get('[data-testid="save-rule"]').click()
      
      // Create quality-based pricing
      cy.get('[data-testid="add-pricing-rule"]').click()
      cy.get('[data-testid="rule-type"]').select('quality_based')
      cy.get('[data-testid="rule-name"]').type('Premium Quality Pricing')
      
      cy.get('[data-testid="quality-thresholds"]').within(() => {
        cy.get('[data-testid="premium-threshold"]').type('90')
        cy.get('[data-testid="premium-markup"]').type('+25')
        cy.get('[data-testid="standard-threshold"]').type('75')
        cy.get('[data-testid="substandard-threshold"]').type('60')
        cy.get('[data-testid="substandard-discount"]').type('-20')
      })
      
      cy.get('[data-testid="auto-adjust"]').check()
      cy.get('[data-testid="save-rule"]').click()
      
      // View pricing simulation
      cy.get('[data-testid="pricing-simulator"]').click()
      cy.get('[data-testid="simulate-listing"]').select('High-Intent Auto Insurance Leads')
      cy.get('[data-testid="simulate-volume"]').type('150')
      cy.get('[data-testid="simulate-time"]').type('09:00')
      cy.get('[data-testid="simulate-quality"]').type('92')
      
      cy.get('[data-testid="calculate-price"]').click()
      
      cy.get('[data-testid="simulation-result"]').within(() => {
        cy.get('[data-testid="base-price"]').should('contain', '$45.00')
        cy.get('[data-testid="time-adjustment"]').should('contain', '+$6.75')
        cy.get('[data-testid="volume-discount"]').should('contain', '-$6.75')
        cy.get('[data-testid="quality-premium"]').should('contain', '+$11.25')
        cy.get('[data-testid="final-price"]').should('contain', '$56.25')
      })
    })
  })

  describe('Sales Analytics and Performance', () => {
    beforeEach(() => {
      cy.login('supplier')
      cy.visit('/supplier/analytics')
    })

    it('analyzes sales performance and trends', () => {
      // Overview metrics
      cy.get('[data-testid="revenue-mtd"]').should('contain', '$45,230')
      cy.get('[data-testid="calls-sold"]').should('contain', '1,126')
      cy.get('[data-testid="avg-price"]').should('contain', '$40.17')
      cy.get('[data-testid="conversion-rate"]').should('contain', '38.5%')
      
      // Revenue chart
      cy.get('[data-testid="revenue-chart-toggle"]').select('daily')
      cy.get('[data-testid="revenue-chart"]').should('be.visible')
      
      // Category performance
      cy.get('[data-testid="category-breakdown"]').within(() => {
        cy.get('[data-testid="category-insurance"]').should('contain', '45%')
        cy.get('[data-testid="category-home-services"]').should('contain', '30%')
        cy.get('[data-testid="category-legal"]').should('contain', '15%')
        cy.get('[data-testid="category-financial"]').should('contain', '10%')
      })
      
      // Buyer insights
      cy.get('[data-testid="buyer-insights-tab"]').click()
      cy.get('[data-testid="top-buyers-table"]').within(() => {
        cy.get('[data-testid="buyer-row"]').should('have.length.at.least', 5)
        cy.get('[data-testid="buyer-row"]').first().within(() => {
          cy.get('[data-testid="buyer-name"]').should('contain', 'Insurance Direct LLC')
          cy.get('[data-testid="buyer-volume"]').should('contain', '342 calls')
          cy.get('[data-testid="buyer-revenue"]').should('contain', '$15,390')
          cy.get('[data-testid="buyer-satisfaction"]').should('contain', '94%')
        })
      })
      
      // Listing performance
      cy.get('[data-testid="listing-performance-tab"]').click()
      cy.get('[data-testid="listing-metrics-table"]').within(() => {
        cy.get('[data-testid="sort-by-revenue"]').click()
        cy.get('[data-testid="listing-row"]').first().within(() => {
          cy.get('[data-testid="view-details"]').click()
        })
      })
      
      // Detailed listing analytics
      cy.get('[data-testid="listing-detail-modal"]').within(() => {
        cy.get('[data-testid="hourly-distribution"]').should('be.visible')
        cy.get('[data-testid="geographic-heatmap"]').should('be.visible')
        cy.get('[data-testid="quality-distribution"]').should('be.visible')
        cy.get('[data-testid="buyer-breakdown"]').should('be.visible')
      })
    })

    it('generates and exports performance reports', () => {
      // Custom report builder
      cy.get('[data-testid="create-report-button"]').click()
      
      cy.get('[data-testid="report-builder"]').within(() => {
        cy.get('[data-testid="report-name"]').type('Q1 2024 Performance Analysis')
        cy.get('[data-testid="date-range"]').click()
        cy.get('[data-testid="preset-q1-2024"]').click()
        
        // Select metrics
        cy.get('[data-testid="metric-revenue"]').check()
        cy.get('[data-testid="metric-volume"]').check()
        cy.get('[data-testid="metric-avg-price"]').check()
        cy.get('[data-testid="metric-quality"]').check()
        cy.get('[data-testid="metric-buyer-satisfaction"]').check()
        
        // Grouping
        cy.get('[data-testid="group-by"]').select('week')
        cy.get('[data-testid="secondary-group"]').select('category')
        
        // Filters
        cy.get('[data-testid="filter-categories"]').select(['insurance', 'home_services'])
        cy.get('[data-testid="filter-min-revenue"]').type('1000')
        
        // Visualizations
        cy.get('[data-testid="include-charts"]').check()
        cy.get('[data-testid="chart-types"]').within(() => {
          cy.get('[value="line"]').check()
          cy.get('[value="bar"]').check()
          cy.get('[value="pie"]').check()
        })
        
        cy.get('[data-testid="generate-report"]').click()
      })
      
      // Report generation progress
      cy.get('[data-testid="report-progress"]').should('be.visible')
      cy.get('[data-testid="progress-status"]').should('contain', 'Analyzing data...')
      cy.get('[data-testid="progress-status"]').should('contain', 'Generating visualizations...')
      cy.get('[data-testid="progress-status"]').should('contain', 'Finalizing report...')
      
      // View generated report
      cy.get('[data-testid="view-report"]').click()
      cy.get('[data-testid="report-viewer"]').within(() => {
        cy.get('[data-testid="report-title"]').should('contain', 'Q1 2024 Performance Analysis')
        cy.get('[data-testid="executive-summary"]').should('be.visible')
        cy.get('[data-testid="revenue-chart"]').should('be.visible')
        cy.get('[data-testid="volume-chart"]').should('be.visible')
        cy.get('[data-testid="category-breakdown"]').should('be.visible')
      })
      
      // Export options
      cy.get('[data-testid="export-report"]').click()
      cy.get('[data-testid="export-format"]').select('pdf')
      cy.get('[data-testid="include-raw-data"]').check()
      cy.get('[data-testid="download-report"]').click()
      cy.verifyDownload('Q1_2024_Performance_Analysis.pdf')
    })
  })

  describe('Lead Management and Quality Control', () => {
    beforeEach(() => {
      cy.login('supplier')
      cy.visit('/supplier/leads')
    })

    it('monitors and manages lead quality', () => {
      // Quality dashboard
      cy.get('[data-testid="quality-score-overall"]').should('contain', '87.3')
      cy.get('[data-testid="quality-trend"]').should('have.class', 'trend-up')
      
      // Recent calls
      cy.get('[data-testid="recent-calls-table"]').within(() => {
        cy.get('[data-testid="call-row"]').should('have.length.at.least', 10)
      })
      
      // Listen to call recording
      cy.get('[data-testid="call-row"]').first().within(() => {
        cy.get('[data-testid="play-recording"]').click()
      })
      
      cy.get('[data-testid="audio-player-modal"]').within(() => {
        cy.get('[data-testid="audio-player"]').should('be.visible')
        cy.get('[data-testid="call-transcript"]').should('be.visible')
        cy.get('[data-testid="quality-indicators"]').within(() => {
          cy.get('[data-testid="duration-indicator"]').should('have.class', 'good')
          cy.get('[data-testid="intent-indicator"]').should('have.class', 'excellent')
          cy.get('[data-testid="contact-info-indicator"]').should('have.class', 'good')
        })
        
        // Add quality note
        cy.get('[data-testid="add-note"]').click()
        cy.get('[data-testid="note-text"]').type('Excellent lead quality - buyer ready to purchase')
        cy.get('[data-testid="save-note"]').click()
      })
      
      // Flag problematic call
      cy.get('[data-testid="call-row"]').eq(3).within(() => {
        cy.get('[data-testid="flag-call"]').click()
      })
      
      cy.get('[data-testid="flag-modal"]').within(() => {
        cy.get('[data-testid="flag-reason"]').select('wrong_number')
        cy.get('[data-testid="flag-notes"]').type('Customer said they never requested information')
        cy.get('[data-testid="remove-from-billing"]').check()
        cy.get('[data-testid="submit-flag"]').click()
      })
      
      // Quality improvement suggestions
      cy.get('[data-testid="quality-insights-tab"]').click()
      cy.get('[data-testid="improvement-suggestions"]').within(() => {
        cy.get('[data-testid="suggestion"]').should('have.length.at.least', 3)
        cy.get('[data-testid="suggestion"]').first().within(() => {
          cy.get('[data-testid="suggestion-title"]').should('contain', 'Increase average call duration')
          cy.get('[data-testid="potential-impact"]').should('contain', '+5% quality score')
          cy.get('[data-testid="view-details"]').click()
        })
      })
      
      // A/B test results
      cy.get('[data-testid="ab-tests-tab"]').click()
      cy.get('[data-testid="active-test"]').within(() => {
        cy.get('[data-testid="test-name"]').should('contain', 'Landing Page CTA Test')
        cy.get('[data-testid="variant-a-conversion"]').should('contain', '32%')
        cy.get('[data-testid="variant-b-conversion"]').should('contain', '38%')
        cy.get('[data-testid="confidence-level"]').should('contain', '95%')
        cy.get('[data-testid="declare-winner"]').click()
      })
    })

    it('manages lead routing and distribution', () => {
      cy.get('[data-testid="routing-rules-tab"]').click()
      
      // Create routing rule
      cy.get('[data-testid="add-routing-rule"]').click()
      cy.get('[data-testid="rule-builder"]').within(() => {
        cy.get('[data-testid="rule-name"]').type('Premium Insurance Buyers Priority')
        
        // Conditions
        cy.get('[data-testid="add-condition"]').click()
        cy.get('[data-testid="condition-1-field"]').select('category')
        cy.get('[data-testid="condition-1-operator"]').select('equals')
        cy.get('[data-testid="condition-1-value"]').select('insurance')
        
        cy.get('[data-testid="add-condition"]').click()
        cy.get('[data-testid="condition-2-field"]').select('quality_score')
        cy.get('[data-testid="condition-2-operator"]').select('greater_than')
        cy.get('[data-testid="condition-2-value"]').type('85')
        
        // Actions
        cy.get('[data-testid="route-to-buyers"]').click()
        cy.get('[data-testid="buyer-select"]').select(['Insurance Direct LLC', 'QuickQuote Insurance'])
        cy.get('[data-testid="priority-routing"]').check()
        cy.get('[data-testid="price-override"]').type('52')
        
        cy.get('[data-testid="save-rule"]').click()
      })
      
      // Test routing rule
      cy.get('[data-testid="test-routing"]').click()
      cy.get('[data-testid="test-call-data"]').type(`{
        "category": "insurance",
        "quality_score": 92,
        "duration": 245,
        "caller_location": "CA"
      }`)
      cy.get('[data-testid="run-test"]').click()
      
      cy.get('[data-testid="routing-result"]').within(() => {
        cy.get('[data-testid="matched-rule"]').should('contain', 'Premium Insurance Buyers Priority')
        cy.get('[data-testid="routed-to"]').should('contain', 'Insurance Direct LLC')
        cy.get('[data-testid="final-price"]').should('contain', '$52.00')
      })
    })
  })

  describe('Financial Management', () => {
    beforeEach(() => {
      cy.login('supplier')
      cy.visit('/supplier/financials')
    })

    it('tracks earnings and manages payouts', () => {
      // Financial overview
      cy.get('[data-testid="current-balance"]').should('contain', '$12,456.78')
      cy.get('[data-testid="pending-payout"]').should('contain', '$8,234.50')
      cy.get('[data-testid="lifetime-earnings"]').should('contain', '$284,567.89')
      
      // Earnings breakdown
      cy.get('[data-testid="earnings-chart"]').should('be.visible')
      cy.get('[data-testid="earnings-by-category"]').within(() => {
        cy.get('[data-testid="category-row"]').should('have.length.at.least', 4)
      })
      
      // Transaction history
      cy.get('[data-testid="transactions-tab"]').click()
      cy.get('[data-testid="transaction-filter"]').select('last_30_days')
      cy.get('[data-testid="transaction-table"]').within(() => {
        cy.get('[data-testid="transaction-row"]').should('have.length.at.least', 20)
        
        // View transaction details
        cy.get('[data-testid="transaction-row"]').first().click()
      })
      
      cy.get('[data-testid="transaction-detail-modal"]').within(() => {
        cy.get('[data-testid="transaction-id"]').should('be.visible')
        cy.get('[data-testid="call-details"]').should('be.visible')
        cy.get('[data-testid="buyer-info"]').should('contain', 'Insurance Direct LLC')
        cy.get('[data-testid="gross-amount"]').should('contain', '$45.00')
        cy.get('[data-testid="platform-fee"]').should('contain', '-$3.60')
        cy.get('[data-testid="net-amount"]').should('contain', '$41.40')
      })
      
      // Request payout
      cy.get('[data-testid="payouts-tab"]').click()
      cy.get('[data-testid="request-payout-button"]').click()
      
      cy.get('[data-testid="payout-modal"]').within(() => {
        cy.get('[data-testid="available-balance"]').should('contain', '$8,234.50')
        cy.get('[data-testid="payout-amount"]').clear().type('5000')
        cy.get('[data-testid="payout-method"]').should('contain', 'ACH - Chase Bank ****6789')
        cy.get('[data-testid="estimated-arrival"]').should('contain', '2-3 business days')
        cy.get('[data-testid="request-payout"]').click()
      })
      
      cy.get('[data-testid="payout-confirmation"]').within(() => {
        cy.get('[data-testid="payout-id"]').should('be.visible')
        cy.get('[data-testid="processing-time"]').should('contain', '2-3 business days')
        cy.get('[data-testid="remaining-balance"]').should('contain', '$3,234.50')
      })
      
      // Download tax documents
      cy.get('[data-testid="tax-documents-tab"]').click()
      cy.get('[data-testid="tax-year-select"]').select('2023')
      cy.get('[data-testid="download-1099"]').click()
      cy.verifyDownload('1099-MISC-2023.pdf')
    })
  })

  describe('API Integration and Automation', () => {
    beforeEach(() => {
      cy.login('supplier')
      cy.visit('/supplier/integrations')
    })

    it('sets up and tests API integration', () => {
      // API credentials
      cy.get('[data-testid="api-credentials-tab"]').click()
      cy.get('[data-testid="generate-api-key"]').click()
      
      cy.get('[data-testid="api-key-modal"]').within(() => {
        cy.get('[data-testid="key-name"]').type('Production API')
        cy.get('[data-testid="key-permissions"]').within(() => {
          cy.get('[value="create_listings"]').check()
          cy.get('[value="update_listings"]').check()
          cy.get('[value="read_analytics"]').check()
          cy.get('[value="manage_routing"]').check()
        })
        cy.get('[data-testid="ip-whitelist"]').type('192.168.1.100')
        cy.get('[data-testid="create-key"]').click()
      })
      
      // Copy API key and secret
      cy.get('[data-testid="api-key-display"]').then($el => {
        const apiKey = $el.text()
        cy.wrap(apiKey).as('apiKey')
      })
      cy.get('[data-testid="api-secret-display"]').then($el => {
        const apiSecret = $el.text()
        cy.wrap(apiSecret).as('apiSecret')
      })
      
      // Test API connection
      cy.get('[data-testid="test-api-tab"]').click()
      cy.get('[data-testid="endpoint-select"]').select('GET /api/v1/supplier/inventory')
      cy.get('[data-testid="send-request"]').click()
      
      cy.get('[data-testid="api-response"]').within(() => {
        cy.get('[data-testid="status-code"]').should('contain', '200 OK')
        cy.get('[data-testid="response-time"]').should('exist')
        cy.get('[data-testid="response-body"]').should('contain', '"calls":')
      })
      
      // Webhook configuration
      cy.get('[data-testid="webhooks-tab"]').click()
      cy.get('[data-testid="add-webhook"]').click()
      
      cy.get('[data-testid="webhook-form"]').within(() => {
        cy.get('[data-testid="webhook-url"]').type('https://callprosolutions.com/webhooks/dce-events')
        cy.get('[data-testid="webhook-events"]').within(() => {
          cy.get('[value="call.sold"]').check()
          cy.get('[value="listing.paused"]').check()
          cy.get('[value="payout.completed"]').check()
        })
        cy.get('[data-testid="webhook-secret"]').then($el => {
          const secret = $el.val()
          cy.wrap(secret).as('webhookSecret')
        })
        cy.get('[data-testid="test-webhook"]').click()
      })
      
      cy.get('[data-testid="webhook-test-result"]').should('contain', '200 OK')
      cy.get('[data-testid="save-webhook"]').click()
      
      // Zapier integration
      cy.get('[data-testid="zapier-integration"]').click()
      cy.get('[data-testid="connect-zapier"]').click()
      
      // OAuth flow simulation
      cy.origin('https://zapier.com', () => {
        cy.get('[data-testid="authorize-app"]').click()
      })
      
      cy.get('[data-testid="zapier-connected"]').should('be.visible')
      cy.get('[data-testid="available-triggers"]').should('contain', 'New Call Sold')
      cy.get('[data-testid="available-actions"]').should('contain', 'Create Listing')
    })
  })

  describe('Mobile App Experience', () => {
    beforeEach(() => {
      cy.viewport('iphone-12')
      cy.login('supplier')
    })

    it('manages inventory on mobile', () => {
      cy.visit('/supplier/dashboard')
      
      // Mobile dashboard
      cy.get('[data-testid="mobile-revenue-card"]').should('be.visible')
      cy.get('[data-testid="mobile-calls-card"]').should('be.visible')
      
      // Quick actions
      cy.get('[data-testid="mobile-quick-actions"]').within(() => {
        cy.get('[data-testid="pause-all-listings"]').should('be.visible')
        cy.get('[data-testid="view-recent-sales"]').should('be.visible')
      })
      
      // Mobile menu
      cy.get('[data-testid="mobile-menu-toggle"]').click()
      cy.get('[data-testid="mobile-nav-inventory"]').click()
      
      // Swipe actions on listings
      cy.get('[data-testid="mobile-listing-card"]').first().swipeLeft()
      cy.get('[data-testid="quick-edit-price"]').click()
      
      cy.get('[data-testid="price-adjustment-sheet"]').within(() => {
        cy.get('[data-testid="new-price"]').clear().type('47')
        cy.get('[data-testid="apply-price"]').click()
      })
      
      // Pull to refresh
      cy.get('[data-testid="inventory-list"]').swipeDown()
      cy.get('[data-testid="refresh-indicator"]').should('be.visible')
      
      // Mobile-optimized forms
      cy.get('[data-testid="mobile-create-listing"]').click()
      cy.get('[data-testid="mobile-listing-form"]').within(() => {
        // Verify mobile-friendly inputs
        cy.get('input[type="tel"]').should('exist')
        cy.get('input[inputmode="numeric"]').should('exist')
      })
    })
  })

  describe('Performance Optimization', () => {
    it('loads dashboard with optimal performance', () => {
      cy.login('supplier')
      
      // Measure page load performance
      cy.visit('/supplier/dashboard', {
        onBeforeLoad: (win) => {
          win.performance.mark('start')
        },
        onLoad: (win) => {
          win.performance.mark('end')
          win.performance.measure('pageLoad', 'start', 'end')
        }
      })
      
      cy.window().then((win) => {
        const measure = win.performance.getEntriesByName('pageLoad')[0]
        expect(measure.duration).to.be.lessThan(3000) // Under 3 seconds
      })
      
      // Check lazy loading
      cy.get('[data-testid="revenue-chart"]').should('have.attr', 'data-lazy-loaded', 'false')
      cy.scrollTo('bottom')
      cy.get('[data-testid="revenue-chart"]').should('have.attr', 'data-lazy-loaded', 'true')
      
      // Verify critical resources are preloaded
      cy.get('link[rel="preload"]').should('have.length.at.least', 3)
      cy.get('link[rel="prefetch"]').should('exist')
    })
  })
})