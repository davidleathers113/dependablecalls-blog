const desktopConfig = {
  extends: 'lighthouse:default',
  settings: {
    formFactor: 'desktop',
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
    },
    screenEmulation: {
      mobile: false,
      width: 1350,
      height: 940,
      deviceScaleFactor: 1,
      disabled: false,
    },
    emulatedUserAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36 Chrome-Lighthouse',
  },
  audits: [
    'first-contentful-paint',
    'largest-contentful-paint',
    'first-meaningful-paint',
    'speed-index',
    'interactive',
    'user-timings',
    'critical-request-chains',
    'redirects',
    'bootup-time',
    'uses-optimized-images',
    'uses-webp-images',
    'uses-text-compression',
    'unused-css-rules',
    'unused-javascript',
    'modern-image-formats',
    'uses-rel-preconnect',
    'uses-rel-preload',
    'font-display',
    'third-party-summary',
    'third-party-facades',
    'largest-contentful-paint-element',
    'lcp-lazy-loaded',
    'layout-shift-elements',
    'cumulative-layout-shift',
    'total-blocking-time',
    'max-potential-fid',
    'no-document-write',
    'dom-size',
    'non-composited-animations',
    'unsized-images',
    'valid-source-maps',
    'preload-lcp-image',
    'total-byte-weight',
    'offscreen-images',
    'render-blocking-resources',
    'unminified-css',
    'unminified-javascript',
    'efficient-animated-content',
    'duplicated-javascript',
    'legacy-javascript',
    'prioritize-lcp-image'
  ],
  categories: {
    performance: {
      title: 'Performance',
      description: 'These checks ensure that your page is optimized for speed.',
      auditRefs: [
        {id: 'first-contentful-paint', weight: 10, group: 'metrics'},
        {id: 'largest-contentful-paint', weight: 25, group: 'metrics'},
        {id: 'cumulative-layout-shift', weight: 25, group: 'metrics'},
        {id: 'total-blocking-time', weight: 30, group: 'metrics'},
        {id: 'speed-index', weight: 10, group: 'metrics'},
        {id: 'interactive', weight: 0, group: 'metrics'},
        {id: 'max-potential-fid', weight: 0, group: 'metrics'},
        {id: 'first-meaningful-paint', weight: 0, group: 'metrics'},
        {id: 'render-blocking-resources', weight: 0, group: 'load-opportunities'},
        {id: 'uses-responsive-images', weight: 0, group: 'load-opportunities'},
        {id: 'offscreen-images', weight: 0, group: 'load-opportunities'},
        {id: 'unminified-css', weight: 0, group: 'load-opportunities'},
        {id: 'unminified-javascript', weight: 0, group: 'load-opportunities'},
        {id: 'unused-css-rules', weight: 0, group: 'load-opportunities'},
        {id: 'unused-javascript', weight: 0, group: 'load-opportunities'},
        {id: 'uses-optimized-images', weight: 0, group: 'load-opportunities'},
        {id: 'uses-webp-images', weight: 0, group: 'load-opportunities'},
        {id: 'uses-text-compression', weight: 0, group: 'load-opportunities'},
        {id: 'uses-rel-preconnect', weight: 0, group: 'load-opportunities'},
        {id: 'uses-rel-preload', weight: 0, group: 'load-opportunities'},
        {id: 'font-display', weight: 0, group: 'load-opportunities'},
        {id: 'third-party-summary', weight: 0, group: 'diagnostics'},
        {id: 'third-party-facades', weight: 0, group: 'diagnostics'},
        {id: 'largest-contentful-paint-element', weight: 0, group: 'diagnostics'},
        {id: 'lcp-lazy-loaded', weight: 0, group: 'diagnostics'},
        {id: 'layout-shift-elements', weight: 0, group: 'diagnostics'},
        {id: 'uses-long-cache-ttl', weight: 0, group: 'diagnostics'},
        {id: 'total-byte-weight', weight: 0, group: 'diagnostics'},
        {id: 'dom-size', weight: 0, group: 'diagnostics'},
        {id: 'critical-request-chains', weight: 0, group: 'diagnostics'},
        {id: 'user-timings', weight: 0, group: 'diagnostics'},
        {id: 'bootup-time', weight: 0, group: 'diagnostics'},
        {id: 'mainthread-work-breakdown', weight: 0, group: 'diagnostics'},
        {id: 'non-composited-animations', weight: 0, group: 'diagnostics'},
        {id: 'unsized-images', weight: 0, group: 'diagnostics'},
        {id: 'valid-source-maps', weight: 0, group: 'diagnostics'},
        {id: 'preload-lcp-image', weight: 0, group: 'diagnostics'},
        {id: 'no-document-write', weight: 0, group: 'best-practices'},
        {id: 'redirects', weight: 0, group: 'best-practices'},
        {id: 'efficient-animated-content', weight: 0, group: 'best-practices'},
        {id: 'duplicated-javascript', weight: 0, group: 'best-practices'},
        {id: 'legacy-javascript', weight: 0, group: 'best-practices'},
        {id: 'prioritize-lcp-image', weight: 0, group: 'best-practices'}
      ]
    }
  },
  groups: {
    'metrics': {
      title: 'Core Web Vitals'
    },
    'load-opportunities': {
      title: 'Opportunities'
    },
    'diagnostics': {
      title: 'Diagnostics'
    },
    'best-practices': {
      title: 'Best Practices'
    }
  }
}

