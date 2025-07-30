module.exports = {
  ci: {
    collect: {
      // Blog page URLs to test
      url: [
        'http://localhost:5173/blog',
        'http://localhost:5173/blog/maximizing-roi-pay-per-call-campaigns-2024',
        'http://localhost:5173/blog/category/pay-per-call-marketing',
        'http://localhost:5173/blog/author/john-smith'
      ],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        throttling: {
          cpuSlowdownMultiplier: 1
        }
      }
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        // Performance thresholds
        'categories:performance': ['error', { minScore: 0.85 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.95 }],
        
        // Core Web Vitals thresholds
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }], // FCP < 2s
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }], // LCP < 2.5s
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }], // CLS < 0.1
        'total-blocking-time': ['error', { maxNumericValue: 300 }] // TBT < 300ms
      }
    },
    upload: {
      target: 'temporary-public-storage'
    }
  }
};