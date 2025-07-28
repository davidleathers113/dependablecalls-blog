// OWASP ZAP Security Testing Configuration for DCE Platform
const zapConfig = {
  // ZAP Spider configuration
  spider: {
    maxDepth: 5,
    maxChildren: 20,
    recurse: true,
    subtreeOnly: true,
    contextName: 'DCE-App',
    userAgent: 'ZAP-Security-Scanner'
  },
  
  // Active scan policies
  scanPolicies: {
    // High risk vulnerabilities
    high: [
      'SQL_INJECTION',
      'CROSS_SITE_SCRIPTING_PERSISTENT',
      'CROSS_SITE_SCRIPTING_REFLECTED',
      'PATH_TRAVERSAL',
      'REMOTE_FILE_INCLUSION',
      'SERVER_SIDE_INCLUDE',
      'SCRIPT_ACTIVE_SCAN_RULES',
      'EXTERNAL_REDIRECT',
      'CRLF_INJECTION',
      'PARAMETER_POLLUTION',
      'LDAP_INJECTION',
      'XPATH_INJECTION'
    ],
    
    // Medium risk vulnerabilities
    medium: [
      'ANTI_CSRF_TOKENS',
      'INSECURE_HTTP_METHOD',
      'COOKIE_HTTPONLY',
      'COOKIE_SECURE',
      'COOKIE_SAMESITE',
      'X_FRAME_OPTIONS',
      'X_CONTENT_TYPE_OPTIONS',
      'X_XSS_PROTECTION',
      'STRICT_TRANSPORT_SECURITY',
      'CSP_SCANNER',
      'APPLICATION_ERROR_DISCLOSURE',
      'SESSION_ID_IN_URL_REWRITE'
    ],
    
    // Information gathering
    info: [
      'DIRECTORY_BROWSING',
      'BACKUP_FILE_DISCLOSURE',
      'SENSITIVE_INFORMATION_DISCLOSURE',
      'TIMESTAMP_DISCLOSURE',
      'HASH_DISCLOSURE',
      'EMAIL_DISCLOSURE',
      'USERNAME_HASH_FOUND'
    ]
  },
  
  // Authentication configuration
  authentication: {
    loginUrl: 'http://localhost:5173/login',
    loggedInIndicator: 'dashboard',
    loggedOutIndicator: 'login',
    users: [
      {
        name: 'buyer-user',
        credentials: {
          email: 'security.test.buyer@example.com',
          password: 'SecureTestPass123!'
        },
        roles: ['buyer']
      },
      {
        name: 'supplier-user', 
        credentials: {
          email: 'security.test.supplier@example.com',
          password: 'SecureTestPass123!'
        },
        roles: ['supplier']
      },
      {
        name: 'network-user',
        credentials: {
          email: 'security.test.network@example.com',
          password: 'SecureTestPass123!'
        },
        roles: ['network']
      },
      {
        name: 'admin-user',
        credentials: {
          email: 'security.test.admin@example.com',
          password: 'SecureTestPass123!'
        },
        roles: ['admin']
      }
    ]
  },
  
  // Session management
  session: {
    tokenName: 'Authorization',
    tokenLocation: 'header',
    sessionManagement: 'cookieBasedSessionManagement'
  },
  
  // Context definition for DCE platform
  context: {
    name: 'DCE-Security-Test',
    description: 'Security testing context for DCE platform',
    includeInContext: [
      'http://localhost:5173.*',
      'http://localhost:3000/api.*'
    ],
    excludeFromContext: [
      'http://localhost:5173/static.*',
      'http://localhost:5173/assets.*',
      '.*\\.png',
      '.*\\.jpg',
      '.*\\.jpeg',
      '.*\\.gif',
      '.*\\.css',
      '.*\\.js',
      '.*\\.woff.*'
    ]
  },
  
  // Scan intensity levels
  scanIntensity: {
    // Quick security check
    quick: {
      policies: ['high'],
      maxRuleDurationInMins: 1,
      maxScanDurationInMins: 10,
      strength: 'Low'
    },
    
    // Standard security scan  
    standard: {
      policies: ['high', 'medium'],
      maxRuleDurationInMins: 5,
      maxScanDurationInMins: 30,
      strength: 'Medium'
    },
    
    // Comprehensive security scan
    comprehensive: {
      policies: ['high', 'medium', 'info'],
      maxRuleDurationInMins: 10,
      maxScanDurationInMins: 60,
      strength: 'High'
    }
  }
}