const mobileConfig = {
  extends: 'lighthouse:default',
  settings: {
    formFactor: 'mobile',
    throttling: {
      rttMs: 150,
      throughputKbps: 1638.4,
      cpuSlowdownMultiplier: 4,
    },
    screenEmulation: {
      mobile: true,
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      disabled: false,
    },
    emulatedUserAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.2 Mobile/15E148 Safari/604.1',
  },
  audits: desktopConfig.audits,
  categories: desktopConfig.categories,
  groups: desktopConfig.groups
}

// Performance thresholds for different user types
const performanceThresholds = {
  buyer: {
    performance: 85,
    fcp: 1800,
    lcp: 2500,
    cls: 0.1,
    tbt: 300,
    si: 3000
  },
  supplier: {
    performance: 80,
    fcp: 2000,
    lcp: 3000,
    cls: 0.15,
    tbt: 400,
    si: 3500
  },
  network: {
    performance: 85,
    fcp: 1800,
    lcp: 2500,
    cls: 0.1,
    tbt: 300,
    si: 3000
  },
  admin: {
    performance: 75,
    fcp: 2500,
    lcp: 3500,
    cls: 0.2,
    tbt: 500,
    si: 4000
  }
}

// Pages to test for each user type
const testPages = {
  buyer: [
    '/dashboard',
    '/marketplace',
    '/marketplace/search?category=insurance',
    '/analytics',
    '/purchases/history',
    '/account/billing'
  ],
  supplier: [
    '/supplier/dashboard',
    '/supplier/inventory',
    '/supplier/analytics',
    '/supplier/leads',
    '/supplier/financials'
  ],
  network: [
    '/network/dashboard',
    '/network/relationships',
    '/network/quality',
    '/network/commission'
  ],
  admin: [
    '/admin/dashboard',
    '/admin/users',
    '/admin/system',
    '/admin/config'
  ],
  public: [
    '/',
    '/login',
    '/register',
    '/about',
    '/pricing'
  ]
}

// Custom Lighthouse plugins for DCE-specific metrics
const dcePlugin = {
  audits: {
    'dce-real-time-connection': './audits/real-time-connection.js',
    'dce-call-player-performance': './audits/call-player-performance.js',
    'dce-chart-rendering': './audits/chart-rendering.js',
    'dce-table-virtualization': './audits/table-virtualization.js',
    'dce-websocket-efficiency': './audits/websocket-efficiency.js'
  },
  groups: {
    'dce-performance': {
      title: 'DCE Platform Performance',
      description: 'Performance metrics specific to the DCE platform'
    }
  },
  category: {
    'dce-platform': {
      title: 'DCE Platform',
      description: 'DCE-specific performance and functionality audits',
      auditRefs: [
        {id: 'dce-real-time-connection', weight: 2, group: 'dce-performance'},
        {id: 'dce-call-player-performance', weight: 2, group: 'dce-performance'},
        {id: 'dce-chart-rendering', weight: 1, group: 'dce-performance'},
        {id: 'dce-table-virtualization', weight: 1, group: 'dce-performance'},
        {id: 'dce-websocket-efficiency', weight: 1, group: 'dce-performance'}
      ]
    }
  }
}

module.exports = {
  desktopConfig,
  mobileConfig,
  performanceThresholds,
  testPages,
  dcePlugin
}