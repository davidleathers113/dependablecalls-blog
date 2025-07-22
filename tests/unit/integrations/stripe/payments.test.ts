import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createPaymentIntent,
  confirmPaymentIntent,
  cancelPaymentIntent,
  getPaymentIntent,
  capturePaymentIntent,
  listPayments,
  createRefund,
  getPaymentStatus,
} from '@/integrations/stripe/payments'
import { stripeServerClient } from '@/integrations/stripe/client'
import type Stripe from 'stripe'
import type { CreatePaymentIntentParams } from '@/integrations/stripe/types'

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-123'),
}))

// Mock the stripe client
vi.mock('@/integrations/stripe/client', () => ({
  stripeServerClient: {
    paymentIntents: {
      create: vi.fn(),
      confirm: vi.fn(),
      cancel: vi.fn(),
      retrieve: vi.fn(),
      capture: vi.fn(),
      list: vi.fn(),
    },
    refunds: {
      create: vi.fn(),
    },
    errors: {
      StripeError: class StripeError extends Error {
        constructor(
          public type: string,
          public code: string,
          public param?: string,
          public requestId?: string
        ) {
          super('Stripe error')
          this.name = 'StripeError'
        }
      },
    },
  },
}))

describe('Stripe Payments Module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createPaymentIntent', () => {
    const mockPaymentIntent = {
      id: 'pi_123',
      amount: 5000,
      status: 'requires_payment_method',
    } as Stripe.PaymentIntent

    const params: CreatePaymentIntentParams = {
      amount: 5000,
      currency: 'usd',
      customerId: 'cus_123',
      metadata: {
        campaignId: 'campaign_123',
        buyerId: 'buyer_123',
      },
    }

    it('should create payment intent with default payment method types', async () => {
      vi.mocked(stripeServerClient.paymentIntents.create).mockResolvedValue(mockPaymentIntent)

      const result = await createPaymentIntent(params)

      expect(stripeServerClient.paymentIntents.create).toHaveBeenCalledWith(
        {
          amount: 5000,
          currency: 'usd',
          customer: 'cus_123',
          payment_method_types: ['card', 'us_bank_account'],
          metadata: {
            campaignId: 'campaign_123',
            buyerId: 'buyer_123',
            platform: 'dependablecalls',
          },
          setup_future_usage: 'off_session',
          automatic_payment_methods: {
            enabled: true,
          },
        },
        { idempotencyKey: 'mock-uuid-123' }
      )
      expect(result).toEqual(mockPaymentIntent)
    })

    it('should create payment intent with custom payment method types', async () => {
      vi.mocked(stripeServerClient.paymentIntents.create).mockResolvedValue(mockPaymentIntent)

      const customParams: CreatePaymentIntentParams = {
        ...params,
        paymentMethodTypes: ['card'],
      }

      await createPaymentIntent(customParams)

      expect(stripeServerClient.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method_types: ['card'],
        }),
        { idempotencyKey: 'mock-uuid-123' }
      )
    })

    it('should handle Stripe errors properly', async () => {
      const stripeError = new stripeServerClient.errors.StripeError(
        'card_error',
        'card_declined',
        'payment_method',
        'req_123'
      )
      vi.mocked(stripeServerClient.paymentIntents.create).mockRejectedValue(stripeError)

      await expect(createPaymentIntent(params)).rejects.toThrow(
        'Payment service error. Please retry or contact support.'
      )

      expect(console.error).toHaveBeenCalledWith('create payment intent failed', {
        type: 'card_error',
        code: 'card_declined',
        param: 'payment_method',
        requestId: 'req_123',
      })
    })

    it('should handle resource_missing errors with specific message', async () => {
      const stripeError = new stripeServerClient.errors.StripeError(
        'invalid_request_error',
        'resource_missing'
      )
      vi.mocked(stripeServerClient.paymentIntents.create).mockRejectedValue(stripeError)

      await expect(createPaymentIntent(params)).rejects.toThrow(
        'Resource not found. Please check your request and try again.'
      )
    })

    it('should handle unexpected errors', async () => {
      vi.mocked(stripeServerClient.paymentIntents.create).mockRejectedValue(
        new Error('Network error')
      )

      await expect(createPaymentIntent(params)).rejects.toThrow(
        'Internal server error. Please try again later.'
      )
    })
  })

  describe('confirmPaymentIntent', () => {
    const mockConfirmedIntent = {
      id: 'pi_123',
      status: 'processing',
    } as Stripe.PaymentIntent

    it('should confirm payment intent successfully', async () => {
      vi.mocked(stripeServerClient.paymentIntents.confirm).mockResolvedValue(mockConfirmedIntent)

      const result = await confirmPaymentIntent('pi_123', 'pm_123', 'https://example.com/return')

      expect(stripeServerClient.paymentIntents.confirm).toHaveBeenCalledWith(
        'pi_123',
        {
          payment_method: 'pm_123',
          return_url: 'https://example.com/return',
        },
        { idempotencyKey: 'mock-uuid-123' }
      )
      expect(result).toEqual(mockConfirmedIntent)
    })

    it('should handle confirmation errors', async () => {
      vi.mocked(stripeServerClient.paymentIntents.confirm).mockRejectedValue(
        new Error('Confirmation failed')
      )

      await expect(
        confirmPaymentIntent('pi_123', 'pm_123', 'https://example.com/return')
      ).rejects.toThrow('Internal server error. Please try again later.')
    })
  })

  describe('cancelPaymentIntent', () => {
    const mockCancelledIntent = {
      id: 'pi_123',
      status: 'canceled',
    } as Stripe.PaymentIntent

    it('should cancel payment intent with default reason', async () => {
      vi.mocked(stripeServerClient.paymentIntents.cancel).mockResolvedValue(mockCancelledIntent)

      const result = await cancelPaymentIntent('pi_123')

      expect(stripeServerClient.paymentIntents.cancel).toHaveBeenCalledWith(
        'pi_123',
        {
          cancellation_reason: 'requested_by_customer',
        },
        { idempotencyKey: 'mock-uuid-123' }
      )
      expect(result).toEqual(mockCancelledIntent)
    })

    it('should cancel payment intent with custom reason', async () => {
      vi.mocked(stripeServerClient.paymentIntents.cancel).mockResolvedValue(mockCancelledIntent)

      await cancelPaymentIntent('pi_123', 'duplicate')

      expect(stripeServerClient.paymentIntents.cancel).toHaveBeenCalledWith(
        'pi_123',
        {
          cancellation_reason: 'duplicate',
        },
        { idempotencyKey: 'mock-uuid-123' }
      )
    })

    it('should handle cancellation errors', async () => {
      vi.mocked(stripeServerClient.paymentIntents.cancel).mockRejectedValue(
        new Error('Cancellation failed')
      )

      await expect(cancelPaymentIntent('pi_123')).rejects.toThrow(
        'Internal server error. Please try again later.'
      )
    })
  })

  describe('getPaymentIntent', () => {
    const mockPaymentIntent = {
      id: 'pi_123',
      amount: 5000,
    } as Stripe.PaymentIntent

    it('should retrieve payment intent successfully', async () => {
      vi.mocked(stripeServerClient.paymentIntents.retrieve).mockResolvedValue(mockPaymentIntent)

      const result = await getPaymentIntent('pi_123')

      expect(stripeServerClient.paymentIntents.retrieve).toHaveBeenCalledWith('pi_123')
      expect(result).toEqual(mockPaymentIntent)
    })

    it('should return null for missing payment intent', async () => {
      const missingError = new stripeServerClient.errors.StripeError(
        'invalid_request_error',
        'resource_missing'
      )
      vi.mocked(stripeServerClient.paymentIntents.retrieve).mockRejectedValue(missingError)

      const result = await getPaymentIntent('pi_123')

      expect(result).toBeNull()
    })

    it('should handle other retrieval errors', async () => {
      vi.mocked(stripeServerClient.paymentIntents.retrieve).mockRejectedValue(
        new Error('Retrieval failed')
      )

      await expect(getPaymentIntent('pi_123')).rejects.toThrow(
        'Internal server error. Please try again later.'
      )
    })
  })

  describe('capturePaymentIntent', () => {
    const mockCapturedIntent = {
      id: 'pi_123',
      status: 'succeeded',
    } as Stripe.PaymentIntent

    it('should capture full amount by default', async () => {
      vi.mocked(stripeServerClient.paymentIntents.capture).mockResolvedValue(mockCapturedIntent)

      const result = await capturePaymentIntent('pi_123')

      expect(stripeServerClient.paymentIntents.capture).toHaveBeenCalledWith(
        'pi_123',
        {},
        { idempotencyKey: 'mock-uuid-123' }
      )
      expect(result).toEqual(mockCapturedIntent)
    })

    it('should capture partial amount when specified', async () => {
      vi.mocked(stripeServerClient.paymentIntents.capture).mockResolvedValue(mockCapturedIntent)

      await capturePaymentIntent('pi_123', 3000)

      expect(stripeServerClient.paymentIntents.capture).toHaveBeenCalledWith(
        'pi_123',
        { amount_to_capture: 3000 },
        { idempotencyKey: 'mock-uuid-123' }
      )
    })

    it('should handle capture errors', async () => {
      vi.mocked(stripeServerClient.paymentIntents.capture).mockRejectedValue(
        new Error('Capture failed')
      )

      await expect(capturePaymentIntent('pi_123')).rejects.toThrow(
        'Internal server error. Please try again later.'
      )
    })
  })

  describe('createRefund', () => {
    const mockRefund = {
      id: 'refund_123',
      amount: 2000,
      status: 'succeeded',
    } as Stripe.Refund

    it('should create full refund', async () => {
      vi.mocked(stripeServerClient.refunds.create).mockResolvedValue(mockRefund)

      const result = await createRefund('pi_123', undefined, 'requested_by_customer')

      expect(stripeServerClient.refunds.create).toHaveBeenCalledWith(
        {
          payment_intent: 'pi_123',
          reason: 'requested_by_customer',
          metadata: {
            platform: 'dependablecalls',
          },
        },
        { idempotencyKey: 'mock-uuid-123' }
      )
      expect(result).toEqual(mockRefund)
    })

    it('should create partial refund', async () => {
      vi.mocked(stripeServerClient.refunds.create).mockResolvedValue(mockRefund)

      await createRefund('pi_123', 2000, 'duplicate', { orderId: 'order_123' })

      expect(stripeServerClient.refunds.create).toHaveBeenCalledWith(
        {
          payment_intent: 'pi_123',
          amount: 2000,
          reason: 'duplicate',
          metadata: {
            orderId: 'order_123',
            platform: 'dependablecalls',
          },
        },
        { idempotencyKey: 'mock-uuid-123' }
      )
    })

    it('should handle refund errors', async () => {
      vi.mocked(stripeServerClient.refunds.create).mockRejectedValue(new Error('Refund failed'))

      await expect(createRefund('pi_123')).rejects.toThrow(
        'Internal server error. Please try again later.'
      )
    })
  })

  describe('listPayments', () => {
    const mockPayments = {
      data: [
        { id: 'pi_1', amount: 5000 },
        { id: 'pi_2', amount: 3000 },
      ],
    } as Stripe.ApiList<Stripe.PaymentIntent>

    it('should list customer payments', async () => {
      vi.mocked(stripeServerClient.paymentIntents.list).mockResolvedValue(mockPayments)

      const result = await listPayments({ customerId: 'cus_123' })

      expect(stripeServerClient.paymentIntents.list).toHaveBeenCalledWith({
        customer: 'cus_123',
        limit: 100,
      })
      expect(result).toEqual(mockPayments.data)
    })

    it('should list payments with filters', async () => {
      vi.mocked(stripeServerClient.paymentIntents.list).mockResolvedValue(mockPayments)

      await listPayments({
        customerId: 'cus_123',
        status: 'succeeded',
        limit: 50,
        startingAfter: 'pi_0',
      })

      expect(stripeServerClient.paymentIntents.list).toHaveBeenCalledWith({
        customer: 'cus_123',
        limit: 50,
        starting_after: 'pi_0',
      })
    })

    it('should handle listing errors', async () => {
      vi.mocked(stripeServerClient.paymentIntents.list).mockRejectedValue(new Error('List failed'))

      await expect(listPayments({ customerId: 'cus_123' })).rejects.toThrow(
        'Internal server error. Please try again later.'
      )
    })
  })

  describe('getPaymentStatus', () => {
    it('should map succeeded status', () => {
      const paymentIntent = {
        status: 'succeeded',
        last_payment_error: null,
      } as Stripe.PaymentIntent

      const status = getPaymentStatus(paymentIntent)

      expect(status).toEqual({
        status: 'succeeded',
        isTerminal: true,
        requiresAction: false,
        error: null,
      })
    })

    it('should map requires_action status', () => {
      const paymentIntent = {
        status: 'requires_action',
        last_payment_error: null,
      } as Stripe.PaymentIntent

      const status = getPaymentStatus(paymentIntent)

      expect(status).toEqual({
        status: 'requires_action',
        isTerminal: false,
        requiresAction: true,
        error: null,
      })
    })

    it('should include error information', () => {
      const paymentIntent = {
        status: 'requires_payment_method',
        last_payment_error: {
          code: 'card_declined',
          message: 'Your card was declined',
        },
      } as Stripe.PaymentIntent

      const status = getPaymentStatus(paymentIntent)

      expect(status).toEqual({
        status: 'requires_payment_method',
        isTerminal: false,
        requiresAction: false,
        error: {
          code: 'card_declined',
          message: 'Your card was declined',
        },
      })
    })
  })
})