// Security test scenarios for DCE platform
const securityScenarios = {
  // Authentication security tests
  authentication: {
    name: 'Authentication Security',
    description: 'Test authentication mechanisms and session management',
    tests: [
      {
        name: 'Password brute force protection',
        endpoint: '/api/auth/login',
        method: 'POST',
        payload: {
          email: 'security.test.buyer@example.com',
          password: 'wrong-password'
        },
        assertions: {
          maxAttempts: 5,
          lockoutDuration: 900, // 15 minutes
          responseAfterLockout: 429
        }
      },
      {
        name: 'Session timeout enforcement',
        description: 'Verify sessions timeout after inactivity',
        timeout: 1800, // 30 minutes
        endpoint: '/api/user/profile'
      },
      {
        name: 'Multi-factor authentication bypass',
        description: 'Attempt to bypass MFA requirements'
      }
    ]
  },
  
  // Authorization security tests
  authorization: {
    name: 'Authorization Security', 
    description: 'Test role-based access controls',
    tests: [
      {
        name: 'Horizontal privilege escalation',
        description: 'Test access to other users data',
        scenarios: [
          {
            user: 'buyer-user',
            attempt: 'access-other-buyer-data',
            endpoint: '/api/buyer/campaigns/{other_user_id}',
            expectedStatus: 403
          },
          {
            user: 'supplier-user',
            attempt: 'access-buyer-campaigns',
            endpoint: '/api/buyer/campaigns',
            expectedStatus: 403
          }
        ]
      },
      {
        name: 'Vertical privilege escalation',
        description: 'Test access to admin functions',
        scenarios: [
          {
            user: 'buyer-user',
            attempt: 'access-admin-panel',
            endpoint: '/api/admin/users',
            expectedStatus: 403
          },
          {
            user: 'supplier-user',
            attempt: 'access-admin-functions',
            endpoint: '/api/admin/system/config',
            expectedStatus: 403
          }
        ]
      }
    ]
  },
  
  // Input validation security tests
  inputValidation: {
    name: 'Input Validation Security',
    description: 'Test input validation and sanitization',
    tests: [
      {
        name: 'SQL injection prevention',
        payloads: [
          "'; DROP TABLE campaigns; --",
          "1' OR '1'='1",
          "' UNION SELECT * FROM users --",
          "'; INSERT INTO campaigns (name) VALUES ('malicious'); --"
        ],
        endpoints: [
          '/api/campaigns/search',
          '/api/calls/filter',
          '/api/analytics/report'
        ]
      },
      {
        name: 'XSS prevention',
        payloads: [
          '<script>alert("xss")</script>',
          '"><script>alert("xss")</script>',
          "javascript:alert('xss')",
          '<img src=x onerror=alert("xss")>',
          '<svg onload=alert("xss")>'
        ],
        endpoints: [
          '/api/campaigns/create',
          '/api/user/profile/update',
          '/api/calls/notes'
        ]
      },
      {
        name: 'File upload security',
        description: 'Test file upload validation',
        tests: [
          {
            name: 'Malicious file upload',
            files: [
              { name: 'malicious.php', content: '<?php system($_GET["cmd"]); ?>' },
              { name: 'script.html', content: '<script>alert("xss")</script>' },
              { name: 'large.txt', size: '100MB' }
            ],
            endpoint: '/api/files/upload'
          }
        ]
      }
    ]
  },
  
  // API security tests
  apiSecurity: {
    name: 'API Security',
    description: 'Test API-specific security controls',
    tests: [
      {
        name: 'Rate limiting',
        description: 'Test API rate limiting implementation',
        endpoint: '/api/campaigns',
        requests: 1000,
        timeWindow: 60, // 1 minute
        expectedLimit: 100
      },
      {
        name: 'CORS configuration',
        description: 'Test Cross-Origin Resource Sharing settings',
        origins: [
          'http://malicious-site.com',
          'https://evil.example.com',
          'null'
        ],
        endpoint: '/api/campaigns'
      },
      {
        name: 'HTTP methods security',
        description: 'Test for unnecessary HTTP methods',
        endpoint: '/api/campaigns/123',
        methods: ['TRACE', 'OPTIONS', 'DELETE', 'PATCH'],
        expectedAllowed: ['GET', 'PUT']
      }
    ]
  },
  
  // Payment security tests
  paymentSecurity: {
    name: 'Payment Security',
    description: 'Test payment processing security',
    tests: [
      {
        name: 'Payment manipulation',
        description: 'Test for payment amount manipulation',
        scenarios: [
          {
            endpoint: '/api/payments/create',
            originalAmount: 100.00,
            manipulatedAmount: 0.01,
            expectedBehavior: 'reject'
          }
        ]
      },
      {
        name: 'PCI compliance',
        description: 'Verify PCI DSS compliance measures',
        checks: [
          'no_card_data_in_logs',
          'encrypted_card_storage',
          'secure_transmission',
          'access_controls'
        ]
      }
    ]
  },
  
  // Business logic security tests
  businessLogic: {
    name: 'Business Logic Security',
    description: 'Test business logic vulnerabilities',
    tests: [
      {
        name: 'Call tracking manipulation',
        description: 'Test for call tracking bypass',
        scenarios: [
          {
            name: 'Duration manipulation',
            endpoint: '/api/calls/complete',
            payload: {
              call_id: 'test-call-123',
              duration: -1,
              quality_score: 150
            }
          }
        ]
      },
      {
        name: 'Commission manipulation',
        description: 'Test for commission calculation bypass',
        scenarios: [
          {
            name: 'Rate manipulation',
            endpoint: '/api/transactions/calculate',
            manipulations: ['negative_rate', 'excessive_rate', 'zero_rate']
          }
        ]
      }
    ]
  }
}

