# Security Testing Patterns

# Test Structure

```
security/
├── auth-security.test.ts      # Authentication & session security
├── input-validation.test.ts   # XSS, injection prevention  
├── api-security.test.ts       # API security controls
├── payment-security.test.ts   # PCI compliance & payment security
├── owasp-tests.js            # OWASP Top 10 compliance
├── security-config.js        # Security test configurations
└── penetration/              # Automated penetration tests
```

# Authentication Security Testing

```tsx
// auth-security.test.ts
describe('Authentication Security', () => {
  it('should prevent brute force attacks', async () => {
    // Attempt multiple failed logins
    for (let i = 0; i < 6; i++) {
      await authService.login('test@example.com', 'wrongpassword')
    }
    
    // Should be rate limited
    await expect(
      authService.login('test@example.com', 'wrongpassword')
    ).rejects.toThrow('Account temporarily locked')
  })
  
  it('should enforce session security', async () => {
    // Login and get session
    const session = await authService.login('user@test.com', 'password')
    
    // Simulate session hijacking attempt
    const suspiciousRequest = {
      sessionId: session.id,
      ipAddress: 'different-ip',
      userAgent: 'different-agent'
    }
    
    await expect(
      authService.validateSession(suspiciousRequest)
    ).rejects.toThrow('Suspicious activity detected')
  })
})
```

# Input Validation Security

```tsx
// input-validation.test.ts
describe('XSS Prevention', () => {
  it('should sanitize malicious scripts', async () => {
    const xssPayloads = [
      '<script>alert("xss")</script>',
      '"><script>alert("xss")</script>',
      '<img src=x onerror=alert("xss")>',
      '<svg onload=alert("xss")>'
    ]
    
    for (const payload of xssPayloads) {
      const sanitized = sanitizeInput(payload)
      expect(sanitized).not.toContain('<script>')
      expect(sanitized).not.toContain('onerror=')
      expect(sanitized).not.toContain('javascript:')
    }
  })
  
  it('should prevent SQL injection', async () => {
    const sqlPayloads = [
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      "' UNION SELECT * FROM campaigns --"
    ]
    
    for (const payload of sqlPayloads) {
      // Query should be parameterized, not string concatenated
      const result = await campaignService.search(payload)
      expect(result).not.toContain('DROP TABLE')
    }
  })
})
```

# API Security Testing

```tsx
// api-security.test.ts
describe('Rate Limiting', () => {
  it('should enforce API rate limits', async () => {
    const requests = Array.from({ length: 101 }, () =>
      fetch('/api/campaigns', {
        headers: { 'Authorization': 'Bearer token' }
      })
    )
    
    const responses = await Promise.all(requests)
    const rateLimited = responses.filter(r => r.status === 429)
    
    expect(rateLimited.length).toBeGreaterThan(0)
  })
  
  it('should validate CORS policy', async () => {
    const response = await fetch('/api/campaigns', {
      headers: { 'Origin': 'https://malicious-site.com' }
    })
    
    expect(response.status).toBe(403)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
})
```

# Payment Security Testing

```tsx
// payment-security.test.ts
describe('PCI Compliance', () => {
  it('should never store card data locally', async () => {
    const cardData = '4242424242424242'
    
    // Process payment
    await paymentService.processPayment({ cardNumber: cardData })
    
    // Verify card data not stored anywhere
    expect(localStorage.getItem('cardData')).toBeNull()
    expect(sessionStorage.getItem('cardData')).toBeNull()
    
    // Check all localStorage/sessionStorage values
    Object.keys(localStorage).forEach(key => {
      expect(localStorage.getItem(key)).not.toContain(cardData)
    })
  })
  
  it('should validate payment amounts server-side', async () => {
    const originalAmount = 100.00
    const tamperedAmount = 0.01
    
    // Attempt amount manipulation
    await expect(
      paymentService.processPayment({
        amount: tamperedAmount,
        originalAmount: originalAmount
      })
    ).rejects.toThrow('Payment amount mismatch')
  })
})
```

# OWASP Top 10 Testing

```javascript
// owasp-tests.js (Playwright)
test.describe('OWASP A01: Broken Access Control', () => {
  test('should prevent privilege escalation', async ({ page, request }) => {
    // Login as regular user
    await page.goto('/login')
    await page.fill('[name="email"]', 'user@test.com')
    await page.fill('[name="password"]', 'password')
    await page.click('[type="submit"]')
    
    // Attempt to access admin endpoint
    const response = await request.get('/api/admin/users')
    expect(response.status()).toBe(403)
  })
  
  test('should prevent horizontal access', async ({ request }) => {
    // Try to access another user's data
    const response = await request.get('/api/user/other-user-id/data', {
      headers: { 'Authorization': 'Bearer user-token' }
    })
    
    expect(response.status()).toBe(403)
  })
})
```

# Security Configuration Testing

```javascript
// security-config.js
const securityScenarios = {
  authentication: {
    tests: [
      {
        name: 'Brute force protection',
        endpoint: '/api/auth/login',
        maxAttempts: 5,
        lockoutDuration: 900
      },
      {
        name: 'Session timeout',
        timeout: 1800,
        endpoint: '/api/user/profile'
      }
    ]
  },
  
  authorization: {
    tests: [
      {
        name: 'Role-based access',
        user: 'buyer',
        deniedEndpoints: ['/api/admin/*', '/api/supplier/internal/*']
      }
    ]
  }
}

// Security headers validation
const requiredHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': "default-src 'self'"
}
```

# Automated Security Scanning

