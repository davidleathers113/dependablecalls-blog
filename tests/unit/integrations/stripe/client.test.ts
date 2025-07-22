import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getStripeClient, stripeConfig, isStripeConfigured } from '@/integrations/stripe/client'
import Stripe from 'stripe'
import { loadStripe } from '@stripe/stripe-js'

// Mock the Stripe modules
vi.mock('stripe')
vi.mock('@stripe/stripe-js')

// Mock environment variables
const mockEnv = {
  VITE_STRIPE_SECRET_KEY: 'sk_test_mock_secret_key',
  VITE_STRIPE_PUBLISHABLE_KEY: 'pk_test_mock_publishable_key',
  VITE_STRIPE_WEBHOOK_SECRET: 'whsec_test_mock_webhook_secret',
  VITE_STRIPE_CONNECT_CLIENT_ID: 'ca_test_mock_client_id',
}

describe('Stripe Client Module', () => {
  const originalEnv = import.meta.env

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup environment variables
    import.meta.env = { ...originalEnv, ...mockEnv }
  })

  afterEach(() => {
    // Restore original environment
    import.meta.env = originalEnv
  })

  describe('stripeServerClient', () => {
    it('should create a Stripe instance with correct configuration', () => {
      const MockedStripe = vi.mocked(Stripe)

      // Import module to trigger initialization
      vi.resetModules()

      expect(MockedStripe).toHaveBeenCalledWith(mockEnv.VITE_STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16',
        typescript: true,
      })
    })

    it('should handle missing secret key gracefully', () => {
      import.meta.env = { ...originalEnv, VITE_STRIPE_SECRET_KEY: '' }
      const MockedStripe = vi.mocked(Stripe)

      vi.resetModules()

      expect(MockedStripe).toHaveBeenCalledWith('', {
        apiVersion: '2023-10-16',
        typescript: true,
      })
    })
  })

  describe('getStripeClient', () => {
    it('should return the same promise instance on multiple calls', async () => {
      const mockStripeInstance = { id: 'mock-stripe' }
      vi.mocked(loadStripe).mockResolvedValue(
        mockStripeInstance as unknown as ReturnType<typeof loadStripe>
      )

      const firstCall = getStripeClient()
      const secondCall = getStripeClient()

      expect(firstCall).toBe(secondCall)
      expect(loadStripe).toHaveBeenCalledTimes(1)
      expect(loadStripe).toHaveBeenCalledWith(mockEnv.VITE_STRIPE_PUBLISHABLE_KEY)
    })

    it('should handle missing publishable key', async () => {
      import.meta.env = { ...originalEnv, VITE_STRIPE_PUBLISHABLE_KEY: '' }

      vi.resetModules()
      const { getStripeClient: getClient } = await import('@/integrations/stripe/client')

      getClient()

      expect(loadStripe).toHaveBeenCalledWith('')
    })

    it('should return null when loadStripe fails', async () => {
      vi.mocked(loadStripe).mockResolvedValue(null)

      vi.resetModules()
      const { getStripeClient: getClient } = await import('@/integrations/stripe/client')

      const result = await getClient()

      expect(result).toBeNull()
    })
  })

  describe('stripeConfig', () => {
    it('should contain all required configuration values', () => {
      expect(stripeConfig).toEqual({
        webhookSecret: mockEnv.VITE_STRIPE_WEBHOOK_SECRET,
        connectClientId: mockEnv.VITE_STRIPE_CONNECT_CLIENT_ID,
        apiVersion: '2023-10-16',
      })
    })

    it('should handle missing environment variables', () => {
      import.meta.env = { ...originalEnv }

      vi.resetModules()

      expect(stripeConfig).toEqual({
        webhookSecret: '',
        connectClientId: '',
        apiVersion: '2023-10-16',
      })
    })
  })

  describe('isStripeConfigured', () => {
    it('should return true when all required keys are present', () => {
      expect(isStripeConfigured()).toBe(true)
    })

    it('should return false when secret key is missing', () => {
      import.meta.env = {
        ...originalEnv,
        VITE_STRIPE_PUBLISHABLE_KEY: mockEnv.VITE_STRIPE_PUBLISHABLE_KEY,
      }

      expect(isStripeConfigured()).toBe(false)
    })

    it('should return false when publishable key is missing', () => {
      import.meta.env = {
        ...originalEnv,
        VITE_STRIPE_SECRET_KEY: mockEnv.VITE_STRIPE_SECRET_KEY,
      }

      expect(isStripeConfigured()).toBe(false)
    })

    it('should return false when both keys are missing', () => {
      import.meta.env = { ...originalEnv }

      expect(isStripeConfigured()).toBe(false)
    })

    it('should return false when keys are empty strings', () => {
      import.meta.env = {
        ...originalEnv,
        VITE_STRIPE_SECRET_KEY: '',
        VITE_STRIPE_PUBLISHABLE_KEY: '',
      }

      expect(isStripeConfigured()).toBe(false)
    })
  })
})