// Security headers configuration
const securityHeaders = {
  required: {
    'Strict-Transport-Security': {
      expected: 'max-age=31536000; includeSubDomains',
      description: 'Enforce HTTPS connections'
    },
    'X-Content-Type-Options': {
      expected: 'nosniff',
      description: 'Prevent MIME type sniffing'
    },
    'X-Frame-Options': {
      expected: 'DENY',
      description: 'Prevent clickjacking attacks'
    },
    'X-XSS-Protection': {
      expected: '1; mode=block',
      description: 'Enable XSS filtering'
    },
    'Content-Security-Policy': {
      expected: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
      description: 'Control resource loading'
    },
    'Referrer-Policy': {
      expected: 'strict-origin-when-cross-origin',
      description: 'Control referrer information'
    },
    'Permissions-Policy': {
      expected: 'camera=(), microphone=(), geolocation=()',
      description: 'Control browser features'
    }
  },
  
  forbidden: [
    'Server',
    'X-Powered-By',
    'X-AspNet-Version',
    'X-AspNetMvc-Version'
  ]
}

// Security testing thresholds
const securityThresholds = {
  vulnerabilities: {
    high: 0,      // Zero tolerance for high-risk vulnerabilities
    medium: 5,    // Maximum 5 medium-risk vulnerabilities
    low: 20,      // Maximum 20 low-risk vulnerabilities
    info: 50      // Maximum 50 informational findings
  },
  
  performance: {
    scanDuration: 3600,     // Max 1 hour for comprehensive scan
    falsePositiveRate: 0.1, // Max 10% false positive rate
    coverage: 0.9           // Minimum 90% code coverage
  },
  
  compliance: {
    owasp: {
      required: [
        'A01:2021-Broken Access Control',
        'A02:2021-Cryptographic Failures', 
        'A03:2021-Injection',
        'A04:2021-Insecure Design',
        'A05:2021-Security Misconfiguration',
        'A06:2021-Vulnerable and Outdated Components',
        'A07:2021-Identification and Authentication Failures',
        'A08:2021-Software and Data Integrity Failures',
        'A09:2021-Security Logging and Monitoring Failures',
        'A10:2021-Server-Side Request Forgery'
      ]
    },
    
    pci: {
      required: [
        'encrypted_data_transmission',
        'secure_card_data_storage',
        'access_control_measures',
        'network_monitoring',
        'vulnerability_management',
        'security_testing'
      ]
    }
  }
}

// Export configuration
module.exports = {
  zapConfig,
  securityScenarios,
  securityHeaders,
  securityThresholds
}