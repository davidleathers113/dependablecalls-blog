import { describe, it, expect, vi, beforeEach } from 'vitest'
import Stripe from 'stripe'

// Mock Stripe
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      paymentIntents: {
        create: vi.fn(),
        confirm: vi.fn(),
        cancel: vi.fn(),
        retrieve: vi.fn(),
      },
      customers: {
        create: vi.fn(),
        update: vi.fn(),
        retrieve: vi.fn(),
      },
      webhooks: {
        constructEvent: vi.fn(),
      },
      accounts: {
        create: vi.fn(),
        retrieve: vi.fn(),
      },
      transfers: {
        create: vi.fn(),
      },
    })),
    errors: {
      StripeError: class extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'StripeError'
        }
      },
    },
  }
})

// Mock @stripe/stripe-js
vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn().mockResolvedValue({
    confirmPayment: vi.fn(),
    confirmSetup: vi.fn(),
    elements: vi.fn(),
  }),
}))

describe('Stripe Client Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock environment variables
    vi.stubEnv('VITE_STRIPE_SECRET_KEY', 'sk_test_mock_secret_key')
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_test_mock_publishable_key')
    vi.stubEnv('VITE_STRIPE_WEBHOOK_SECRET', 'whsec_mock_webhook_secret')
  })

  it('should create Stripe server client with correct configuration', async () => {
    const { stripeServerClient } = await import('../../../src/integrations/stripe/client')

    expect(stripeServerClient).toBeDefined()
    // Verify the client was created (mocked)
    expect(vi.mocked(Stripe)).toHaveBeenCalledWith(
      'sk_test_mock_secret_key',
      expect.objectContaining({
        apiVersion: '2025-06-30.basil',
        typescript: true,
      })
    )
  })

  it('should load Stripe client for frontend', async () => {
    const { getStripeClient } = await import('../../../src/integrations/stripe/client')
    const { loadStripe } = await import('@stripe/stripe-js')

    const client = await getStripeClient()

    expect(loadStripe).toHaveBeenCalledWith('pk_test_mock_publishable_key')
    expect(client).toBeDefined()
  })

  it('should check if Stripe is configured', async () => {
    const { isStripeConfigured } = await import('../../../src/integrations/stripe/client')

    const isConfigured = isStripeConfigured()

    expect(isConfigured).toBe(true)
  })

  it('should return false when Stripe is not configured', async () => {
    // Clear environment variables
    vi.stubEnv('VITE_STRIPE_SECRET_KEY', '')
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', '')

    // Need to re-import to get updated env values
    vi.resetModules()
    const { isStripeConfigured } = await import('../../../src/integrations/stripe/client')

    const isConfigured = isStripeConfigured()

    expect(isConfigured).toBe(false)
  })

  it('should have correct stripe config', async () => {
    const { stripeConfig } = await import('../../../src/integrations/stripe/client')

    expect(stripeConfig).toEqual({
      webhookSecret: 'whsec_mock_webhook_secret',
      connectClientId: '', // Not set in test
      apiVersion: '2025-06-30.basil',
    })
  })
})
