const axeConfig = {
  // WCAG 2.1 AA compliance rules
  rules: {
    // Color and contrast
    'color-contrast': {
      enabled: true,
      tags: ['wcag2a', 'wcag143']
    },
    'color-contrast-enhanced': {
      enabled: true,
      tags: ['wcag2aaa', 'wcag146']
    },
    
    // Images and media
    'image-alt': {
      enabled: true,
      tags: ['wcag2a', 'wcag111']
    },
    'image-redundant-alt': {
      enabled: true,
      tags: ['best-practice']
    },
    'audio-caption': {
      enabled: true,
      tags: ['wcag2a', 'wcag121']
    },
    'video-caption': {
      enabled: true,
      tags: ['wcag2a', 'wcag121']
    },
    
    // Forms
    'label': {
      enabled: true,
      tags: ['wcag2a', 'wcag332']
    },
    'label-title-only': {
      enabled: true,
      tags: ['best-practice']
    },
    'form-field-multiple-labels': {
      enabled: true,
      tags: ['wcag2a', 'wcag332']
    },
    'autocomplete-valid': {
      enabled: true,
      tags: ['wcag21aa', 'wcag135']
    },
    
    // Keyboard navigation
    'focus-order-semantics': {
      enabled: true,
      tags: ['best-practice']
    },
    'focusable-content': {
      enabled: true,
      tags: ['wcag2a', 'wcag211']
    },
    'tabindex': {
      enabled: true,
      tags: ['best-practice']
    },
    
    // ARIA
    'aria-allowed-attr': {
      enabled: true,
      tags: ['wcag2a', 'wcag412']
    },
    'aria-command-name': {
      enabled: true,
      tags: ['wcag2a', 'wcag412']
    },
    'aria-hidden-body': {
      enabled: true,
      tags: ['wcag2a', 'wcag412']
    },
    'aria-hidden-focus': {
      enabled: true,
      tags: ['wcag2a', 'wcag412']
    },
    'aria-input-field-name': {
      enabled: true,
      tags: ['wcag2a', 'wcag412']
    },
    'aria-required-attr': {
      enabled: true,
      tags: ['wcag2a', 'wcag412']
    },
    'aria-required-children': {
      enabled: true,
      tags: ['wcag2a', 'wcag131']
    },
    'aria-required-parent': {
      enabled: true,
      tags: ['wcag2a', 'wcag131']
    },
    'aria-roles': {
      enabled: true,
      tags: ['wcag2a', 'wcag412']
    },
    'aria-toggle-field-name': {
      enabled: true,
      tags: ['wcag2a', 'wcag412']
    },
    'aria-valid-attr': {
      enabled: true,
      tags: ['wcag2a', 'wcag412']
    },
    'aria-valid-attr-value': {
      enabled: true,
      tags: ['wcag2a', 'wcag412']
    },
    
    // Semantic structure
    'heading-order': {
      enabled: true,
      tags: ['best-practice']
    },
    'landmark-one-main': {
      enabled: true,
      tags: ['best-practice']
    },
    'landmark-complementary-is-top-level': {
      enabled: true,
      tags: ['best-practice']
    },
    'landmark-main-is-top-level': {
      enabled: true,
      tags: ['best-practice']
    },
    'landmark-no-duplicate-banner': {
      enabled: true,
      tags: ['best-practice']
    },
    'landmark-no-duplicate-contentinfo': {
      enabled: true,
      tags: ['best-practice']
    },
    'landmark-unique': {
      enabled: true,
      tags: ['best-practice']
    },
    'page-has-heading-one': {
      enabled: true,
      tags: ['best-practice']
    },
    'region': {
      enabled: true,
      tags: ['best-practice']
    },
    
    // Lists
    'list': {
      enabled: true,
      tags: ['wcag2a', 'wcag131']
    },
    'listitem': {
      enabled: true,
      tags: ['wcag2a', 'wcag131']
    },
    'definition-list': {
      enabled: true,
      tags: ['wcag2a', 'wcag131']
    },
    
    // Tables
    'table-duplicate-name': {
      enabled: true,
      tags: ['best-practice']
    },
    'table-fake-caption': {
      enabled: true,
      tags: ['best-practice']
    },
    'td-headers-attr': {
      enabled: true,
      tags: ['wcag2a', 'wcag131']
    },
    'th-has-data-cells': {
      enabled: true,
      tags: ['wcag2a', 'wcag131']
    },
    
    // Links
    'link-in-text-block': {
      enabled: true,
      tags: ['wcag2a', 'wcag141']
    },
    'link-name': {
      enabled: true,
      tags: ['wcag2a', 'wcag412']
    },
    
    // Document structure
    'document-title': {
      enabled: true,
      tags: ['wcag2a', 'wcag242']
    },
    'html-has-lang': {
      enabled: true,
      tags: ['wcag2a', 'wcag311']
    },
    'html-lang-valid': {
      enabled: true,
      tags: ['wcag2a', 'wcag311']
    },
    'html-xml-lang-mismatch': {
      enabled: true,
      tags: ['wcag2a', 'wcag311']
    },
    'valid-lang': {
      enabled: true,
      tags: ['wcag2a', 'wcag311']
    },
    
    // Interactive elements
    'button-name': {
      enabled: true,
      tags: ['wcag2a', 'wcag412']
    },
    'input-button-name': {
      enabled: true,
      tags: ['wcag2a', 'wcag412']
    },
    
    // Skip links
    'skip-link': {
      enabled: true,
      tags: ['best-practice']
    },
    
    // DCE-specific rules
    'dce-table-pagination': {
      enabled: true,
      tags: ['custom']
    },
    'dce-modal-focus': {
      enabled: true,
      tags: ['custom']
    },
    'dce-chart-accessibility': {
      enabled: true,
      tags: ['custom']
    }
  },
  
  // Tags to include in testing
  tags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
  
  // Global configuration
  reporter: 'v2',
  
  // Custom rule configurations
  locale: 'en',
  
  // Performance optimizations
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'wcag21aa']
  }
}

