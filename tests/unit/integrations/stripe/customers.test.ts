import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createStripeCustomer,
  updateStripeCustomer,
  getStripeCustomer,
  deleteStripeCustomer,
  listCustomerPaymentMethods,
  attachPaymentMethod,
  savePaymentMethod,
  detachPaymentMethod,
  setDefaultPaymentMethod,
  createSetupIntent,
} from '@/integrations/stripe/customers'
import { stripeServerClient } from '@/integrations/stripe/client'
import type Stripe from 'stripe'

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-123'),
}))

// Mock the stripe client
vi.mock('@/integrations/stripe/client', () => ({
  stripeServerClient: {
    customers: {
      create: vi.fn(),
      update: vi.fn(),
      retrieve: vi.fn(),
      del: vi.fn(),
    },
    paymentMethods: {
      list: vi.fn(),
      retrieve: vi.fn(),
      detach: vi.fn(),
    },
    setupIntents: {
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

describe('Stripe Customers Module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset console mocks
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createStripeCustomer', () => {
    const mockCustomer = {
      id: 'cus_123',
      email: 'test@example.com',
      metadata: {
        userId: 'user_123',
        userType: 'buyer',
        platform: 'dependablecalls',
      },
    } as Stripe.Customer

    it('should create a customer with required fields', async () => {
      vi.mocked(stripeServerClient.customers.create).mockResolvedValue(mockCustomer)

      const result = await createStripeCustomer('test@example.com', {
        userId: 'user_123',
        userType: 'buyer',
      })

      expect(stripeServerClient.customers.create).toHaveBeenCalledWith(
        {
          email: 'test@example.com',
          metadata: {
            userId: 'user_123',
            userType: 'buyer',
            platform: 'dependablecalls',
          },
        },
        { idempotencyKey: 'mock-uuid-123' }
      )
      expect(result).toEqual(mockCustomer)
    })

    it('should create a customer with additional data', async () => {
      vi.mocked(stripeServerClient.customers.create).mockResolvedValue(mockCustomer)

      const additionalData = {
        name: 'John Doe',
        phone: '+1234567890',
        address: {
          line1: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          postal_code: '94105',
          country: 'US',
        } as Stripe.CustomerCreateParams.Address,
      }

      await createStripeCustomer(
        'test@example.com',
        {
          userId: 'user_123',
          userType: 'supplier',
          companyName: 'Test Company',
        },
        additionalData
      )

      expect(stripeServerClient.customers.create).toHaveBeenCalledWith(
        {
          email: 'test@example.com',
          name: 'John Doe',
          phone: '+1234567890',
          address: additionalData.address,
          metadata: {
            userId: 'user_123',
            userType: 'supplier',
            companyName: 'Test Company',
            platform: 'dependablecalls',
          },
        },
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
      vi.mocked(stripeServerClient.customers.create).mockRejectedValue(stripeError)

      await expect(
        createStripeCustomer('test@example.com', {
          userId: 'user_123',
          userType: 'buyer',
        })
      ).rejects.toThrow('Customer service error. Please retry or contact support.')

      expect(console.error).toHaveBeenCalledWith('create Stripe customer failed', {
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
      vi.mocked(stripeServerClient.customers.create).mockRejectedValue(stripeError)

      await expect(
        createStripeCustomer('test@example.com', {
          userId: 'user_123',
          userType: 'buyer',
        })
      ).rejects.toThrow('Resource not found. Please check your request and try again.')
    })

    it('should handle unexpected errors', async () => {
      vi.mocked(stripeServerClient.customers.create).mockRejectedValue(new Error('Network error'))

      await expect(
        createStripeCustomer('test@example.com', {
          userId: 'user_123',
          userType: 'buyer',
        })
      ).rejects.toThrow('Internal server error. Please try again later.')
    })
  })

  describe('updateStripeCustomer', () => {
    const mockUpdatedCustomer = {
      id: 'cus_123',
      email: 'updated@example.com',
    } as Stripe.Customer

    it('should update a customer successfully', async () => {
      vi.mocked(stripeServerClient.customers.update).mockResolvedValue(mockUpdatedCustomer)

      const updates = { email: 'updated@example.com' }
      const result = await updateStripeCustomer('cus_123', updates)

      expect(stripeServerClient.customers.update).toHaveBeenCalledWith('cus_123', updates, {
        idempotencyKey: 'mock-uuid-123',
      })
      expect(result).toEqual(mockUpdatedCustomer)
    })

    it('should handle update errors', async () => {
      vi.mocked(stripeServerClient.customers.update).mockRejectedValue(new Error('Update failed'))

      await expect(updateStripeCustomer('cus_123', { email: 'test@example.com' })).rejects.toThrow(
        'Internal server error. Please try again later.'
      )
    })
  })

  describe('getStripeCustomer', () => {
    it('should retrieve a customer successfully', async () => {
      const mockCustomer = {
        id: 'cus_123',
        deleted: false,
      } as Stripe.Customer
      vi.mocked(stripeServerClient.customers.retrieve).mockResolvedValue(mockCustomer)

      const result = await getStripeCustomer('cus_123')

      expect(stripeServerClient.customers.retrieve).toHaveBeenCalledWith('cus_123')
      expect(result).toEqual(mockCustomer)
    })

    it('should return null for deleted customers', async () => {
      const deletedCustomer = {
        id: 'cus_123',
        deleted: true,
      } as Stripe.DeletedCustomer
      vi.mocked(stripeServerClient.customers.retrieve).mockResolvedValue(deletedCustomer)

      const result = await getStripeCustomer('cus_123')

      expect(result).toBeNull()
    })

    it('should return null for resource_missing errors', async () => {
      const stripeError = new stripeServerClient.errors.StripeError(
        'invalid_request_error',
        'resource_missing'
      )
      vi.mocked(stripeServerClient.customers.retrieve).mockRejectedValue(stripeError)

      const result = await getStripeCustomer('cus_123')

      expect(result).toBeNull()
    })

    it('should handle other errors', async () => {
      vi.mocked(stripeServerClient.customers.retrieve).mockRejectedValue(new Error('Network error'))

      await expect(getStripeCustomer('cus_123')).rejects.toThrow(
        'Internal server error. Please try again later.'
      )
    })
  })

  describe('deleteStripeCustomer', () => {
    it('should delete a customer successfully', async () => {
      vi.mocked(stripeServerClient.customers.del).mockResolvedValue({
        id: 'cus_123',
        object: 'customer',
        deleted: true,
      })

      const result = await deleteStripeCustomer('cus_123')

      expect(stripeServerClient.customers.del).toHaveBeenCalledWith('cus_123')
      expect(result).toBe(true)
    })

    it('should handle deletion errors', async () => {
      vi.mocked(stripeServerClient.customers.del).mockRejectedValue(new Error('Delete failed'))

      await expect(deleteStripeCustomer('cus_123')).rejects.toThrow(
        'Internal server error. Please try again later.'
      )
    })
  })

  describe('listCustomerPaymentMethods', () => {
    it('should list payment methods with pagination', async () => {
      const mockPaymentMethods = [
        { id: 'pm_1', type: 'card' },
        { id: 'pm_2', type: 'card' },
      ] as Stripe.PaymentMethod[]

      // Mock async iterator
      const mockAsyncIterator = {
        [Symbol.asyncIterator]: async function* () {
          for (const pm of mockPaymentMethods) {
            yield pm
          }
        },
      }

      vi.mocked(stripeServerClient.paymentMethods.list).mockReturnValue(
        mockAsyncIterator as AsyncIterableIterator<Stripe.PaymentMethod>
      )

      const result = await listCustomerPaymentMethods('cus_123')

      expect(stripeServerClient.paymentMethods.list).toHaveBeenCalledWith({
        customer: 'cus_123',
        type: 'card',
        limit: 100,
      })
      expect(result).toEqual(mockPaymentMethods)
    })

    it('should list bank account payment methods', async () => {
      const mockAsyncIterator = {
        [Symbol.asyncIterator]: async function* () {
          yield { id: 'pm_bank', type: 'us_bank_account' }
        },
      }

      vi.mocked(stripeServerClient.paymentMethods.list).mockReturnValue(
        mockAsyncIterator as AsyncIterableIterator<Stripe.PaymentMethod>
      )

      const result = await listCustomerPaymentMethods('cus_123', 'us_bank_account', 50)

      expect(stripeServerClient.paymentMethods.list).toHaveBeenCalledWith({
        customer: 'cus_123',
        type: 'us_bank_account',
        limit: 50,
      })
      expect(result).toHaveLength(1)
    })

    it('should handle listing errors', async () => {
      vi.mocked(stripeServerClient.paymentMethods.list).mockImplementation(() => {
        throw new Error('List failed')
      })

      await expect(listCustomerPaymentMethods('cus_123')).rejects.toThrow(
        'Internal server error. Please try again later.'
      )
    })
  })

  describe('attachPaymentMethod', () => {
    it('should log deprecation warning and call savePaymentMethod', async () => {
      const mockPaymentMethod = { id: 'pm_123' } as Stripe.PaymentMethod
      const mockSetupIntent = {
        id: 'seti_123',
        status: 'succeeded',
      } as Stripe.SetupIntent

      vi.mocked(stripeServerClient.setupIntents.create).mockResolvedValue(mockSetupIntent)
      vi.mocked(stripeServerClient.paymentMethods.retrieve).mockResolvedValue(mockPaymentMethod)

      const result = await attachPaymentMethod('pm_123', 'cus_123')

      expect(console.warn).toHaveBeenCalledWith(
        'attachPaymentMethod is deprecated. Use savePaymentMethod for better SCA compliance.'
      )
      expect(result).toEqual(mockPaymentMethod)
    })
  })

  describe('savePaymentMethod', () => {
    it('should save payment method with SetupIntent', async () => {
      const mockSetupIntent = {
        id: 'seti_123',
        status: 'succeeded',
      } as Stripe.SetupIntent
      const mockPaymentMethod = { id: 'pm_123' } as Stripe.PaymentMethod

      vi.mocked(stripeServerClient.setupIntents.create).mockResolvedValue(mockSetupIntent)
      vi.mocked(stripeServerClient.paymentMethods.retrieve).mockResolvedValue(mockPaymentMethod)

      const result = await savePaymentMethod('cus_123', 'pm_123', { source: 'web' })

      expect(stripeServerClient.setupIntents.create).toHaveBeenCalledWith(
        {
          customer: 'cus_123',
          payment_method_types: ['card', 'us_bank_account'],
          payment_method: 'pm_123',
          confirm: true,
          usage: 'off_session',
          metadata: {
            source: 'web',
            platform: 'dependablecalls',
          },
        },
        { idempotencyKey: 'mock-uuid-123' }
      )
      expect(stripeServerClient.paymentMethods.retrieve).toHaveBeenCalledWith('pm_123')
      expect(result).toEqual(mockPaymentMethod)
    })

    it('should throw error if SetupIntent fails', async () => {
      const mockSetupIntent = {
        id: 'seti_123',
        status: 'requires_payment_method',
      } as Stripe.SetupIntent

      vi.mocked(stripeServerClient.setupIntents.create).mockResolvedValue(mockSetupIntent)

      await expect(savePaymentMethod('cus_123', 'pm_123')).rejects.toThrow(
        'SetupIntent failed with status: requires_payment_method'
      )
    })

    it('should handle setup errors', async () => {
      vi.mocked(stripeServerClient.setupIntents.create).mockRejectedValue(new Error('Setup failed'))

      await expect(savePaymentMethod('cus_123', 'pm_123')).rejects.toThrow(
        'Internal server error. Please try again later.'
      )
    })
  })

  describe('detachPaymentMethod', () => {
    it('should detach payment method successfully', async () => {
      const mockPaymentMethod = { id: 'pm_123', customer: null } as Stripe.PaymentMethod
      vi.mocked(stripeServerClient.paymentMethods.detach).mockResolvedValue(mockPaymentMethod)

      const result = await detachPaymentMethod('pm_123')

      expect(stripeServerClient.paymentMethods.detach).toHaveBeenCalledWith('pm_123')
      expect(result).toEqual(mockPaymentMethod)
    })

    it('should handle detach errors', async () => {
      vi.mocked(stripeServerClient.paymentMethods.detach).mockRejectedValue(
        new Error('Detach failed')
      )

      await expect(detachPaymentMethod('pm_123')).rejects.toThrow(
        'Internal server error. Please try again later.'
      )
    })
  })

  describe('setDefaultPaymentMethod', () => {
    it('should set default payment method successfully', async () => {
      const mockCustomer = {
        id: 'cus_123',
        invoice_settings: {
          default_payment_method: 'pm_123',
        },
      } as Stripe.Customer

      vi.mocked(stripeServerClient.customers.update).mockResolvedValue(mockCustomer)

      const result = await setDefaultPaymentMethod('cus_123', 'pm_123')

      expect(stripeServerClient.customers.update).toHaveBeenCalledWith(
        'cus_123',
        {
          invoice_settings: {
            default_payment_method: 'pm_123',
          },
        },
        { idempotencyKey: 'mock-uuid-123' }
      )
      expect(result).toEqual(mockCustomer)
    })
  })

  describe('createSetupIntent', () => {
    it('should create setup intent successfully', async () => {
      const mockSetupIntent = {
        id: 'seti_123',
        customer: 'cus_123',
      } as Stripe.SetupIntent

      vi.mocked(stripeServerClient.setupIntents.create).mockResolvedValue(mockSetupIntent)

      const result = await createSetupIntent('cus_123', { source: 'mobile' })

      expect(stripeServerClient.setupIntents.create).toHaveBeenCalledWith(
        {
          customer: 'cus_123',
          payment_method_types: ['card', 'us_bank_account'],
          usage: 'off_session',
          metadata: {
            source: 'mobile',
            platform: 'dependablecalls',
          },
        },
        { idempotencyKey: 'mock-uuid-123' }
      )
      expect(result).toEqual(mockSetupIntent)
    })

    it('should handle creation errors', async () => {
      vi.mocked(stripeServerClient.setupIntents.create).mockRejectedValue(
        new Error('Create failed')
      )

      await expect(createSetupIntent('cus_123')).rejects.toThrow(
        'Internal server error. Please try again later.'
      )
    })
  })
})
