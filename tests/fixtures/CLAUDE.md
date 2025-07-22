# Test Fixtures & Data

# Fixture Organization

```
fixtures/
├── users.ts        # User test data
├── campaigns.ts    # Campaign fixtures
├── calls.ts        # Call tracking data
├── billing.ts      # Payment test data
├── auth.ts         # Authentication fixtures
└── index.ts        # Export all fixtures
```

# User Fixtures

```tsx
// users.ts
export const testUsers = {
  supplier: {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'supplier@test.com',
    password: 'Test123!@#',
    role: 'supplier' as const,
    profile: {
      company: 'Test Traffic Co',
      phone: '5551234567',
    },
  },
  buyer: {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'buyer@test.com',
    password: 'Test123!@#',
    role: 'buyer' as const,
    profile: {
      company: 'Test Buyer Inc',
      phone: '5559876543',
    },
  },
  admin: {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'admin@test.com',
    password: 'Admin123!@#',
    role: 'admin' as const,
  },
}

export const invalidUsers = {
  noEmail: { password: 'Test123!@#' },
  noPassword: { email: 'test@example.com' },
  invalidEmail: { email: 'not-an-email', password: 'Test123!@#' },
  shortPassword: { email: 'test@example.com', password: '123' },
}
```

# Campaign Fixtures

```tsx
// campaigns.ts
export const testCampaigns = {
  active: {
    id: 'camp-001',
    buyer_id: testUsers.buyer.id,
    name: 'Insurance Leads - National',
    vertical: 'insurance' as const,
    status: 'active' as const,
    target_cpa: 50.0,
    daily_budget: 1000.0,
    filters: {
      states: ['CA', 'TX', 'FL'],
      age_range: [25, 65],
      time_restrictions: [
        {
          days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
          start_hour: 9,
          end_hour: 17,
        },
      ],
    },
  },
  paused: {
    id: 'camp-002',
    buyer_id: testUsers.buyer.id,
    name: 'Home Services - Regional',
    vertical: 'home_services' as const,
    status: 'paused' as const,
    target_cpa: 75.0,
    daily_budget: 500.0,
  },
  completed: {
    id: 'camp-003',
    buyer_id: testUsers.buyer.id,
    name: 'Legal Leads - Test',
    vertical: 'legal' as const,
    status: 'completed' as const,
    target_cpa: 100.0,
    daily_budget: 2000.0,
  },
}

export function createCampaign(overrides = {}) {
  return {
    ...testCampaigns.active,
    id: `camp-${Date.now()}`,
    ...overrides,
  }
}
```

# Call Fixtures

```tsx
// calls.ts
export const testCalls = {
  completed: {
    id: 'call-001',
    campaign_id: testCampaigns.active.id,
    supplier_id: testUsers.supplier.id,
    tracking_number: '18005551234',
    caller_number: '4155551234',
    duration: 180, // 3 minutes
    status: 'completed' as const,
    quality_score: 8,
    payout_amount: 45.0,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  active: {
    id: 'call-002',
    campaign_id: testCampaigns.active.id,
    supplier_id: testUsers.supplier.id,
    tracking_number: '18005551235',
    caller_number: '4155551235',
    duration: 0,
    status: 'active' as const,
    created_at: new Date().toISOString(),
  },
  failed: {
    id: 'call-003',
    campaign_id: testCampaigns.active.id,
    supplier_id: testUsers.supplier.id,
    tracking_number: '18005551236',
    caller_number: '4155551236',
    duration: 5,
    status: 'failed' as const,
    quality_score: 0,
    payout_amount: 0,
  },
}

export function generateCallBatch(count: number, status = 'completed') {
  return Array.from({ length: count }, (_, i) => ({
    ...testCalls.completed,
    id: `call-batch-${i}`,
    tracking_number: `1800555${(2000 + i).toString().padStart(4, '0')}`,
    status,
    created_at: new Date(Date.now() - i * 3600000).toISOString(),
  }))
}
```

# Billing Fixtures

```tsx
// billing.ts
export const testPaymentMethods = {
  card: {
    id: 'pm_test_card',
    type: 'card',
    card: {
      brand: 'visa',
      last4: '4242',
      exp_month: 12,
      exp_year: 2025,
    },
  },
  bank: {
    id: 'pm_test_bank',
    type: 'us_bank_account',
    us_bank_account: {
      bank_name: 'Test Bank',
      last4: '6789',
      account_type: 'checking',
    },
  },
}

export const testTransactions = {
  payout: {
    id: 'txn-001',
    amount: 1250.5,
    currency: 'usd',
    type: 'payout' as const,
    status: 'succeeded' as const,
    user_id: testUsers.supplier.id,
    stripe_payout_id: 'po_test_123',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  charge: {
    id: 'txn-002',
    amount: 500.0,
    currency: 'usd',
    type: 'charge' as const,
    status: 'succeeded' as const,
    user_id: testUsers.buyer.id,
    stripe_payment_intent_id: 'pi_test_456',
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
}
```

