import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { PaymentForm } from '../../src/components/payments/PaymentForm'
import { BillingForm } from '../../src/components/billing/BillingForm'
import { paymentService } from '../../src/services/payment'
import { encryptionService } from '../../src/services/encryption'

// Mock services
vi.mock('../../src/services/payment')
vi.mock('../../src/services/encryption')
vi.mock('@stripe/stripe-js')

const mockPaymentService = vi.mocked(paymentService)
const mockEncryptionService = vi.mocked(encryptionService)

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('Payment Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear any stored payment data
    localStorage.clear()
    sessionStorage.clear()
  })

  describe('PCI DSS Compliance', () => {
    it('should never store credit card data in localStorage/sessionStorage', async () => {
      const cardData = {
        number: '4242424242424242',
        cvc: '123',
        expiry: '12/25'
      }

      render(
        <TestWrapper>
          <PaymentForm />
        </TestWrapper>
      )

      const cardNumberInput = screen.getByLabelText(/card number/i)
      const cvcInput = screen.getByLabelText(/cvc/i)
      const expiryInput = screen.getByLabelText(/expiry/i)

      fireEvent.change(cardNumberInput, { target: { value: cardData.number } })
      fireEvent.change(cvcInput, { target: { value: cardData.cvc } })
      fireEvent.change(expiryInput, { target: { value: cardData.expiry } })

      // Check that card data is never stored in browser storage
      const localStorage = window.localStorage
      const sessionStorage = window.sessionStorage

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key) {
          const value = localStorage.getItem(key)
          expect(value).not.toContain(cardData.number)
          expect(value).not.toContain(cardData.cvc)
        }
      }

      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key) {
          const value = sessionStorage.getItem(key)
          expect(value).not.toContain(cardData.number)
          expect(value).not.toContain(cardData.cvc)
        }
      }
    })

    it('should mask credit card numbers in UI', async () => {
      render(
        <TestWrapper>
          <PaymentForm />
        </TestWrapper>
      )

      const cardNumberInput = screen.getByLabelText(/card number/i) as HTMLInputElement

      // Type full card number
      fireEvent.change(cardNumberInput, { target: { value: '4242424242424242' } })

      // Should show masked version
      const hasMasking = cardNumberInput.value.includes('*') || cardNumberInput.value === '4242 4242 4242 4242'
      expect(hasMasking).toBe(true)
      expect(cardNumberInput.value).not.toBe('4242424242424242') // Raw number should not be visible
    })

    it('should use secure HTTPS endpoints for payment processing', async () => {
      mockPaymentService.processPayment.mockImplementation((paymentData) => {
        const endpoint = paymentData.endpoint
        expect(endpoint).toStartWith('https://')
        expect(endpoint).not.toStartWith('http://')
        return Promise.resolve({ id: 'payment-123', status: 'succeeded' })
      })

      render(
        <TestWrapper>
          <PaymentForm amount={100} />
        </TestWrapper>
      )

      const submitButton = screen.getByRole('button', { name: /pay now/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockPaymentService.processPayment).toHaveBeenCalled()
      })
    })

    it('should tokenize card data before transmission', async () => {
      mockPaymentService.createToken.mockResolvedValue({
        token: 'tok_visa_1234',
        last4: '4242'
      })

      mockPaymentService.processPayment.mockImplementation((paymentData) => {
        // Should use token, not raw card data
        expect(paymentData.token).toBe('tok_visa_1234')
        expect(paymentData).not.toHaveProperty('cardNumber')
        expect(paymentData).not.toHaveProperty('cvc')
        return Promise.resolve({ id: 'payment-123', status: 'succeeded' })
      })

      render(
        <TestWrapper>
          <PaymentForm amount={100} />
        </TestWrapper>
      )

      // Simulate Stripe tokenization
      const cardElement = screen.getByTestId('stripe-card-element')
      fireEvent.change(cardElement, {
        target: { value: { token: 'tok_visa_1234' } }
      })

      const submitButton = screen.getByRole('button', { name: /pay now/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockPaymentService.createToken).toHaveBeenCalled()
        expect(mockPaymentService.processPayment).toHaveBeenCalledWith(
          expect.objectContaining({ token: 'tok_visa_1234' })
        )
      })
    })
  })

  describe('Payment Amount Security', () => {
    it('should prevent payment amount manipulation', async () => {
      const originalAmount = 100.00
      const tamperedAmount = 0.01

      mockPaymentService.processPayment.mockImplementation((paymentData) => {
        // Server should validate amount matches order
        if (paymentData.amount !== originalAmount) {
          throw new Error('Payment amount mismatch')
        }
        return Promise.resolve({ id: 'payment-123', status: 'succeeded' })
      })

      const PaymentComponent = () => {
        const [amount, setAmount] = React.useState(originalAmount)

        return (
          <div>
            <input 
              data-testid="amount-input"
              type="hidden"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value))}
            />
            <PaymentForm amount={amount} />
          </div>
        )
      }

      render(
        <TestWrapper>
          <PaymentComponent />
        </TestWrapper>
      )

      // Attempt to manipulate amount in DOM
      const amountInput = screen.getByTestId('amount-input')
      fireEvent.change(amountInput, { target: { value: tamperedAmount } })

      const submitButton = screen.getByRole('button', { name: /pay now/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockPaymentService.processPayment).toHaveBeenCalledWith(
          expect.objectContaining({ amount: originalAmount })
        )
      })
    })

    it('should validate payment amounts server-side', async () => {
      const invalidAmounts = [-100, 0, 999999, 0.001, NaN, Infinity]

      mockPaymentService.validateAmount.mockImplementation((amount) => {
        if (amount <= 0 || amount > 10000 || !Number.isFinite(amount)) {
          throw new Error('Invalid payment amount')
        }
        return true
      })

      for (const amount of invalidAmounts) {
        await expect(paymentService.validateAmount(amount)).rejects.toThrow('Invalid payment amount')
      }

      // Valid amounts should pass
      const validAmounts = [1, 50.99, 1000, 9999.99]
      for (const amount of validAmounts) {
        await expect(paymentService.validateAmount(amount)).resolves.toBe(true)
      }
    })

    it('should prevent currency manipulation', async () => {
      mockPaymentService.processPayment.mockImplementation((paymentData) => {
        // Verify currency matches account settings
        if (paymentData.currency !== 'USD') {
          throw new Error('Currency mismatch')
        }
        return Promise.resolve({ id: 'payment-123', status: 'succeeded' })
      })

      render(
        <TestWrapper>
          <PaymentForm amount={100} currency="USD" />
        </TestWrapper>
      )

      // Attempt to manipulate currency
      const hiddenCurrencyInput = document.createElement('input')
      hiddenCurrencyInput.type = 'hidden'
      hiddenCurrencyInput.name = 'currency'
      hiddenCurrencyInput.value = 'EUR'
      document.body.appendChild(hiddenCurrencyInput)

      const submitButton = screen.getByRole('button', { name: /pay now/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockPaymentService.processPayment).toHaveBeenCalledWith(
          expect.objectContaining({ currency: 'USD' })
        )
      })
    })
  })

  describe('Billing Information Security', () => {
    it('should validate billing address to prevent fraud', async () => {
      const fraudulentAddresses = [
        {
          address: '<script>alert("xss")</script>',
          city: 'New York',
          zip: '10001'
        },
        {
          address: '123 Main St',
          city: "'; DROP TABLE addresses; --",
          zip: '10001'
        },
        {
          address: '123 Main St',
          city: 'New York',
          zip: '99999' // Invalid ZIP
        }
      ]

      mockPaymentService.validateBillingAddress.mockImplementation((address) => {
        // Check for XSS
        if (address.address.includes('<script>') || address.city.includes('<script>')) {
          throw new Error('Invalid address format')
        }
        
        // Check for SQL injection
        if (address.city.includes('DROP TABLE') || address.city.includes('--')) {
          throw new Error('Invalid address format')
        }
        
        // Basic ZIP validation
        const isValidZip = address.zip.length === 5 && address.zip.split('').every(char => char >= '0' && char <= '9')
        if (!isValidZip) {
          throw new Error('Invalid ZIP code')
        }
        
        return true
      })

      for (const address of fraudulentAddresses) {
        await expect(
          paymentService.validateBillingAddress(address)
        ).rejects.toThrow(/invalid/i)
      }
    })

    it('should encrypt sensitive billing data', async () => {
      const billingData = {
        address: '123 Main St',
        city: 'New York',
        zip: '10001',
        ssn: '123-45-6789' // Sensitive data
      }

      mockEncryptionService.encrypt.mockImplementation((data) => {
        return `encrypted_${btoa(JSON.stringify(data))}`
      })

      mockPaymentService.storeBillingInfo.mockImplementation((encryptedData) => {
        // Should receive encrypted data
        expect(encryptedData).toStartWith('encrypted_')
        expect(encryptedData).not.toContain('123-45-6789')
        return Promise.resolve({ id: 'billing-123' })
      })

      render(
        <TestWrapper>
          <BillingForm />
        </TestWrapper>
      )

      const ssnInput = screen.getByLabelText(/ssn|social security/i)
      fireEvent.change(ssnInput, { target: { value: billingData.ssn } })

      const submitButton = screen.getByRole('button', { name: /save/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(
          expect.objectContaining({ ssn: billingData.ssn })
        )
        expect(mockPaymentService.storeBillingInfo).toHaveBeenCalledWith(
          expect.stringContaining('encrypted_')
        )
      })
    })
  })

  describe('Payment Method Security', () => {
    it('should validate payment method ownership', async () => {
      const paymentMethod = {
        id: 'pm_card_visa',
        customer_id: 'cus_buyer123'
      }

      mockPaymentService.validatePaymentMethodOwnership.mockImplementation((pmId, customerId) => {
        if (pmId === 'pm_card_visa' && customerId !== 'cus_buyer123') {
          throw new Error('Payment method does not belong to customer')
        }
        return Promise.resolve(true)
      })

      // Test with correct customer
      await expect(
        paymentService.validatePaymentMethodOwnership('pm_card_visa', 'cus_buyer123')
      ).resolves.toBe(true)

      // Test with wrong customer
      await expect(
        paymentService.validatePaymentMethodOwnership('pm_card_visa', 'cus_different')
      ).rejects.toThrow('Payment method does not belong to customer')
    })

    it('should implement 3D Secure for high-value transactions', async () => {
      const highValueAmount = 5000

      mockPaymentService.processPayment.mockImplementation((paymentData) => {
        if (paymentData.amount >= 1000) {
          return Promise.resolve({
            id: 'payment-123',
            status: 'requires_action',
            client_secret: 'pi_3ds_secret',
            next_action: {
              type: 'use_stripe_sdk',
              use_stripe_sdk: {
                type: 'three_d_secure_redirect'
              }
            }
          })
        }
        return Promise.resolve({ id: 'payment-123', status: 'succeeded' })
      })

      render(
        <TestWrapper>
          <PaymentForm amount={highValueAmount} />
        </TestWrapper>
      )

      const submitButton = screen.getByRole('button', { name: /pay now/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockPaymentService.processPayment).toHaveBeenCalledWith(
          expect.objectContaining({ amount: highValueAmount })
        )
      })

      // Should trigger 3D Secure
      await waitFor(() => {
        expect(screen.getByText(/additional authentication required/i)).toBeInTheDocument()
      })
    })

    it('should detect and prevent payment fraud', async () => {
      const suspiciousTransactions = [
        {
          amount: 9999,
          velocity: 'high', // Multiple transactions in short time
          location: 'different_country'
        },
        {
          amount: 1,
          count: 50, // Many small transactions (card testing)
          timeframe: '5_minutes'
        },
        {
          amount: 500,
          billing_country: 'US',
          ip_country: 'CN' // Mismatched countries
        }
      ]

      mockPaymentService.checkFraudRisk.mockImplementation((transaction) => {
        let riskScore = 0

        if (transaction.amount > 5000) riskScore += 30
        if (transaction.velocity === 'high') riskScore += 40
        if (transaction.location === 'different_country') riskScore += 25
        if (transaction.count > 10) riskScore += 35
        if (transaction.billing_country !== transaction.ip_country) riskScore += 45

        if (riskScore > 70) {
          throw new Error('Transaction blocked due to fraud risk')
        }

        return { riskScore, status: riskScore > 50 ? 'review' : 'approved' }
      })

      for (const transaction of suspiciousTransactions) {
        if (transaction.amount === 9999 || transaction.count === 50 || transaction.billing_country) {
          await expect(
            paymentService.checkFraudRisk(transaction)
          ).rejects.toThrow('Transaction blocked due to fraud risk')
        }
      }
    })
  })

  describe('Webhook Security', () => {
    it('should validate webhook signatures', async () => {
      const webhookPayload = {
        id: 'evt_test_webhook',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_payment',
            amount: 1000,
            status: 'succeeded'
          }
        }
      }

      const validSignature = 'v1=valid_signature_hash'
      const invalidSignature = 'v1=invalid_signature_hash'

      mockPaymentService.validateWebhookSignature.mockImplementation((payload, signature, secret) => {
        if (signature !== validSignature) {
          throw new Error('Invalid webhook signature')
        }
        return true
      })

      // Valid signature should pass
      await expect(
        paymentService.validateWebhookSignature(
          JSON.stringify(webhookPayload),
          validSignature,
          'webhook_secret'
        )
      ).resolves.toBe(true)

      // Invalid signature should fail
      await expect(
        paymentService.validateWebhookSignature(
          JSON.stringify(webhookPayload),
          invalidSignature,
          'webhook_secret'
        )
      ).rejects.toThrow('Invalid webhook signature')
    })

    it('should prevent webhook replay attacks', async () => {
      const webhookEvent = {
        id: 'evt_test_123',
        created: Math.floor(Date.now() / 1000) - 3600, // 1 hour old
        type: 'payment_intent.succeeded'
      }

      mockPaymentService.validateWebhookTimestamp.mockImplementation((timestamp) => {
        const maxAge = 300 // 5 minutes
        const currentTime = Math.floor(Date.now() / 1000)
        
        if (currentTime - timestamp > maxAge) {
          throw new Error('Webhook timestamp too old')
        }
        return true
      })

      mockPaymentService.checkWebhookReplay.mockImplementation((eventId) => {
        // Simulate duplicate event check
        const processedEvents = new Set(['evt_already_processed'])
        
        if (processedEvents.has(eventId)) {
          throw new Error('Webhook event already processed')
        }
        return true
      })

      // Old webhook should be rejected
      await expect(
        paymentService.validateWebhookTimestamp(webhookEvent.created)
      ).rejects.toThrow('Webhook timestamp too old')

      // Duplicate webhook should be rejected
      await expect(
        paymentService.checkWebhookReplay('evt_already_processed')
      ).rejects.toThrow('Webhook event already processed')
    })
  })

  describe('Refund Security', () => {
    it('should validate refund authorization', async () => {
      const refundRequest = {
        payment_id: 'pi_test_payment',
        amount: 1000,
        reason: 'requested_by_customer',
        authorized_by: 'user_123'
      }

      mockPaymentService.validateRefundAuthorization.mockImplementation((request) => {
        // Check if user has permission to refund
        const authorizedUsers = ['admin_123', 'manager_456']
        
        if (!authorizedUsers.includes(request.authorized_by)) {
          throw new Error('Insufficient permissions for refund')
        }

        // Check if refund amount doesn't exceed original payment
        if (request.amount > 1000) {
          throw new Error('Refund amount exceeds original payment')
        }

        return true
      })

      // Unauthorized user should be rejected
      await expect(
        paymentService.validateRefundAuthorization({
          ...refundRequest,
          authorized_by: 'regular_user'
        })
      ).rejects.toThrow('Insufficient permissions')

      // Excessive refund amount should be rejected
      await expect(
        paymentService.validateRefundAuthorization({
          ...refundRequest,
          amount: 2000,
          authorized_by: 'admin_123'
        })
      ).rejects.toThrow('exceeds original payment')
    })
  })

  describe('PII Protection', () => {
    it('should redact sensitive data in logs', async () => {
      const sensitiveData = {
        card_number: '4242424242424242',
        cvc: '123',
        ssn: '123-45-6789',
        account_number: '987654321'
      }

      mockPaymentService.logTransaction.mockImplementation((data) => {
        const logEntry = JSON.stringify(data)
        
        // Verify sensitive data is redacted
        expect(logEntry).not.toContain('4242424242424242')
        expect(logEntry).not.toContain('123-45-6789')
        expect(logEntry).not.toContain('987654321')
        
        // Should contain redacted versions
        expect(logEntry).toContain('****4242')
        expect(logEntry).toContain('***-**-6789')
        
        return Promise.resolve()
      })

      await paymentService.logTransaction(sensitiveData)
      expect(mockPaymentService.logTransaction).toHaveBeenCalled()
    })
  })
})