// Page-specific configurations
const pageConfigs = {
  // Public pages
  '/': {
    description: 'Homepage accessibility',
    context: {
      include: [['main'], ['nav'], ['footer']],
      exclude: [['.third-party-widget']]
    },
    options: {
      ...axeConfig,
      rules: {
        ...axeConfig.rules,
        'region': { enabled: false } // Homepage may have marketing content without regions
      }
    }
  },
  
  '/login': {
    description: 'Login page accessibility',
    context: {
      include: [['main'], ['form']],
      exclude: []
    },
    options: {
      ...axeConfig,
      rules: {
        ...axeConfig.rules,
        'autocomplete-valid': { enabled: true } // Critical for login forms
      }
    }
  },
  
  // Buyer pages
  '/dashboard': {
    description: 'Buyer dashboard accessibility',
    context: {
      include: [['main'], ['nav'], ['.dashboard-content']],
      exclude: [['.chart-tooltip'], ['.data-loading']]
    },
    options: {
      ...axeConfig,
      rules: {
        ...axeConfig.rules,
        'dce-chart-accessibility': { enabled: true },
        'aria-live-region': { enabled: true }
      }
    }
  },
  
  '/marketplace': {
    description: 'Marketplace accessibility',
    context: {
      include: [['main'], ['.marketplace-content']],
      exclude: [['.infinite-scroll-loader']]
    },
    options: {
      ...axeConfig,
      rules: {
        ...axeConfig.rules,
        'dce-table-pagination': { enabled: true },
        'aria-expanded': { enabled: true } // For filter dropdowns
      }
    }
  },
  
  // Supplier pages
  '/supplier/inventory': {
    description: 'Supplier inventory management',
    context: {
      include: [['main'], ['.inventory-table']],
      exclude: [['.drag-drop-overlay']]
    },
    options: {
      ...axeConfig,
      rules: {
        ...axeConfig.rules,
        'dce-table-pagination': { enabled: true },
        'table-duplicate-name': { enabled: true }
      }
    }
  },
  
  // Network pages
  '/network/relationships': {
    description: 'Network relationship management',
    context: {
      include: [['main'], ['.relationship-graph']],
      exclude: [['.d3-visualization']]
    },
    options: {
      ...axeConfig,
      rules: {
        ...axeConfig.rules,
        'dce-chart-accessibility': { enabled: true },
        'svg-img-alt': { enabled: true }
      }
    }
  },
  
  // Admin pages
  '/admin/users': {
    description: 'Admin user management',
    context: {
      include: [['main'], ['.user-table']],
      exclude: []
    },
    options: {
      ...axeConfig,
      rules: {
        ...axeConfig.rules,
        'dce-table-pagination': { enabled: true },
        'button-name': { enabled: true } // Critical for admin actions
      }
    }
  }
}

