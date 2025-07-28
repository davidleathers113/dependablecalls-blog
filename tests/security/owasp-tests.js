// OWASP Top 10 2021 Security Tests for DCE Platform
const { test, expect } = require('@playwright/test')
const { securityScenarios, securityHeaders } = require('./security-config')

test.describe('OWASP Top 10 2021 Security Tests', () => {
  
  test.describe('A01:2021 - Broken Access Control', () => {
    test('should prevent horizontal privilege escalation', async ({ request, page }) => {
      // Login as buyer user
      await page.goto('/login')
      await page.fill('[name="email"]', 'buyer1@test.com')
      await page.fill('[name="password"]', 'TestPass123!')
      await page.click('[type="submit"]')
      
      // Get buyer's auth token
      const localStorage = await page.evaluate(() => window.localStorage.getItem('auth_token'))
      
      // Attempt to access another buyer's data
      const response = await request.get('/api/buyer/campaigns', {
        headers: {
          'Authorization': `Bearer ${localStorage}`,
          'X-User-ID': 'different-buyer-id'
        }
      })
      
      expect(response.status()).toBe(403)
      
      const body = await response.json()
      expect(body.error).toContain('Access denied')
    })
    
    test('should prevent vertical privilege escalation', async ({ request, page }) => {
      // Login as regular user
      await page.goto('/login')
      await page.fill('[name="email"]', 'supplier1@test.com')
      await page.fill('[name="password"]', 'TestPass123!')
      await page.click('[type="submit"]')
      
      const localStorage = await page.evaluate(() => window.localStorage.getItem('auth_token'))
      
      // Attempt to access admin endpoints
      const adminEndpoints = [
        '/api/admin/users',
        '/api/admin/system/config',
        '/api/admin/audit-logs'
      ]
      
      for (const endpoint of adminEndpoints) {
        const response = await request.get(endpoint, {
          headers: { 'Authorization': `Bearer ${localStorage}` }
        })
        
        expect(response.status()).toBe(403)
      }
    })
    
    test('should prevent directory traversal attacks', async ({ request }) => {
      const maliciousPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '../.env',
        '../../package.json',
        '../database.db'
      ]
      
      for (const payload of maliciousPayloads) {
        const response = await request.get(`/api/files/${encodeURIComponent(payload)}`)
        expect(response.status()).toBe(404)
      }
    })
    
    test('should enforce proper session management', async ({ page, context }) => {
      // Login
      await page.goto('/login')
      await page.fill('[name="email"]', 'buyer1@test.com')
      await page.fill('[name="password"]', 'TestPass123!')
      await page.click('[type="submit"]')
      
      // Verify logged in
      await expect(page).toHaveURL('/dashboard')
      
      // Simulate session timeout (manipulate session)
      await page.evaluate(() => {
        const expiredToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE2MDAwMDAwMDB9.invalid'
        window.localStorage.setItem('auth_token', expiredToken)
      })
      
      // Attempt to access protected resource
      await page.goto('/campaigns')
      await expect(page).toHaveURL('/login')
    })
  })
  
  test.describe('A02:2021 - Cryptographic Failures', () => {
    test('should enforce HTTPS in production', async ({ page }) => {
      // Check if running in production mode
      const isProd = process.env.NODE_ENV === 'production'
      if (!isProd) {
        test.skip('HTTPS test only applicable in production')
      }
      
      await page.goto('http://localhost:5173')
      // Should redirect to HTTPS
      await expect(page).toHaveURL(/^https:\/\//)
    })
    
    test('should have proper security headers', async ({ request }) => {
      const response = await request.get('/')
      const headers = response.headers()
      
      // Check required security headers
      for (const [headerName, config] of Object.entries(securityHeaders.required)) {
        expect(headers[headerName.toLowerCase()]).toBeDefined()
        if (config.expected) {
          expect(headers[headerName.toLowerCase()]).toContain(config.expected)
        }
      }
      
      // Check forbidden headers are not present
      for (const forbiddenHeader of securityHeaders.forbidden) {
        expect(headers[forbiddenHeader.toLowerCase()]).toBeUndefined()
      }
    })
    
    test('should not expose sensitive information in errors', async ({ request }) => {
      // Trigger various error conditions
      const errorRequests = [
        { endpoint: '/api/nonexistent', expectedStatus: 404 },
        { endpoint: '/api/campaigns/invalid-id', expectedStatus: 400 },
        { endpoint: '/api/users', expectedStatus: 401 } // No auth
      ]
      
      for (const { endpoint, expectedStatus } of errorRequests) {
        const response = await request.get(endpoint)
        expect(response.status()).toBe(expectedStatus)
        
        const body = await response.text()
        // Should not contain sensitive information
        expect(body).not.toMatch(/password/i)
        expect(body).not.toMatch(/secret/i)
        expect(body).not.toMatch(/token/i)
        expect(body).not.toMatch(/database/i)
        expect(body).not.toMatch(/stack trace/i)
      }
    })
  })
  
  test.describe('A03:2021 - Injection', () => {
    test('should prevent SQL injection attacks', async ({ request, page }) => {
      // Login first
      await page.goto('/login')
      await page.fill('[name="email"]', 'buyer1@test.com')
      await page.fill('[name="password"]', 'TestPass123!')
      await page.click('[type="submit"]')
      
      const localStorage = await page.evaluate(() => window.localStorage.getItem('auth_token'))
      
      const sqlPayloads = [
        "'; DROP TABLE campaigns; --",
        "1' OR '1'='1",
        "' UNION SELECT * FROM users --",
        "'; INSERT INTO campaigns (name) VALUES ('malicious'); --",
        "admin'--",
        "admin' /*",
        "' OR 1=1#",
        "' OR 'a'='a",
        "'; EXEC xp_cmdshell('dir'); --"
      ]
      
      const endpoints = [
        '/api/campaigns/search',
        '/api/calls/filter',
        '/api/analytics/report'
      ]
      
      for (const endpoint of endpoints) {
        for (const payload of sqlPayloads) {
          const response = await request.post(endpoint, {
            headers: { 'Authorization': `Bearer ${localStorage}` },
            data: { query: payload }
          })
          
          // Should not return database errors or succeed with injection
          expect(response.status()).toBeLessThan(500)
          
          const body = await response.text()
          expect(body).not.toMatch(/sql/i)
          expect(body).not.toMatch(/mysql/i)
          expect(body).not.toMatch(/postgresql/i)
          expect(body).not.toMatch(/syntax error/i)
        }
      }
    })
    
    test('should prevent XSS attacks', async ({ page }) => {
      await page.goto('/login')
      await page.fill('[name="email"]', 'buyer1@test.com')
      await page.fill('[name="password"]', 'TestPass123!')
      await page.click('[type="submit"]')
      
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '"><script>alert("xss")</script>',
        "javascript:alert('xss')",
        '<img src=x onerror=alert("xss")>',
        '<svg onload=alert("xss")>',
        '<iframe src="javascript:alert(\'xss\')"></iframe>',
        '<body onload=alert("xss")>',
        '<input onfocus=alert("xss") autofocus>'
      ]
      
      // Test in campaign creation form
      await page.goto('/campaigns/create')
      
      for (const payload of xssPayloads) {
        await page.fill('[name="name"]', payload)
        await page.fill('[name="description"]', payload)
        
        // Submit form
        await page.click('[type="submit"]')
        
        // Check if XSS executed (should not)
        const alertFired = await page.evaluate(() => {
          return window.xssTriggered === true
        })
        expect(alertFired).toBeFalsy()
        
        // Check if content is properly escaped
        const nameValue = await page.inputValue('[name="name"]')
        expect(nameValue).not.toContain('<script>')
      }
    })
    
    test('should prevent command injection', async ({ request, page }) => {
      await page.goto('/login')
      await page.fill('[name="email"]', 'admin@test.com')
      await page.fill('[name="password"]', 'TestPass123!')
      await page.click('[type="submit"]')
      
      const localStorage = await page.evaluate(() => window.localStorage.getItem('auth_token'))
      
      const commandPayloads = [
        '; ls -la',
        '| cat /etc/passwd',
        '&& rm -rf /',
        '`whoami`',
        '$(id)',
        '; ping -c 10 evil.com',
        '| nc -l 4444',
        '& echo "hacked" > /tmp/hack.txt'
      ]
      
      // Test file upload with malicious filenames
      for (const payload of commandPayloads) {
        const response = await request.post('/api/files/upload', {
          headers: { 'Authorization': `Bearer ${localStorage}` },
          multipart: {
            file: {
              name: `test${payload}.txt`,
              mimeType: 'text/plain',
              buffer: Buffer.from('test content')
            }
          }
        })
        
        // Should reject or sanitize malicious filename
        expect(response.status()).toBeLessThan(500)
      }
    })
  })
  
  test.describe('A04:2021 - Insecure Design', () => {
    test('should implement proper rate limiting', async ({ request, page }) => {
      // Test login rate limiting
      const maxAttempts = 5
      let failedAttempts = 0
      
      for (let i = 0; i < maxAttempts + 2; i++) {
        const response = await request.post('/api/auth/login', {
          data: {
            email: 'test@example.com',
            password: 'wrongpassword'
          }
        })
        
        if (response.status() === 429) {
          break
        }
        failedAttempts++
      }
      
      expect(failedAttempts).toBeLessThanOrEqual(maxAttempts)
    })
    
    test('should implement proper account lockout', async ({ request }) => {
      const testEmail = `lockout-test-${Date.now()}@example.com`
      
      // Attempt multiple failed logins
      for (let i = 0; i < 6; i++) {
        await request.post('/api/auth/login', {
          data: {
            email: testEmail,
            password: 'wrongpassword'
          }
        })
      }
      
      // Account should be locked
      const response = await request.post('/api/auth/login', {
        data: {
          email: testEmail,
          password: 'wrongpassword'
        }
      })
      
      expect(response.status()).toBe(429)
      const body = await response.json()
      expect(body.error).toMatch(/account.*locked/i)
    })
    
    test('should validate business logic constraints', async ({ request, page }) => {
      await page.goto('/login')
      await page.fill('[name="email"]', 'buyer1@test.com')
      await page.fill('[name="password"]', 'TestPass123!')
      await page.click('[type="submit"]')
      
      const localStorage = await page.evaluate(() => window.localStorage.getItem('auth_token'))
      
      // Test negative amounts
      const response = await request.post('/api/campaigns/create', {
        headers: { 'Authorization': `Bearer ${localStorage}` },
        data: {
          name: 'Test Campaign',
          budget: -1000,
          target_cpa: -50
        }
      })
      
      expect(response.status()).toBe(400)
      
      const body = await response.json()
      expect(body.errors).toContain('Budget must be positive')
    })
  })
  
  test.describe('A05:2021 - Security Misconfiguration', () => {
    test('should not expose debug information', async ({ request }) => {
      const response = await request.get('/')
      const body = await response.text()
      
      // Should not contain debug information
      expect(body).not.toMatch(/debug/i)
      expect(body).not.toMatch(/development/i)
      expect(body).not.toMatch(/test/i)
      expect(body).not.toMatch(/console\.log/i)
    })
    
    test('should have proper CORS configuration', async ({ request }) => {
      const response = await request.options('/api/campaigns', {
        headers: {
          'Origin': 'https://malicious-site.com',
          'Access-Control-Request-Method': 'GET'
        }
      })
      
      const corsHeader = response.headers()['access-control-allow-origin']
      expect(corsHeader).not.toBe('*')
      expect(corsHeader).not.toContain('malicious-site.com')
    })
    
    test('should disable unnecessary HTTP methods', async ({ request }) => {
      const unnecessaryMethods = ['TRACE', 'TRACK', 'CONNECT']
      
      for (const method of unnecessaryMethods) {
        const response = await request.fetch('/api/campaigns', { method })
        expect(response.status()).toBe(405) // Method Not Allowed
      }
    })
  })
  
  test.describe('A06:2021 - Vulnerable and Outdated Components', () => {
    test('should not expose server version information', async ({ request }) => {
      const response = await request.get('/')
      const headers = response.headers()
      
      // Should not expose server version
      expect(headers['server']).toBeUndefined()
      expect(headers['x-powered-by']).toBeUndefined()
      expect(headers['x-version']).toBeUndefined()
    })
  })
  
  test.describe('A07:2021 - Identification and Authentication Failures', () => {
    test('should enforce strong password requirements', async ({ request }) => {
      const weakPasswords = [
        'password',
        '123456',
        'qwerty',
        'abc123',
        'password123',
        '12345678'
      ]
      
      for (const password of weakPasswords) {
        const response = await request.post('/api/auth/register', {
          data: {
            email: 'test@example.com',
            password: password,
            name: 'Test User'
          }
        })
        
        expect(response.status()).toBe(400)
        const body = await response.json()
        expect(body.errors).toContain('Password does not meet requirements')
      }
    })
    
    test('should implement proper session invalidation', async ({ page, context }) => {
      // Login
      await page.goto('/login')
      await page.fill('[name="email"]', 'buyer1@test.com')
      await page.fill('[name="password"]', 'TestPass123!')
      await page.click('[type="submit"]')
      
      // Logout
      await page.click('[data-testid="user-menu"]')
      await page.click('[data-testid="logout"]')
      
      // Try to access protected page
      await page.goto('/dashboard')
      await expect(page).toHaveURL('/login')
    })
  })
  
  test.describe('A08:2021 - Software and Data Integrity Failures', () => {
    test('should validate file uploads', async ({ request, page }) => {
      await page.goto('/login')
      await page.fill('[name="email"]', 'admin@test.com')
      await page.fill('[name="password"]', 'TestPass123!')
      await page.click('[type="submit"]')
      
      const localStorage = await page.evaluate(() => window.localStorage.getItem('auth_token'))
      
      // Test malicious file upload
      const maliciousFiles = [
        { name: 'malware.exe', content: 'MZ\x90\x00', mimeType: 'application/octet-stream' },
        { name: 'script.php', content: '<?php system($_GET["cmd"]); ?>', mimeType: 'text/plain' },
        { name: 'script.html', content: '<script>alert("xss")</script>', mimeType: 'text/html' }
      ]
      
      for (const file of maliciousFiles) {
        const response = await request.post('/api/files/upload', {
          headers: { 'Authorization': `Bearer ${localStorage}` },
          multipart: {
            file: {
              name: file.name,
              mimeType: file.mimeType,
              buffer: Buffer.from(file.content)
            }
          }
        })
        
        // Should reject malicious files
        expect(response.status()).toBe(400)
      }
    })
  })
  
  test.describe('A09:2021 - Security Logging and Monitoring Failures', () => {
    test('should log security events', async ({ request, page }) => {
      // Attempt failed login
      await request.post('/api/auth/login', {
        data: {
          email: 'nonexistent@example.com',
          password: 'wrongpassword'
        }
      })
      
      // Login as admin to check logs
      await page.goto('/login')
      await page.fill('[name="email"]', 'admin@test.com')
      await page.fill('[name="password"]', 'TestPass123!')
      await page.click('[type="submit"]')
      
      // Check audit logs
      await page.goto('/admin/audit-logs')
      await expect(page.locator('[data-testid="security-events"]')).toContainText('failed_login')
    })
  })
  
  test.describe('A10:2021 - Server-Side Request Forgery (SSRF)', () => {
    test('should prevent SSRF attacks', async ({ request, page }) => {
      await page.goto('/login')
      await page.fill('[name="email"]', 'admin@test.com')
      await page.fill('[name="password"]', 'TestPass123!')
      await page.click('[type="submit"]')
      
      const localStorage = await page.evaluate(() => window.localStorage.getItem('auth_token'))
      
      const ssrfPayloads = [
        'http://localhost:22',
        'http://127.0.0.1:3000',
        'http://169.254.169.254/latest/meta-data/',
        'file:///etc/passwd',
        'gopher://127.0.0.1:25'
      ]
      
      for (const payload of ssrfPayloads) {
        const response = await request.post('/api/webhooks/test', {
          headers: { 'Authorization': `Bearer ${localStorage}` },
          data: { url: payload }
        })
        
        // Should reject SSRF attempts
        expect(response.status()).toBe(400)
        const body = await response.json()
        expect(body.error).toMatch(/invalid.*url/i)
      }
    })
  })
})

// Security header validation tests
test.describe('Security Headers Validation', () => {
  test('should have comprehensive security headers', async ({ request }) => {
    const response = await request.get('/')
    const headers = response.headers()
    
    // Content Security Policy
    expect(headers['content-security-policy']).toBeDefined()
    expect(headers['content-security-policy']).toMatch(/default-src.*'self'/)
    
    // HSTS
    expect(headers['strict-transport-security']).toBeDefined()
    expect(headers['strict-transport-security']).toMatch(/max-age=\d+/)
    
    // X-Frame-Options
    expect(headers['x-frame-options']).toMatch(/DENY|SAMEORIGIN/)
    
    // X-Content-Type-Options
    expect(headers['x-content-type-options']).toBe('nosniff')
    
    // X-XSS-Protection
    expect(headers['x-xss-protection']).toMatch(/1; mode=block/)
    
    // Referrer Policy
    expect(headers['referrer-policy']).toBeDefined()
  })
})