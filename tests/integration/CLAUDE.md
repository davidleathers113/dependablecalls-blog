# Integration Test Patterns

# Test Structure

```
integration/
├── api/           # API endpoint tests
├── database/      # Database operation tests
├── workflows/     # Multi-step process tests
├── webhooks/      # Webhook handler tests
└── services/      # Service integration tests
```

# API Integration Tests

```tsx
// api/campaigns.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createTestClient } from '../helpers/test-client'
import { testUsers, testCampaigns } from '@/tests/fixtures'

describe('Campaign API Integration', () => {
  let client: TestClient
  let authToken: string

  beforeAll(async () => {
    client = createTestClient()
    authToken = await client.authenticate(testUsers.buyer)
  })

  describe('POST /api/campaigns', () => {
    it('should create campaign with valid data', async () => {
      const response = await client.post('/api/campaigns', {
        headers: { Authorization: `Bearer ${authToken}` },
        body: testCampaigns.active,
      })

      expect(response.status).toBe(201)
      expect(response.data).toMatchObject({
        name: testCampaigns.active.name,
        status: 'draft', // New campaigns start as draft
      })
    })

    it('should validate required fields', async () => {
      const response = await client.post('/api/campaigns', {
        headers: { Authorization: `Bearer ${authToken}` },
        body: { name: '' }, // Missing required fields
      })

      expect(response.status).toBe(400)
      expect(response.error).toContain('validation')
    })
  })
})
```

# Database Integration Tests

```tsx
// database/user-operations.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { supabase } from '@/lib/supabase'
import { testUsers } from '@/tests/fixtures'

describe('User Database Operations', () => {
  beforeEach(async () => {
    // Clean up test data
    await supabase.from('users').delete().eq('email', 'integration@test.com')
  })

  it('should create user with profile', async () => {
    const { data, error } = await supabase
      .from('users')
      .insert({
        email: 'integration@test.com',
        role: 'supplier',
        profile: {
          company: 'Integration Test Co',
          phone: '5551234567',
        },
      })
      .select()
      .single()

    expect(error).toBeNull()
    expect(data).toMatchObject({
      email: 'integration@test.com',
      role: 'supplier',
    })
  })

  it('should enforce unique email constraint', async () => {
    // Insert first user
    await supabase.from('users').insert({
      email: 'duplicate@test.com',
      role: 'buyer',
    })

    // Try to insert duplicate
    const { error } = await supabase.from('users').insert({
      email: 'duplicate@test.com',
      role: 'supplier',
    })

    expect(error).toBeDefined()
    expect(error?.code).toBe('23505') // Unique violation
  })
})
```

# Workflow Integration Tests

```tsx
// workflows/call-lifecycle.test.ts
describe('Call Lifecycle Workflow', () => {
  it('should complete full call workflow', async () => {
    // 1. Supplier logs in
    const supplier = await authService.login(testUsers.supplier.email, testUsers.supplier.password)

    // 2. Get tracking number
    const tracking = await callService.generateTrackingNumber(
      testCampaigns.active.id,
      supplier.user.id
    )

    // 3. Start call
    const call = await callService.startCall({
      tracking_number: tracking.number,
      caller_number: '4155551234',
    })

    // 4. Simulate call duration
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // 5. End call
    const completed = await callService.endCall(call.id, {
      duration: 120,
      quality_score: 8,
    })

    // 6. Verify payout calculation
    expect(completed.payout_amount).toBeGreaterThan(0)
    expect(completed.status).toBe('completed')

    // 7. Check analytics update
    const analytics = await analyticsService.getCampaignMetrics(testCampaigns.active.id)
    expect(analytics.totalCalls).toBeGreaterThanOrEqual(1)
  })
})
```

# Service Integration Tests

```tsx
// services/stripe-integration.test.ts
import { describe, it, expect, vi } from 'vitest'
import { BillingService } from '@/services/billing'
import { stripe } from '@/integrations/stripe'

describe('Stripe Integration', () => {
  let billingService: BillingService

  beforeEach(() => {
    billingService = new BillingService(stripe)
  })

  it('should create payment intent', async () => {
    const result = await billingService.createPaymentIntent({
      amount: 100.0,
      currency: 'usd',
      customer_id: 'cus_test_123',
    })

    expect(result.id).toMatch(/^pi_/)
    expect(result.amount).toBe(10000) // Cents
    expect(result.currency).toBe('usd')
  })

  it('should handle payment failures', async () => {
    // Mock failed payment
    vi.spyOn(stripe.paymentIntents, 'create').mockRejectedValue(new Error('Card declined'))

    await expect(
      billingService.processPayment({
        amount: 100.0,
        payment_method: 'pm_card_declined',
      })
    ).rejects.toThrow('Card declined')
  })
})
```

# Webhook Integration Tests

```tsx
// webhooks/stripe-webhooks.test.ts
import { describe, it, expect } from 'vitest'
import { handleStripeWebhook } from '@/api/webhooks/stripe'
import { stripe } from '@/integrations/stripe'

describe('Stripe Webhook Integration', () => {
  it('should handle payment success webhook', async () => {
    const payload = {
      id: 'evt_test_123',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_123',
          amount: 5000,
          currency: 'usd',
          metadata: {
            user_id: testUsers.buyer.id,
            campaign_id: testCampaigns.active.id,
          },
        },
      },
    }

    const signature = stripe.webhooks.generateTestHeaderString({
      payload: JSON.stringify(payload),
      secret: process.env.STRIPE_WEBHOOK_SECRET!,
    })

    const response = await handleStripeWebhook(JSON.stringify(payload), signature)

    expect(response.success).toBe(true)

    // Verify transaction was recorded
    const { data: transaction } = await supabase
      .from('transactions')
      .select()
      .eq('stripe_payment_intent_id', 'pi_test_123')
      .single()

    expect(transaction).toBeDefined()
    expect(transaction.status).toBe('succeeded')
  })
})
```

