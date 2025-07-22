import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createInvoice,
  createInvoiceItem,
  finalizeInvoice,
  sendInvoice,
  payInvoice,
  voidInvoice,
  updateInvoice,
  getInvoice,
  listCustomerInvoices,
  createCreditNote,
  createUsageBasedInvoice,
  CreateInvoiceParams,
  CreateInvoiceItemParams,
} from '@/integrations/stripe/billing'
import { stripeServerClient } from '@/integrations/stripe/client'
import type Stripe from 'stripe'

// Mock the stripe client
vi.mock('@/integrations/stripe/client', () => ({
  stripeServerClient: {
    invoices: {
      create: vi.fn(),
      finalizeInvoice: vi.fn(),
      sendInvoice: vi.fn(),
      pay: vi.fn(),
      voidInvoice: vi.fn(),
      update: vi.fn(),
      retrieve: vi.fn(),
      list: vi.fn(),
    },
    invoiceItems: {
      create: vi.fn(),
    },
    creditNotes: {
      create: vi.fn(),
    },
  },
}))

describe('Stripe Billing Module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createInvoice', () => {
    const mockInvoice = {
      id: 'in_123',
      customer: 'cus_123',
      status: 'draft',
    } as Stripe.Invoice

    const invoiceParams: CreateInvoiceParams = {
      customerId: 'cus_123',
      description: 'Test invoice',
      metadata: {
        buyerId: 'buyer_123',
        billingPeriod: '2024-01',
        callCount: '50',
      },
    }

    it('should create an invoice successfully', async () => {
      vi.mocked(stripeServerClient.invoices.create).mockResolvedValue(mockInvoice)

      const result = await createInvoice(invoiceParams)

      expect(stripeServerClient.invoices.create).toHaveBeenCalledWith({
        customer: 'cus_123',
        description: 'Test invoice',
        metadata: {
          buyerId: 'buyer_123',
          billingPeriod: '2024-01',
          callCount: '50',
          platform: 'dependablecalls',
        },
        collection_method: 'charge_automatically',
        auto_advance: false,
      })
      expect(result).toEqual(mockInvoice)
    })

    it('should create an invoice with optional parameters', async () => {
      vi.mocked(stripeServerClient.invoices.create).mockResolvedValue(mockInvoice)

      const paramsWithOptionals: CreateInvoiceParams = {
        ...invoiceParams,
        dueDate: 1234567890,
        collectionMethod: 'send_invoice',
      }

      await createInvoice(paramsWithOptionals)

      expect(stripeServerClient.invoices.create).toHaveBeenCalledWith({
        customer: 'cus_123',
        description: 'Test invoice',
        metadata: {
          buyerId: 'buyer_123',
          billingPeriod: '2024-01',
          callCount: '50',
          platform: 'dependablecalls',
        },
        due_date: 1234567890,
        collection_method: 'send_invoice',
        auto_advance: false,
      })
    })

    it('should handle creation errors', async () => {
      vi.mocked(stripeServerClient.invoices.create).mockRejectedValue(new Error('Stripe API error'))

      await expect(createInvoice(invoiceParams)).rejects.toThrow(
        'Failed to create invoice: Stripe API error'
      )
      expect(console.error).toHaveBeenCalledWith('Error creating invoice:', expect.any(Error))
    })

    it('should handle non-Error exceptions', async () => {
      vi.mocked(stripeServerClient.invoices.create).mockRejectedValue('String error')

      await expect(createInvoice(invoiceParams)).rejects.toThrow(
        'Failed to create invoice: Unknown error'
      )
    })
  })

  describe('createInvoiceItem', () => {
    const mockInvoiceItem = {
      id: 'ii_123',
      customer: 'cus_123',
      amount: 5000,
    } as Stripe.InvoiceItem

    const invoiceItemParams: CreateInvoiceItemParams = {
      customerId: 'cus_123',
      amount: 5000,
      currency: 'usd',
      description: 'Call charges',
      metadata: {
        callId: 'call_123',
        campaignId: 'campaign_456',
        duration: '180',
      },
    }

    it('should create an invoice item successfully', async () => {
      vi.mocked(stripeServerClient.invoiceItems.create).mockResolvedValue(mockInvoiceItem)

      const result = await createInvoiceItem(invoiceItemParams)

      expect(stripeServerClient.invoiceItems.create).toHaveBeenCalledWith({
        customer: 'cus_123',
        amount: 5000,
        currency: 'usd',
        description: 'Call charges',
        metadata: {
          callId: 'call_123',
          campaignId: 'campaign_456',
          duration: '180',
          platform: 'dependablecalls',
        },
      })
      expect(result).toEqual(mockInvoiceItem)
    })

    it('should attach to existing invoice when invoiceId provided', async () => {
      vi.mocked(stripeServerClient.invoiceItems.create).mockResolvedValue(mockInvoiceItem)

      const paramsWithInvoice: CreateInvoiceItemParams = {
        ...invoiceItemParams,
        invoiceId: 'in_123',
      }

      await createInvoiceItem(paramsWithInvoice)

      expect(stripeServerClient.invoiceItems.create).toHaveBeenCalledWith({
        customer: 'cus_123',
        amount: 5000,
        currency: 'usd',
        description: 'Call charges',
        metadata: {
          callId: 'call_123',
          campaignId: 'campaign_456',
          duration: '180',
          platform: 'dependablecalls',
        },
        invoice: 'in_123',
      })
    })

    it('should handle creation errors', async () => {
      vi.mocked(stripeServerClient.invoiceItems.create).mockRejectedValue(
        new Error('Item creation failed')
      )

      await expect(createInvoiceItem(invoiceItemParams)).rejects.toThrow(
        'Failed to create invoice item: Item creation failed'
      )
    })
  })

  describe('finalizeInvoice', () => {
    const mockFinalizedInvoice = {
      id: 'in_123',
      status: 'open',
    } as Stripe.Invoice

    it('should finalize invoice with auto advance', async () => {
      vi.mocked(stripeServerClient.invoices.finalizeInvoice).mockResolvedValue(mockFinalizedInvoice)

      const result = await finalizeInvoice('in_123')

      expect(stripeServerClient.invoices.finalizeInvoice).toHaveBeenCalledWith('in_123', {
        auto_advance: true,
      })
      expect(result).toEqual(mockFinalizedInvoice)
    })

    it('should finalize invoice without auto advance', async () => {
      vi.mocked(stripeServerClient.invoices.finalizeInvoice).mockResolvedValue(mockFinalizedInvoice)

      await finalizeInvoice('in_123', false)

      expect(stripeServerClient.invoices.finalizeInvoice).toHaveBeenCalledWith('in_123', {
        auto_advance: false,
      })
    })

    it('should handle finalization errors', async () => {
      vi.mocked(stripeServerClient.invoices.finalizeInvoice).mockRejectedValue(
        new Error('Finalization failed')
      )

      await expect(finalizeInvoice('in_123')).rejects.toThrow(
        'Failed to finalize invoice: Finalization failed'
      )
    })
  })

  describe('sendInvoice', () => {
    const mockSentInvoice = {
      id: 'in_123',
      status: 'open',
    } as Stripe.Invoice

    it('should send invoice successfully', async () => {
      vi.mocked(stripeServerClient.invoices.sendInvoice).mockResolvedValue(mockSentInvoice)

      const result = await sendInvoice('in_123')

      expect(stripeServerClient.invoices.sendInvoice).toHaveBeenCalledWith('in_123')
      expect(result).toEqual(mockSentInvoice)
    })

    it('should handle send errors', async () => {
      vi.mocked(stripeServerClient.invoices.sendInvoice).mockRejectedValue(new Error('Send failed'))

      await expect(sendInvoice('in_123')).rejects.toThrow('Failed to send invoice: Send failed')
    })
  })

  describe('payInvoice', () => {
    const mockPaidInvoice = {
      id: 'in_123',
      status: 'paid',
    } as Stripe.Invoice

    it('should pay invoice with default payment method', async () => {
      vi.mocked(stripeServerClient.invoices.pay).mockResolvedValue(mockPaidInvoice)

      const result = await payInvoice('in_123')

      expect(stripeServerClient.invoices.pay).toHaveBeenCalledWith('in_123', {})
      expect(result).toEqual(mockPaidInvoice)
    })

    it('should pay invoice with specific payment method', async () => {
      vi.mocked(stripeServerClient.invoices.pay).mockResolvedValue(mockPaidInvoice)

      await payInvoice('in_123', 'pm_123')

      expect(stripeServerClient.invoices.pay).toHaveBeenCalledWith('in_123', {
        payment_method: 'pm_123',
      })
    })

    it('should handle payment errors', async () => {
      vi.mocked(stripeServerClient.invoices.pay).mockRejectedValue(new Error('Payment failed'))

      await expect(payInvoice('in_123')).rejects.toThrow('Failed to pay invoice: Payment failed')
    })
  })

  describe('voidInvoice', () => {
    const mockVoidedInvoice = {
      id: 'in_123',
      status: 'void',
    } as Stripe.Invoice

    it('should void invoice successfully', async () => {
      vi.mocked(stripeServerClient.invoices.voidInvoice).mockResolvedValue(mockVoidedInvoice)

      const result = await voidInvoice('in_123')

      expect(stripeServerClient.invoices.voidInvoice).toHaveBeenCalledWith('in_123')
      expect(result).toEqual(mockVoidedInvoice)
    })

    it('should handle void errors', async () => {
      vi.mocked(stripeServerClient.invoices.voidInvoice).mockRejectedValue(new Error('Void failed'))

      await expect(voidInvoice('in_123')).rejects.toThrow('Failed to void invoice: Void failed')
    })
  })

  describe('updateInvoice', () => {
    const mockUpdatedInvoice = {
      id: 'in_123',
      description: 'Updated description',
    } as Stripe.Invoice

    it('should update invoice successfully', async () => {
      vi.mocked(stripeServerClient.invoices.update).mockResolvedValue(mockUpdatedInvoice)

      const updates = { description: 'Updated description' }
      const result = await updateInvoice('in_123', updates)

      expect(stripeServerClient.invoices.update).toHaveBeenCalledWith('in_123', updates)
      expect(result).toEqual(mockUpdatedInvoice)
    })

    it('should handle update errors', async () => {
      vi.mocked(stripeServerClient.invoices.update).mockRejectedValue(new Error('Update failed'))

      await expect(updateInvoice('in_123', {})).rejects.toThrow(
        'Failed to update invoice: Update failed'
      )
    })
  })

  describe('getInvoice', () => {
    const mockInvoice = {
      id: 'in_123',
      customer: 'cus_123',
    } as Stripe.Invoice

    it('should retrieve invoice successfully', async () => {
      vi.mocked(stripeServerClient.invoices.retrieve).mockResolvedValue(mockInvoice)

      const result = await getInvoice('in_123')

      expect(stripeServerClient.invoices.retrieve).toHaveBeenCalledWith('in_123')
      expect(result).toEqual(mockInvoice)
    })

    it('should return null for missing invoice', async () => {
      const missingError = { code: 'resource_missing' }
      vi.mocked(stripeServerClient.invoices.retrieve).mockRejectedValue(missingError)

      const result = await getInvoice('in_123')

      expect(result).toBeNull()
    })

    it('should handle other errors', async () => {
      vi.mocked(stripeServerClient.invoices.retrieve).mockRejectedValue(
        new Error('Retrieve failed')
      )

      await expect(getInvoice('in_123')).rejects.toThrow(
        'Failed to retrieve invoice: Retrieve failed'
      )
    })
  })

  describe('listCustomerInvoices', () => {
    const mockInvoices = {
      data: [
        { id: 'in_1', status: 'paid' },
        { id: 'in_2', status: 'open' },
      ],
    } as Stripe.ApiList<Stripe.Invoice>

    it('should list customer invoices', async () => {
      vi.mocked(stripeServerClient.invoices.list).mockResolvedValue(mockInvoices)

      const result = await listCustomerInvoices('cus_123')

      expect(stripeServerClient.invoices.list).toHaveBeenCalledWith({
        customer: 'cus_123',
        status: undefined,
        limit: 100,
      })
      expect(result).toEqual(mockInvoices.data)
    })

    it('should filter by status', async () => {
      vi.mocked(stripeServerClient.invoices.list).mockResolvedValue(mockInvoices)

      await listCustomerInvoices('cus_123', 'open', 50)

      expect(stripeServerClient.invoices.list).toHaveBeenCalledWith({
        customer: 'cus_123',
        status: 'open',
        limit: 50,
      })
    })

    it('should handle listing errors', async () => {
      vi.mocked(stripeServerClient.invoices.list).mockRejectedValue(new Error('List failed'))

      await expect(listCustomerInvoices('cus_123')).rejects.toThrow(
        'Failed to list invoices: List failed'
      )
    })
  })

  describe('createCreditNote', () => {
    const mockCreditNote = {
      id: 'cn_123',
      invoice: 'in_123',
      amount: 1000,
    } as Stripe.CreditNote

    it('should create credit note successfully', async () => {
      vi.mocked(stripeServerClient.creditNotes.create).mockResolvedValue(mockCreditNote)

      const result = await createCreditNote('in_123', 1000, 'duplicate', 'Test memo')

      expect(stripeServerClient.creditNotes.create).toHaveBeenCalledWith({
        invoice: 'in_123',
        amount: 1000,
        reason: 'duplicate',
        memo: 'Test memo',
        metadata: {
          platform: 'dependablecalls',
        },
      })
      expect(result).toEqual(mockCreditNote)
    })

    it('should create credit note without memo', async () => {
      vi.mocked(stripeServerClient.creditNotes.create).mockResolvedValue(mockCreditNote)

      await createCreditNote('in_123', 1000, 'fraudulent')

      expect(stripeServerClient.creditNotes.create).toHaveBeenCalledWith({
        invoice: 'in_123',
        amount: 1000,
        reason: 'fraudulent',
        memo: undefined,
        metadata: {
          platform: 'dependablecalls',
        },
      })
    })

    it('should handle credit note errors', async () => {
      vi.mocked(stripeServerClient.creditNotes.create).mockRejectedValue(
        new Error('Credit note failed')
      )

      await expect(createCreditNote('in_123', 1000, 'duplicate')).rejects.toThrow(
        'Failed to create credit note: Credit note failed'
      )
    })
  })

  describe('createUsageBasedInvoice', () => {
    const mockInvoice = {
      id: 'in_123',
      customer: 'cus_123',
    } as Stripe.Invoice

    const mockFinalizedInvoice = {
      ...mockInvoice,
      status: 'open',
    } as Stripe.Invoice

    const billingPeriod = {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31'),
    }

    const usageRecords = [
      {
        amount: 2500,
        description: 'Call 1',
        metadata: { callId: 'call_1' },
      },
      {
        amount: 3500,
        description: 'Call 2',
        metadata: { callId: 'call_2' },
      },
    ]

    it('should create usage-based invoice with multiple items', async () => {
      vi.mocked(stripeServerClient.invoices.create).mockResolvedValue(mockInvoice)
      vi.mocked(stripeServerClient.invoiceItems.create).mockResolvedValue({} as Stripe.InvoiceItem)
      vi.mocked(stripeServerClient.invoices.finalizeInvoice).mockResolvedValue(mockFinalizedInvoice)

      const result = await createUsageBasedInvoice('cus_123', billingPeriod, usageRecords)

      // Check invoice creation
      expect(stripeServerClient.invoices.create).toHaveBeenCalledWith({
        customer: 'cus_123',
        description: 'Usage charges for 2024-01-01 to 2024-01-31',
        metadata: {
          buyerId: 'cus_123',
          billingPeriod: `${billingPeriod.start.toISOString()}_${billingPeriod.end.toISOString()}`,
          callCount: '2',
          platform: 'dependablecalls',
        },
        collection_method: 'charge_automatically',
        auto_advance: false,
      })

      // Check invoice items creation
      expect(stripeServerClient.invoiceItems.create).toHaveBeenCalledTimes(2)
      expect(stripeServerClient.invoiceItems.create).toHaveBeenNthCalledWith(1, {
        customer: 'cus_123',
        amount: 2500,
        currency: 'usd',
        description: 'Call 1',
        metadata: {
          callId: 'call_1',
          platform: 'dependablecalls',
        },
        invoice: 'in_123',
      })

      // Check finalization
      expect(stripeServerClient.invoices.finalizeInvoice).toHaveBeenCalledWith('in_123', {
        auto_advance: true,
      })

      expect(result).toEqual(mockFinalizedInvoice)
    })

    it('should handle errors in usage-based invoice creation', async () => {
      vi.mocked(stripeServerClient.invoices.create).mockRejectedValue(new Error('Creation failed'))

      await expect(createUsageBasedInvoice('cus_123', billingPeriod, usageRecords)).rejects.toThrow(
        'Failed to create usage-based invoice: Failed to create invoice: Creation failed'
      )
    })

    it('should handle errors in invoice item creation', async () => {
      vi.mocked(stripeServerClient.invoices.create).mockResolvedValue(mockInvoice)
      vi.mocked(stripeServerClient.invoiceItems.create).mockRejectedValue(new Error('Item failed'))

      await expect(createUsageBasedInvoice('cus_123', billingPeriod, usageRecords)).rejects.toThrow(
        'Failed to create usage-based invoice: Failed to create invoice item: Item failed'
      )
    })
  })
})
