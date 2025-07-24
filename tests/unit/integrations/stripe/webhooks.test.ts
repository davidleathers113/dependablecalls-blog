import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  verifyWebhookSignature,
  handleStripeWebhook,
  timingSafeEqual,
} from '@/integrations/stripe/webhooks'
import { stripeServerClient } from '@/integrations/stripe/client'
import { supabase } from '@/lib/supabase'
import type { Request, Response } from 'express'
import type Stripe from 'stripe'

// Mock dependencies
vi.mock('@/integrations/stripe/client', () => ({
  stripeServerClient: {
    webhooks: {
      constructEvent: vi.fn(),
    },
  },
  stripeConfig: {
    webhookSecret: 'whsec_test_secret',
  },
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({ error: null })),
      update: vi.fn(() => ({ error: null })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ data: null, error: null })),
        })),
        gte: vi.fn(() => ({ data: [], error: null })),
      })),
      eq: vi.fn(() => ({ error: null })),
    })),
    raw: vi.fn((sql: string) => sql),
  },
}))

describe('Stripe Webhook Handler', () => {
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let statusMock: vi.Mock
  let jsonMock: vi.Mock
  let sendMock: vi.Mock

  beforeEach(() => {
    statusMock = vi.fn().mockReturnThis()
    jsonMock = vi.fn().mockReturnThis()
    sendMock = vi.fn().mockReturnThis()

    mockRequest = {
      body: 'test-body',
      headers: {
        'stripe-signature': 'test-signature',
      },
    }

    mockResponse = {
      status: statusMock,
      json: jsonMock,
      send: sendMock,
    }

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('verifyWebhookSignature', () => {
    it('should verify valid webhook signature', () => {
      const mockEvent = { id: 'evt_123', type: 'payment_intent.succeeded' }
      vi.mocked(stripeServerClient.webhooks.constructEvent).mockReturnValue(
        mockEvent as Stripe.Event
      )

      const result = verifyWebhookSignature('payload', 'signature')

      expect(result).toEqual(mockEvent)
      expect(stripeServerClient.webhooks.constructEvent).toHaveBeenCalledWith(
        'payload',
        'signature',
        'whsec_test_secret'
      )
    })

    it('should throw error for invalid signature', () => {
      vi.mocked(stripeServerClient.webhooks.constructEvent).mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      expect(() => verifyWebhookSignature('payload', 'signature')).toThrow(
        'Webhook signature verification failed: Invalid signature'
      )
    })
  })

  describe('handleStripeWebhook', () => {
    it('should return 400 if stripe-signature header is missing', async () => {
      mockRequest.headers = {}

      await handleStripeWebhook(mockRequest as Request, mockResponse as Response)

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(sendMock).toHaveBeenCalledWith('Missing stripe-signature header')
    })

    it('should return 400 if signature verification fails', async () => {
      vi.mocked(stripeServerClient.webhooks.constructEvent).mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      await handleStripeWebhook(mockRequest as Request, mockResponse as Response)

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(sendMock).toHaveBeenCalledWith('Webhook Error: Invalid signature')
    })

    it('should handle payment_intent.succeeded event', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_123',
            amount: 10000,
            metadata: {
              buyer_id: 'buyer_123',
            },
          },
        },
      }

      vi.mocked(stripeServerClient.webhooks.constructEvent).mockReturnValue(
        mockEvent as Stripe.Event
      )

      const updateMock = vi.fn(() => ({
        eq: vi.fn(() => ({ error: null })),
      }))

      const fromMock = vi.fn(() => ({
        update: updateMock,
      }))

      vi.mocked(supabase.from).mockImplementation(fromMock as ReturnType<typeof vi.fn>)

      await handleStripeWebhook(mockRequest as Request, mockResponse as Response)

      expect(fromMock).toHaveBeenCalledWith('invoices')
      expect(updateMock).toHaveBeenCalledWith({
        status: 'paid',
        paid_at: expect.any(String),
        payment_method: 'stripe',
        stripe_payment_intent_id: 'pi_123',
      })

      expect(fromMock).toHaveBeenCalledWith('buyers')
      expect(jsonMock).toHaveBeenCalledWith({ received: true })
    })

    it('should handle payment_intent.payment_failed event', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_123',
            metadata: {
              buyer_id: 'buyer_123',
            },
            last_payment_error: {
              message: 'Card declined',
            },
          },
        },
      }

      vi.mocked(stripeServerClient.webhooks.constructEvent).mockReturnValue(
        mockEvent as Stripe.Event
      )

      await handleStripeWebhook(mockRequest as Request, mockResponse as Response)

      expect(jsonMock).toHaveBeenCalledWith({ received: true })
    })

    it('should handle charge.dispute.created event', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'charge.dispute.created',
        data: {
          object: {
            id: 'dp_123',
            amount: 5000,
            charge: 'ch_123',
            reason: 'fraudulent',
            metadata: {
              call_id: 'call_123',
              buyer_id: 'buyer_123',
            },
            evidence_details: {},
          },
        },
      }

      vi.mocked(stripeServerClient.webhooks.constructEvent).mockReturnValue(
        mockEvent as Stripe.Event
      )

      const insertMock = vi.fn(() => ({ error: null }))
      const fromMock = vi.fn(() => ({
        insert: insertMock,
      }))

      vi.mocked(supabase.from).mockImplementation(fromMock as ReturnType<typeof vi.fn>)

      await handleStripeWebhook(mockRequest as Request, mockResponse as Response)

      expect(fromMock).toHaveBeenCalledWith('disputes')
      expect(insertMock).toHaveBeenCalledWith({
        call_id: 'call_123',
        raised_by: 'buyer_123',
        dispute_type: 'billing',
        reason: 'Stripe dispute: fraudulent',
        description: 'Dispute created for charge ch_123. Reason: fraudulent',
        amount_disputed: 50,
        status: 'open',
        priority: 'high',
        evidence: [
          {
            type: 'stripe_dispute',
            dispute_id: 'dp_123',
            reason: 'fraudulent',
            evidence_details: {},
          },
        ],
      })

      expect(jsonMock).toHaveBeenCalledWith({ received: true })
    })

    it('should handle account.updated event', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'account.updated',
        data: {
          object: {
            id: 'acct_123',
            charges_enabled: true,
            payouts_enabled: true,
            details_submitted: true,
            requirements: {
              currently_due: [],
            },
          },
        },
      }

      vi.mocked(stripeServerClient.webhooks.constructEvent).mockReturnValue(
        mockEvent as Stripe.Event
      )

      const singleMock = vi.fn(() => ({
        data: { id: 'supplier_123', user_id: 'user_123' },
        error: null,
      }))

      const eqMock = vi.fn(() => ({
        single: singleMock,
      }))

      const selectMock = vi.fn(() => ({
        eq: eqMock,
      }))

      const updateMock = vi.fn(() => ({
        eq: vi.fn(() => ({ error: null })),
      }))

      const fromMock = vi.fn((table: string) => {
        if (table === 'suppliers' && !updateMock.mock.calls.length) {
          return { select: selectMock }
        }
        return { update: updateMock }
      })

      vi.mocked(supabase.from).mockImplementation(fromMock as ReturnType<typeof vi.fn>)

      await handleStripeWebhook(mockRequest as Request, mockResponse as Response)

      expect(jsonMock).toHaveBeenCalledWith({ received: true })
    })

    it('should handle unhandled event types', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'unknown.event',
        data: {
          object: {},
        },
      }

      vi.mocked(stripeServerClient.webhooks.constructEvent).mockReturnValue(
        mockEvent as Stripe.Event
      )

      await handleStripeWebhook(mockRequest as Request, mockResponse as Response)

      expect(jsonMock).toHaveBeenCalledWith({ received: true })
    })

    it('should handle webhook handler errors', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_123',
            metadata: {},
          },
        },
      }

      vi.mocked(stripeServerClient.webhooks.constructEvent).mockReturnValue(
        mockEvent as Stripe.Event
      )
      vi.mocked(supabase.from).mockImplementation(() => {
        throw new Error('Database error')
      })

      await handleStripeWebhook(mockRequest as Request, mockResponse as Response)

      expect(statusMock).toHaveBeenCalledWith(500)
      expect(sendMock).toHaveBeenCalledWith('Webhook handler error: Database error')
    })
  })

  describe('timingSafeEqual', () => {
    it('should return true for equal strings', () => {
      expect(timingSafeEqual('test123', 'test123')).toBe(true)
    })

    it('should return false for different strings', () => {
      expect(timingSafeEqual('test123', 'test456')).toBe(false)
    })

    it('should return false for strings of different lengths', () => {
      expect(timingSafeEqual('test', 'test123')).toBe(false)
    })
  })
})