```javascript
// automated-security.test.js
describe('Automated Security Scans', () => {
  it('should pass OWASP ZAP baseline scan', async () => {
    const zapClient = new ZapClient('http://localhost:8080')
    
    // Spider the application
    await zapClient.spider.scan('http://localhost:5173')
    
    // Run active scan
    await zapClient.ascan.scan('http://localhost:5173')
    
    // Get results
    const alerts = await zapClient.core.alerts()
    const highRiskAlerts = alerts.filter(a => a.risk === 'High')
    
    expect(highRiskAlerts).toHaveLength(0)
  })
  
  it('should pass dependency vulnerability scan', async () => {
    const auditResult = await exec('npm audit --json')
    const audit = JSON.parse(auditResult.stdout)
    
    expect(audit.metadata.vulnerabilities.high).toBe(0)
    expect(audit.metadata.vulnerabilities.critical).toBe(0)
  })
})
```

# Business Logic Security

```tsx
// business-logic-security.test.ts
describe('DCE Business Logic Security', () => {
  it('should prevent call tracking manipulation', async () => {
    const maliciousCallData = {
      duration: -1,
      qualityScore: 150, // Above maximum
      callerId: '../../../etc/passwd'
    }
    
    await expect(
      callService.recordCall(maliciousCallData)
    ).rejects.toThrow('Invalid call data')
  })
  
  it('should prevent commission rate manipulation', async () => {
    const campaign = { id: '123', commissionRate: 0.05 }
    
    // Attempt to manipulate commission rate
    await expect(
      transactionService.calculatePayout({
        campaignId: '123',
        amount: 1000,
        commissionRate: 0.99 // Suspicious high rate
      })
    ).rejects.toThrow('Commission rate mismatch')
  })
  
  it('should validate call ownership', async () => {
    const buyerA = 'buyer-a'
    const buyerB = 'buyer-b'
    const callId = 'call-123'
    
    // Buyer A purchases call
    await callService.purchaseCall(callId, buyerA)
    
    // Buyer B tries to access the call
    await expect(
      callService.getCallDetails(callId, buyerB)
    ).rejects.toThrow('Access denied')
  })
})
```

# Security Test Utilities

```tsx
// security-utils.ts
export const SecurityTestUtils = {
  // Generate XSS payloads
  generateXSSPayloads(): string[] {
    return [
      '<script>alert("xss")</script>',
      '"><script>alert("xss")</script>',
      '<img src=x onerror=alert("xss")>',
      '<svg onload=alert("xss")>',
      'javascript:alert("xss")',
      '<iframe src="javascript:alert(\'xss\')"></iframe>'
    ]
  },
  
  // Generate SQL injection payloads
  generateSQLPayloads(): string[] {
    return [
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      "' UNION SELECT * FROM campaigns --",
      "admin'--",
      "' OR 1=1#"
    ]
  },
  
  // Validate security headers
  validateSecurityHeaders(headers: Headers): void {
    const required = {
      'strict-transport-security': /max-age=\d+/,
      'x-content-type-options': 'nosniff',
      'x-frame-options': /(DENY|SAMEORIGIN)/,
      'x-xss-protection': /1; mode=block/
    }
    
    Object.entries(required).forEach(([header, pattern]) => {
      const value = headers.get(header)
      expect(value).toBeTruthy()
      if (typeof pattern === 'string') {
        expect(value).toBe(pattern)
      } else {
        expect(value).toMatch(pattern)
      }
    })
  },
  
  // Test rate limiting
  async testRateLimit(endpoint: string, limit: number): Promise<void> {
    const requests = Array.from({ length: limit + 2 }, () =>
      fetch(endpoint)
    )
    
    const responses = await Promise.all(requests)
    const rateLimited = responses.filter(r => r.status === 429)
    
    expect(rateLimited.length).toBeGreaterThan(0)
  }
}
```

# Security Testing Configuration

```typescript
// security.config.ts
export const SecurityConfig = {
  // Password requirements
  password: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    preventReuse: 12
  },
  
  // Session security
  session: {
    maxAge: 1800, // 30 minutes
    secureOnly: true,
    httpOnly: true,
    sameSite: 'strict'
  },
  
  // Rate limiting
  rateLimit: {
    login: { requests: 5, window: 900 }, // 5 attempts per 15 minutes
    api: { requests: 100, window: 60 }, // 100 requests per minute
    password_reset: { requests: 3, window: 3600 } // 3 per hour
  },
  
  // Content Security Policy
  csp: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'", "https://api.stripe.com"]
  }
}
```

# Penetration Testing Automation

```javascript
// penetration-tests.js
const PenetrationTester = {
  async runBasicScans(baseUrl) {
    const results = {
      sqlInjection: await this.testSQLInjection(baseUrl),
      xss: await this.testXSS(baseUrl),
      directoryTraversal: await this.testDirectoryTraversal(baseUrl),
      authBypass: await this.testAuthBypass(baseUrl)
    }
    
    return results
  },
  
  async testSQLInjection(baseUrl) {
    const payloads = ["'; DROP TABLE users; --", "1' OR '1'='1"]
    const results = []
    
    for (const payload of payloads) {
      const response = await fetch(`${baseUrl}/api/search?q=${payload}`)
      results.push({
        payload,
        vulnerable: response.status === 200 && 
                   (await response.text()).includes('error')
      })
    }
    
    return results
  }
}
```

# CRITICAL RULES

- NO regex in security test code
- ALWAYS test both positive and negative cases
- NEVER include real credentials in tests
- ALWAYS validate security headers
- TEST for OWASP Top 10 vulnerabilities
- VERIFY PCI compliance for payment flows
- MOCK external security services safely
- TEST rate limiting and abuse prevention
- VALIDATE input sanitization thoroughly
- CHECK for information disclosure in errors
- ENSURE proper session management
- TEST business logic security controls