// Test scenarios for different user interactions
const interactionScenarios = {
  keyboard_navigation: {
    description: 'Test keyboard-only navigation',
    steps: [
      'tab through all interactive elements',
      'verify focus indicators',
      'test skip links',
      'test modal focus trapping',
      'test dropdown navigation'
    ]
  },
  
  screen_reader: {
    description: 'Test screen reader compatibility',
    tools: ['nvda', 'jaws', 'voiceover'],
    steps: [
      'verify heading structure',
      'test form labels and descriptions',
      'verify button and link text',
      'test table headers and captions',
      'verify landmark navigation'
    ]
  },
  
  high_contrast: {
    description: 'Test high contrast mode',
    steps: [
      'enable Windows high contrast',
      'verify all content is visible',
      'check focus indicators',
      'verify interactive elements'
    ]
  },
  
  magnification: {
    description: 'Test with screen magnification',
    zoom_levels: [200, 300, 400],
    steps: [
      'verify content reflows properly',
      'check horizontal scrolling',
      'verify focus tracking',
      'test responsive behavior'
    ]
  }
}

// Custom axe rules for DCE platform
const customRules = {
  'dce-table-pagination': {
    id: 'dce-table-pagination',
    selector: '.table-pagination',
    tags: ['custom', 'wcag2a'],
    metadata: {
      description: 'Ensure table pagination controls are accessible',
      help: 'Table pagination must have proper ARIA labels and keyboard support'
    },
    check: function(node) {
      const buttons = node.querySelectorAll('button')
      const hasAriaLabels = Array.from(buttons).every(btn => 
        btn.getAttribute('aria-label') || btn.textContent.trim()
      )
      const hasCurrentPage = node.querySelector('[aria-current="page"]')
      
      return hasAriaLabels && hasCurrentPage
    }
  },
  
  'dce-modal-focus': {
    id: 'dce-modal-focus',
    selector: '[role="dialog"], .modal',
    tags: ['custom', 'wcag2a'],
    metadata: {
      description: 'Ensure modals properly manage focus',
      help: 'Modals must trap focus and return focus when closed'
    },
    check: function(node) {
      const hasAriaLabelledby = node.getAttribute('aria-labelledby')
      const hasAriaLabel = node.getAttribute('aria-label')
      const hasCloseButton = node.querySelector('[aria-label*="close"], [aria-label*="Close"]')
      
      return (hasAriaLabelledby || hasAriaLabel) && hasCloseButton
    }
  },
  
  'dce-chart-accessibility': {
    id: 'dce-chart-accessibility',
    selector: '.chart, [role="img"]',
    tags: ['custom', 'wcag2a'],
    metadata: {
      description: 'Ensure charts and visualizations are accessible',
      help: 'Charts must have text alternatives and data tables'
    },
    check: function(node) {
      const hasAltText = node.getAttribute('aria-label') || 
                        node.getAttribute('aria-labelledby') ||
                        node.getAttribute('alt')
      const hasDataTable = node.parentElement.querySelector('.chart-data-table') ||
                           node.getAttribute('aria-describedby')
      
      return hasAltText && hasDataTable
    }
  }
}

// Accessibility testing priorities by user type
const userTypePriorities = {
  buyer: {
    critical: [
      'marketplace search and filtering',
      'call purchase flow',
      'payment forms',
      'analytics dashboards'
    ],
    important: [
      'account settings',
      'transaction history',
      'saved searches'
    ]
  },
  
  supplier: {
    critical: [
      'inventory management',
      'listing creation forms',
      'pricing controls',
      'analytics dashboards'
    ],
    important: [
      'lead management',
      'financial reporting',
      'API documentation'
    ]
  },
  
  network: {
    critical: [
      'relationship management',
      'quality monitoring',
      'commission calculations',
      'partner matching'
    ],
    important: [
      'reporting dashboards',
      'dispute resolution',
      'contract management'
    ]
  },
  
  admin: {
    critical: [
      'user management',
      'system monitoring',
      'configuration settings',
      'security controls'
    ],
    important: [
      'audit logs',
      'bulk operations',
      'integration management'
    ]
  }
}

// Color contrast requirements
const colorContrast = {
  normal: {
    aa: 4.5,
    aaa: 7.0
  },
  large: {
    aa: 3.0,
    aaa: 4.5
  },
  ui_components: {
    aa: 3.0
  },
  focus_indicators: {
    minimum: 3.0
  }
}

// Export configuration
module.exports = {
  axeConfig,
  pageConfigs,
  interactionScenarios,
  customRules,
  userTypePriorities,
  colorContrast
}