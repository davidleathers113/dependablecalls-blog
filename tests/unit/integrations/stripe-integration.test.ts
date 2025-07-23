import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'
import {
  createPaymentIntent,
  validateStripeEnvironment,
  getStripeClient,
  isStripeConfigured,
} from '../../../src/integrations/stripe'

// Mock environment variables
vi.mock('import.meta', () => ({
  env: {
    VITE_STRIPE_SECRET_KEY: 'sk_test_mock_secret_key',
    VITE_STRIPE_PUBLISHABLE_KEY: 'pk_test_mock_publishable_key',
    VITE_STRIPE_WEBHOOK_SECRET: 'whsec_mock_webhook_secret',
  },
}))

// Mock Stripe
vi.mock('stripe', () => {
  const mockStripe = {
    paymentIntents: {
      create: vi.fn(),
      confirm: vi.fn(),
      cancel: vi.fn(),
      retrieve: vi.fn(),
    },
    customers: {
      create: vi.fn(),
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
  }

  return {
    default: vi.fn(() => mockStripe),
  }
})

// Mock loadStripe
vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn().mockResolvedValue({
    confirmPayment: vi.fn(),
    confirmSetup: vi.fn(),
  }),
}))

describe('Stripe Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Environment Validation', () => {
    it('should validate required environment variables', () => {
      const result = validateStripeEnvironment()

      expect(result.isValid).toBe(true)
      expect(result.missing).toHaveLength(0)
    })

    it('should detect missing environment variables', () => {
      vi.doMock('import.meta', () => ({
        env: {
          VITE_STRIPE_SECRET_KEY: '',
          VITE_STRIPE_PUBLISHABLE_KEY: 'pk_test_mock',
          VITE_STRIPE_WEBHOOK_SECRET: '',
        },
      }))

      const result = validateStripeEnvironment()

      expect(result.isValid).toBe(false)
      expect(result.missing).toContain('VITE_STRIPE_SECRET_KEY')
      expect(result.missing).toContain('VITE_STRIPE_WEBHOOK_SECRET')
    })

    it('should check if Stripe is configured', () => {
      expect(isStripeConfigured()).toBe(true)
    })
  })

  describe('Stripe Client', () => {
    it('should load Stripe client', async () => {
      const stripeClient = await getStripeClient()
      expect(stripeClient).toBeDefined()
    })

    it('should return the same promise for multiple calls', async () => {
      const client1 = getStripeClient()
      const client2 = getStripeClient()

      expect(client1).toBe(client2)
    })
  })

  describe('Payment Intent Creation', () => {
    it('should create payment intent with valid parameters', async () => {
      const mockPaymentIntent = {
        id: 'pi_test_12345',
        client_secret: 'pi_test_12345_secret',
        amount: 5000,
        currency: 'usd',
        status: 'requires_payment_method',
      }

      // We need to mock the actual Stripe instance returned by the constructor
      const Stripe = await import('stripe')
      const mockStripeInstance = new Stripe.default()
      vi.mocked(mockStripeInstance.paymentIntents.create).mockResolvedValue(
        mockPaymentIntent as Partial<Stripe.PaymentIntent>
      )

      const params = {
        amount: 5000, // $50.00 in cents
        currency: 'usd',
        customerId: 'cus_test_customer',
        metadata: {
          invoice_id: 'inv_test_123',
          buyer_id: 'buyer_test_456',
        },
      }

      const result = await createPaymentIntent(params)

      expect(result).toEqual(mockPaymentIntent)
      expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith(
        {
          amount: 5000,
          currency: 'usd',
          customer: 'cus_test_customer',
          payment_method_types: ['card', 'us_bank_account'],
          metadata: {
            invoice_id: 'inv_test_123',
            buyer_id: 'buyer_test_456',
            platform: 'dependablecalls',
          },
          setup_future_usage: 'off_session',
          automatic_payment_methods: {
            enabled: true,
          },
        },
        {
          idempotencyKey: expect.any(String),
        }
      )
    })

    it('should handle Stripe errors gracefully', async () => {
      const Stripe = await import('stripe')
      const mockStripeInstance = new Stripe.default()
      const stripeError = new Error('Your card was declined.') as Error & { code: string }
      stripeError.name = 'StripeCardError'
      stripeError.code = 'card_declined'

      vi.mocked(mockStripeInstance.paymentIntents.create).mockRejectedValue(stripeError)

      const params = {
        amount: 5000,
        currency: 'usd',
      }

      await expect(createPaymentIntent(params)).rejects.toThrow('Payment service error')
    })

    it('should use default payment method types', async () => {
      const mockPaymentIntent = {
        id: 'pi_test_12345',
        client_secret: 'pi_test_12345_secret',
      }

      const Stripe = await import('stripe')
      const mockStripeInstance = new Stripe.default()
      vi.mocked(mockStripeInstance.paymentIntents.create).mockResolvedValue(
        mockPaymentIntent as Partial<Stripe.PaymentIntent>
      )

      const params = {
        amount: 2500,
        currency: 'usd',
      }

      await createPaymentIntent(params)

      expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method_types: ['card', 'us_bank_account'],
        }),
        expect.any(Object)
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const Stripe = await import('stripe')
      const mockStripeInstance = new Stripe.default()
      const networkError = new Error('Network error')

      vi.mocked(mockStripeInstance.paymentIntents.create).mockRejectedValue(networkError)

      const params = {
        amount: 1000,
        currency: 'usd',
      }

      await expect(createPaymentIntent(params)).rejects.toThrow('Internal server error')
    })

    it('should include idempotency keys', async () => {
      const mockPaymentIntent = { id: 'pi_test_12345' }

      const Stripe = await import('stripe')
      const mockStripeInstance = new Stripe.default()
      vi.mocked(mockStripeInstance.paymentIntents.create).mockResolvedValue(
        mockPaymentIntent as Partial<Stripe.PaymentIntent>
      )

      const params = {
        amount: 1000,
        currency: 'usd',
      }

      await createPaymentIntent(params)

      expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          idempotencyKey: expect.any(String),
        })
      )
    })
  })

  describe('Metadata Handling', () => {
    it('should include platform metadata', async () => {
      const mockPaymentIntent = { id: 'pi_test_12345' }

      const Stripe = await import('stripe')
      const mockStripeInstance = new Stripe.default()
      vi.mocked(mockStripeInstance.paymentIntents.create).mockResolvedValue(
        mockPaymentIntent as Partial<Stripe.PaymentIntent>
      )

      const params = {
        amount: 1000,
        currency: 'usd',
        metadata: {
          custom_field: 'test_value',
        },
      }

      await createPaymentIntent(params)

      expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            platform: 'dependablecalls',
            custom_field: 'test_value',
          }),
        }),
        expect.any(Object)
      )
    })
  })
})