# Real-time Integration Tests

```tsx
// integration/realtime-updates.test.ts
describe('Real-time Updates', () => {
  it('should receive call status updates', async () => {
    const updates: any[] = []

    // Subscribe to updates
    const channel = supabase
      .channel('test-calls')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'calls',
        },
        (payload) => {
          updates.push(payload)
        }
      )
      .subscribe()

    // Wait for subscription
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Create and update call
    const { data: call } = await supabase
      .from('calls')
      .insert({
        campaign_id: testCampaigns.active.id,
        supplier_id: testUsers.supplier.id,
        tracking_number: '18005559999',
        status: 'active',
      })
      .select()
      .single()

    // Update call status
    await supabase.from('calls').update({ status: 'completed' }).eq('id', call.id)

    // Wait for update
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Verify update received
    expect(updates).toHaveLength(1)
    expect(updates[0].new.status).toBe('completed')

    // Cleanup
    supabase.removeChannel(channel)
  })
})
```

# Multi-Service Integration

```tsx
// integration/campaign-creation-flow.test.ts
describe('Campaign Creation Flow', () => {
  it('should create campaign with all integrations', async () => {
    // 1. Create campaign in database
    const campaign = await campaignService.create({
      name: 'Integration Test Campaign',
      buyer_id: testUsers.buyer.id,
      vertical: 'insurance',
      target_cpa: 50,
      daily_budget: 1000,
    })

    // 2. Set up Stripe billing
    const subscription = await billingService.createCampaignSubscription({
      campaign_id: campaign.id,
      plan: 'pro',
      payment_method: 'pm_test_123',
    })

    // 3. Initialize analytics
    await analyticsService.initializeCampaignMetrics(campaign.id)

    // 4. Configure fraud detection
    await fraudService.setupCampaignRules(campaign.id, {
      duplicate_threshold: 3,
      min_call_duration: 30,
    })

    // 5. Verify all integrations
    const fullCampaign = await campaignService.getWithIntegrations(campaign.id)

    expect(fullCampaign).toMatchObject({
      id: campaign.id,
      subscription: { status: 'active' },
      analytics: { totalCalls: 0 },
      fraud_rules: { duplicate_threshold: 3 },
    })
  })
})
```

# Error Handling Integration

```tsx
describe('Error Handling Across Services', () => {
  it('should rollback on partial failure', async () => {
    // Mock stripe failure
    vi.spyOn(stripe.subscriptions, 'create').mockRejectedValue(new Error('Payment failed'))

    await expect(
      campaignService.createWithBilling({
        campaign: testCampaigns.active,
        payment_method: 'pm_card_declined',
      })
    ).rejects.toThrow()

    // Verify campaign was not created
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select()
      .eq('name', testCampaigns.active.name)

    expect(campaigns).toHaveLength(0)
  })
})
```

# Performance Integration Tests

```tsx
describe('Integration Performance', () => {
  it('should handle concurrent operations', async () => {
    const operations = Array.from({ length: 10 }, (_, i) =>
      callService.startCall({
        campaign_id: testCampaigns.active.id,
        supplier_id: testUsers.supplier.id,
        caller_number: `415555${i.toString().padStart(4, '0')}`,
      })
    )

    const start = performance.now()
    const results = await Promise.all(operations)
    const duration = performance.now() - start

    expect(results).toHaveLength(10)
    expect(duration).toBeLessThan(5000) // Should complete within 5s
  })
})
```

# Test Helpers

```tsx
// helpers/test-client.ts
export class TestClient {
  constructor(private baseURL = 'http://localhost:3000') {}

  async authenticate(user: TestUser): Promise<string> {
    const response = await fetch(`${this.baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        password: user.password,
      }),
    })

    const data = await response.json()
    return data.access_token
  }

  async post(endpoint: string, options: RequestOptions) {
    return this.request('POST', endpoint, options)
  }

  private async request(method: string, endpoint: string, options: RequestOptions) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(options.body),
    })

    const data = await response.json()
    return {
      status: response.status,
      data: response.ok ? data : null,
      error: !response.ok ? data : null,
    }
  }
}
```

# Environment Setup

```tsx
// setup.ts
import { beforeAll, afterAll } from 'vitest'

beforeAll(async () => {
  // Set up test database
  await setupTestDatabase()

  // Initialize test services
  await initializeServices()

  // Mock external APIs if needed
  mockExternalAPIs()
})

afterAll(async () => {
  // Clean up test data
  await cleanupTestData()

  // Close connections
  await closeConnections()
})
```

# CRITICAL RULES

- NO regex in integration tests
- NO any types in test code
- ALWAYS clean up test data
- ALWAYS use test database
- ALWAYS mock external services
- ALWAYS test error scenarios
- ALWAYS verify side effects
- TEST real integration points
- ISOLATE tests from each other
- MONITOR test execution time
