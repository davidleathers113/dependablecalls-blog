import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  verifyWebhookSignature,
  handleStripeWebhook,
  timingSafeEqual,
} from '@/integrations/stripe/webhooks'
import { stripeServerClient } from '@/integrations/stripe/client'
import type Stripe from 'stripe'
import type { Request, Response } from 'express'
import crypto from 'crypto'

// Mock crypto module
vi.mock('crypto', () => ({
  default: {
    timingSafeEqual: vi.fn((a: Buffer, b: Buffer) => {
      return a.toString() === b.toString()
    }),
  },
}))

// Mock the stripe client
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

describe('Stripe Webhooks Module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('verifyWebhookSignature', () => {
    it('should verify webhook signature successfully', () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123' } },
      } as Stripe.Event

      vi.mocked(stripeServerClient.webhooks.constructEvent).mockReturnValue(mockEvent)

      const result = verifyWebhookSignature('payload', 'signature')

      expect(stripeServerClient.webhooks.constructEvent).toHaveBeenCalledWith(
        'payload',
        'signature',
        'whsec_test_secret'
      )
      expect(result).toEqual(mockEvent)
    })

    it('should throw error when verification fails', () => {
      vi.mocked(stripeServerClient.webhooks.constructEvent).mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      expect(() => verifyWebhookSignature('payload', 'signature')).toThrow(
        'Webhook signature verification failed: Invalid signature'
      )
    })

    it('should handle non-Error exceptions', () => {
      vi.mocked(stripeServerClient.webhooks.constructEvent).mockImplementation(() => {
        throw 'String error'
      })

      expect(() => verifyWebhookSignature('payload', 'signature')).toThrow(
        'Webhook signature verification failed: Unknown error'
      )
    })
  })

  describe('handleStripeWebhook', () => {
    let mockReq: Partial<Request>
    let mockRes: Partial<Response>

    beforeEach(() => {
      mockReq = {
        headers: {
          'stripe-signature': 'test-signature',
        },
        body: 'test-payload',
      }

      mockRes = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      }
    })

    it('should handle missing signature header', async () => {
      mockReq.headers = {}

      await handleStripeWebhook(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.send).toHaveBeenCalledWith('Missing stripe-signature header')
    })

    it('should handle signature verification failure', async () => {
      vi.mocked(stripeServerClient.webhooks.constructEvent).mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      await handleStripeWebhook(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.send).toHaveBeenCalledWith('Webhook Error: Invalid signature')
      expect(console.error).toHaveBeenCalledWith(
        'Webhook signature verification failed:',
        expect.any(Error)
      )
    })

    it('should handle payment_intent.succeeded event', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_123',
            amount: 5000,
            currency: 'usd',
          },
        },
      } as Stripe.Event

      vi.mocked(stripeServerClient.webhooks.constructEvent).mockReturnValue(mockEvent)

      await handleStripeWebhook(mockReq as Request, mockRes as Response)

      expect(console.log).toHaveBeenCalledWith('Payment succeeded:', 'pi_123')
      expect(mockRes.json).toHaveBeenCalledWith({ received: true })
    })

    it('should handle payment_intent.payment_failed event', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_123',
          },
        },
      } as Stripe.Event

      vi.mocked(stripeServerClient.webhooks.constructEvent).mockReturnValue(mockEvent)

      await handleStripeWebhook(mockReq as Request, mockRes as Response)

      expect(console.error).toHaveBeenCalledWith('Payment failed:', 'pi_123')
      expect(mockRes.json).toHaveBeenCalledWith({ received: true })
    })

    it('should handle charge.dispute.created event', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'charge.dispute.created',
        data: {
          object: {
            id: 'dp_123',
          },
        },
      } as Stripe.Event

      vi.mocked(stripeServerClient.webhooks.constructEvent).mockReturnValue(mockEvent)

      await handleStripeWebhook(mockReq as Request, mockRes as Response)

      expect(console.warn).toHaveBeenCalledWith('Dispute created:', 'dp_123')
      expect(mockRes.json).toHaveBeenCalledWith({ received: true })
    })

    it('should handle account.updated event', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'account.updated',
        data: {
          object: {
            id: 'acct_123',
          },
        },
      } as Stripe.Event

      vi.mocked(stripeServerClient.webhooks.constructEvent).mockReturnValue(mockEvent)

      await handleStripeWebhook(mockReq as Request, mockRes as Response)

      expect(console.log).toHaveBeenCalledWith('Connected account updated:', 'acct_123')
      expect(mockRes.json).toHaveBeenCalledWith({ received: true })
    })

    it('should handle payout events', async () => {
      const payoutEvents = [
        { type: 'payout.created', message: 'Payout created:' },
        { type: 'payout.paid', message: 'Payout completed:' },
        { type: 'payout.failed', message: 'Payout failed:' },
      ]

      for (const { type, message } of payoutEvents) {
        vi.clearAllMocks()

        const mockEvent = {
          id: 'evt_123',
          type,
          data: {
            object: {
              id: 'po_123',
            },
          },
        } as Stripe.Event

        vi.mocked(stripeServerClient.webhooks.constructEvent).mockReturnValue(mockEvent)

        await handleStripeWebhook(mockReq as Request, mockRes as Response)

        if (type === 'payout.failed') {
          expect(console.error).toHaveBeenCalledWith(message, 'po_123')
        } else {
          expect(console.log).toHaveBeenCalledWith(message, 'po_123')
        }
        expect(mockRes.json).toHaveBeenCalledWith({ received: true })
      }
    })

    it('should handle transfer events', async () => {
      const transferEvents = [
        { type: 'transfer.created', message: 'Transfer created:', logType: 'log' },
        { type: 'transfer.reversed', message: 'Transfer reversed:', logType: 'warn' },
      ]

      for (const { type, message, logType } of transferEvents) {
        vi.clearAllMocks()

        const mockEvent = {
          id: 'evt_123',
          type,
          data: {
            object: {
              id: 'tr_123',
            },
          },
        } as Stripe.Event

        vi.mocked(stripeServerClient.webhooks.constructEvent).mockReturnValue(mockEvent)

        await handleStripeWebhook(mockReq as Request, mockRes as Response)

        if (logType === 'warn') {
          expect(console.warn).toHaveBeenCalledWith(message, 'tr_123')
        } else {
          expect(console.log).toHaveBeenCalledWith(message, 'tr_123')
        }
        expect(mockRes.json).toHaveBeenCalledWith({ received: true })
      }
    })

    it('should handle account authorization events', async () => {
      const authEvents = [
        { type: 'account.application.authorized', message: 'Account authorized:' },
        { type: 'account.application.deauthorized', message: 'Account deauthorized:' },
      ]

      for (const { type, message } of authEvents) {
        vi.clearAllMocks()

        const mockEvent = {
          id: 'evt_123',
          type,
          data: {
            object: {
              id: 'acct_123',
            },
          },
        } as Stripe.Event

        vi.mocked(stripeServerClient.webhooks.constructEvent).mockReturnValue(mockEvent)

        await handleStripeWebhook(mockReq as Request, mockRes as Response)

        expect(console.log).toHaveBeenCalledWith(message, 'acct_123')
        expect(mockRes.json).toHaveBeenCalledWith({ received: true })
      }
    })

    it('should handle unhandled event types', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'unknown.event',
        data: {
          object: {},
        },
      } as Stripe.Event

      vi.mocked(stripeServerClient.webhooks.constructEvent).mockReturnValue(mockEvent)

      await handleStripeWebhook(mockReq as Request, mockRes as Response)

      expect(console.log).toHaveBeenCalledWith('Unhandled webhook event type: unknown.event')
      expect(mockRes.json).toHaveBeenCalledWith({ received: true })
    })

    it('should handle webhook handler errors', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_123',
          },
        },
      } as Stripe.Event

      vi.mocked(stripeServerClient.webhooks.constructEvent).mockReturnValue(mockEvent)

      // Mock console.log to throw an error when handler runs
      vi.mocked(console.log).mockImplementationOnce(() => {
        throw new Error('Handler error')
      })

      await handleStripeWebhook(mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.send).toHaveBeenCalledWith('Webhook handler error: Handler error')
    })
  })

  describe('timingSafeEqual', () => {
    it('should return true for equal strings', () => {
      const result = timingSafeEqual('test123', 'test123')
      expect(result).toBe(true)
    })

    it('should return false for different strings', () => {
      const result = timingSafeEqual('test123', 'test456')
      expect(result).toBe(false)
    })

    it('should return false for different length strings', () => {
      const result = timingSafeEqual('test', 'testing')
      expect(result).toBe(false)
    })

    it('should use crypto.timingSafeEqual for comparison', () => {
      const mockTimingSafeEqual = vi.mocked(crypto.timingSafeEqual)
      mockTimingSafeEqual.mockClear()

      timingSafeEqual('test', 'test')

      expect(mockTimingSafeEqual).toHaveBeenCalledWith(expect.any(Buffer), expect.any(Buffer))
    })
  })
})