# Authentication Fixtures

```tsx
// auth.ts
export const authTokens = {
  valid: {
    access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    refresh_token: 'refresh_token_123',
    expires_in: 3600,
    token_type: 'bearer',
  },
  expired: {
    access_token: 'expired_token',
    refresh_token: 'expired_refresh',
    expires_in: -1,
    token_type: 'bearer',
  },
}

export const authSessions = {
  supplier: {
    user: testUsers.supplier,
    session: authTokens.valid,
  },
  buyer: {
    user: testUsers.buyer,
    session: authTokens.valid,
  },
}
```

# Mock API Responses

```tsx
export const mockApiResponses = {
  success: <T>(data: T) => ({
    data,
    error: null,
    status: 200,
  }),
  error: (message: string, code = 400) => ({
    data: null,
    error: { message, code },
    status: code,
  }),
  paginated: <T>(data: T[], page = 1, limit = 10) => ({
    data,
    pagination: {
      page,
      limit,
      total: data.length,
      totalPages: Math.ceil(data.length / limit),
    },
    error: null,
    status: 200,
  }),
};
```

# Date/Time Fixtures

```tsx
export const testDates = {
  today: new Date(),
  yesterday: new Date(Date.now() - 86400000),
  lastWeek: new Date(Date.now() - 604800000),
  lastMonth: new Date(Date.now() - 2592000000),
  nextWeek: new Date(Date.now() + 604800000),
}

export const testTimeRanges = {
  today: {
    start: new Date(new Date().setHours(0, 0, 0, 0)),
    end: new Date(new Date().setHours(23, 59, 59, 999)),
  },
  thisWeek: {
    start: new Date(Date.now() - 604800000),
    end: new Date(),
  },
  thisMonth: {
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
  },
}
```

# Form Data Fixtures

```tsx
export const testFormData = {
  validCampaign: {
    name: 'Test Campaign',
    vertical: 'insurance',
    target_cpa: '50',
    daily_budget: '1000',
    description: 'Test campaign description',
  },
  invalidCampaign: {
    name: '', // Required field
    vertical: 'invalid_vertical',
    target_cpa: '-10', // Negative value
    daily_budget: 'not a number',
  },
  validRegistration: {
    email: 'newuser@test.com',
    password: 'SecurePass123!',
    confirmPassword: 'SecurePass123!',
    company: 'Test Company',
    phone: '5551234567',
    role: 'supplier',
  },
}
```

# Analytics Fixtures

```tsx
export const testAnalytics = {
  campaignMetrics: {
    totalCalls: 1250,
    conversionRate: 12.5,
    averageCallDuration: 145,
    revenue: 15625.5,
    costPerAcquisition: 45.75,
    qualityScore: 7.8,
  },
  supplierStats: {
    totalCalls: 3450,
    acceptedCalls: 3105,
    rejectedCalls: 345,
    totalEarnings: 45678.9,
    averageQuality: 8.2,
    fraudScore: 0.02,
  },
}
```

# Error Fixtures

```tsx
export const testErrors = {
  networkError: new Error('Network request failed'),
  validationError: {
    field: 'email',
    message: 'Invalid email format',
  },
  authError: {
    code: 'auth/invalid-credentials',
    message: 'Invalid email or password',
  },
  serverError: {
    status: 500,
    message: 'Internal server error',
  },
}
```

# Fixture Utilities

```tsx
export function seedDatabase() {
  // Utility to seed test database
  return {
    users: Object.values(testUsers),
    campaigns: Object.values(testCampaigns),
    calls: generateCallBatch(100),
  }
}

export function resetFixtures() {
  // Reset all fixtures to original state
  Object.keys(testUsers).forEach((key) => {
    testUsers[key].id = testUsers[key].id
  })
}

export function generateMockData(type: string, count: number) {
  switch (type) {
    case 'calls':
      return generateCallBatch(count)
    case 'campaigns':
      return Array.from({ length: count }, () => createCampaign())
    default:
      throw new Error(`Unknown fixture type: ${type}`)
  }
}
```

# CRITICAL RULES

- NO production data in fixtures
- NO real API keys or secrets
- ALWAYS use consistent IDs
- ALWAYS provide edge case data
- ALWAYS include error scenarios
- USE factories for dynamic data
- KEEP fixtures maintainable
- UPDATE fixtures when schema changes
- TEST both valid and invalid data
- DOCUMENT complex fixture relationships
