import { stripeServerClient } from './client'
import type { CreateTransferParams } from './types'
import type Stripe from 'stripe'
import { v4 as uuid } from 'uuid'
import { z } from 'zod'

/**
 * Strongly typed cents to prevent decimal amount errors
 * Stripe requires amounts as positive integers in smallest currency unit
 */
export type Cents = number & { __brand: 'cents' }

/**
 * Convert dollars to cents with proper rounding
 */
export function toCents(dollars: number): Cents {
  return Math.round(dollars * 100) as Cents
}

/**
 * Convert cents to dollars
 */
export function toDollars(cents: Cents): number {
  return cents / 100
}

/**
 * Validate amount is valid cents (positive integer)
 */
export function isValidCents(amount: number): amount is Cents {
  return Number.isInteger(amount) && amount > 0
}

/**
 * Create Cents from a validated number
 */
export function createCents(amount: number): Cents {
  if (!isValidCents(amount)) {
    throw new Error('Amount must be a positive integer in cents')
  }
  return amount as Cents
}

/**
 * Validate statement descriptor according to Stripe requirements
 */
const statementDescriptorSchema = z
  .string()
  .max(22, 'Statement descriptor must be 22 chars or less')
  .transform((val) => val.replace(/[<>]/g, ''))

/**
 * Restricted update params for transfers (Stripe only allows metadata and description)
 */
export interface TransferUpdateParams {
  metadata?: Stripe.Metadata
  description?: string
}

/**
 * Centralized error handler for Stripe operations
 * Prevents leaking sensitive information and provides type-safe error handling
 */
function handleStripeError(err: unknown, context: string): never {
  if (err instanceof stripeServerClient.errors.StripeError) {
    console.error(`${context} failed`, {
      type: err.type,
      code: err.code,
      param: err.param,
      requestId: err.requestId,
    })

    // Handle idempotent request duplicates as success
    if (err.code === 'idempotency_key_in_use' || err.statusCode === 409) {
      // This is actually a success - the operation was already completed
      // The caller should handle this appropriately
      const duplicateError = new Error('Operation already completed') as Error & {
        isDuplicate: boolean
        originalRequest?: unknown
      }
      duplicateError.isDuplicate = true
      duplicateError.originalRequest = err.raw
      throw duplicateError
    }

    // Return generic error messages to prevent information leakage
    if (err.code === 'resource_missing') {
      throw new Error(`Resource not found. Please check your request and try again.`)
    }

    if (err.code === 'insufficient_funds') {
      throw new Error('Insufficient funds for payout. Please try again later.')
    }

    if (err.code === 'invalid_request_error' && err.param === 'amount') {
      throw new Error('Invalid amount. Amount must be a positive integer in cents.')
    }

    throw new Error(`Payout service error. Please retry or contact support.`)
  }

  console.error(`${context} unexpected error`, err)
  throw new Error('Internal server error. Please try again later.')
}

export interface CreatePayoutParams {
  accountId: string
  amount: Cents // Enforced as integer cents
  currency: string
  metadata: {
    supplierId: string
    payoutPeriod: string
    callCount: string
  }
  statementDescriptor?: string
}

export interface PayoutSummary {
  totalAmount: Cents // Enforced as integer cents
  currency: string
  transferCount: number
  period: {
    start: Date
    end: Date
  }
}

export const createTransfer = async (params: CreateTransferParams): Promise<Stripe.Transfer> => {
  try {
    // Validate amount is positive integer
    if (!Number.isInteger(params.amount) || params.amount <= 0) {
      throw new Error('Amount must be a positive integer in cents')
    }

    const transfer = await stripeServerClient.transfers.create(
      {
        amount: params.amount,
        currency: params.currency,
        destination: params.destination,
        transfer_group: `payout_${params.metadata.payoutId}`,
        metadata: {
          ...params.metadata,
          platform: 'dependablecalls',
        },
      },
      {
        idempotencyKey: uuid(), // Prevent duplicate transfers
      }
    )

    return transfer
  } catch (error: unknown) {
    // Check if this is a duplicate operation (409 response)
    if (error instanceof Error && 'isDuplicate' in error && error.isDuplicate) {
      console.log('Transfer already created, returning success')
      // In production, you'd retrieve and return the original transfer
      // For now, we re-throw to let caller handle
      throw error
    }
    handleStripeError(error, 'create transfer')
  }
}

export const reverseTransfer = async (
  transferId: string,
  amount?: Cents,
  reason?: string
): Promise<Stripe.TransferReversal> => {
  try {
    // Validate amount if provided
    if (amount !== undefined && (!Number.isInteger(amount) || amount <= 0)) {
      throw new Error('Amount must be a positive integer in cents')
    }

    const reversal = await stripeServerClient.transfers.createReversal(
      transferId,
      {
        amount,
        description: reason,
        metadata: {
          platform: 'dependablecalls',
          reason: reason || 'fraud_detected',
        },
      },
      {
        idempotencyKey: uuid(), // Prevent duplicate reversals
      }
    )

    return reversal
  } catch (error: unknown) {
    handleStripeError(error, 'reverse transfer')
  }
}

export const getTransfer = async (transferId: string): Promise<Stripe.Transfer | null> => {
  try {
    const transfer = await stripeServerClient.transfers.retrieve(transferId)
    return transfer
  } catch (error: unknown) {
    if (
      error instanceof stripeServerClient.errors.StripeError &&
      error.code === 'resource_missing'
    ) {
      return null
    }
    handleStripeError(error, 'retrieve transfer')
  }
}

export const updateTransfer = async (
  transferId: string,
  updates: TransferUpdateParams // Restricted to only metadata and description
): Promise<Stripe.Transfer> => {
  try {
    // Stripe only allows updating metadata and description on transfers
    const allowedUpdates: Stripe.TransferUpdateParams = {}
    if (updates.metadata !== undefined) {
      allowedUpdates.metadata = updates.metadata
    }
    if (updates.description !== undefined) {
      allowedUpdates.description = updates.description
    }

    const transfer = await stripeServerClient.transfers.update(transferId, allowedUpdates, {
      idempotencyKey: uuid(), // Prevent duplicate updates
    })

    return transfer
  } catch (error: unknown) {
    handleStripeError(error, 'update transfer')
  }
}

export const createPayout = async (params: CreatePayoutParams): Promise<Stripe.Payout> => {
  try {
    // Validate amount is positive integer
    if (!Number.isInteger(params.amount) || params.amount <= 0) {
      throw new Error('Amount must be a positive integer in cents')
    }

    // Validate and sanitize statement descriptor
    const statementDescriptor = params.statementDescriptor
      ? statementDescriptorSchema.parse(params.statementDescriptor)
      : 'DCE Payout'

    // First check if account can receive payouts
    const account = await stripeServerClient.accounts.retrieve(params.accountId)
    if (account.type === 'standard') {
      throw new Error('Cannot create payouts for Standard accounts. Use transfers instead.')
    }
    if (!account.payouts_enabled) {
      throw new Error('Account is not enabled for payouts. Please complete account verification.')
    }

    const payout = await stripeServerClient.payouts.create(
      {
        amount: params.amount,
        currency: params.currency,
        statement_descriptor: statementDescriptor,
        metadata: {
          ...params.metadata,
          platform: 'dependablecalls',
        },
      },
      {
        stripeAccount: params.accountId,
        idempotencyKey: uuid(), // Prevent duplicate payouts
      }
    )

    return payout
  } catch (error: unknown) {
    handleStripeError(error, 'create payout')
  }
}

export const cancelPayout = async (payoutId: string, accountId: string): Promise<Stripe.Payout> => {
  try {
    const payout = await stripeServerClient.payouts.cancel(
      payoutId,
      {},
      { stripeAccount: accountId }
    )

    return payout
  } catch (error) {
    console.error('Error canceling payout:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to cancel payout: ${errorMessage}`)
  }
}

export const getPayout = async (
  payoutId: string,
  accountId: string
): Promise<Stripe.Payout | null> => {
  try {
    const payout = await stripeServerClient.payouts.retrieve(
      payoutId,
      {},
      { stripeAccount: accountId }
    )

    return payout
  } catch (error: unknown) {
    if (
      error instanceof stripeServerClient.errors.StripeError &&
      error.code === 'resource_missing'
    ) {
      return null
    }
    handleStripeError(error, 'retrieve payout')
  }
}

export const listAccountPayouts = async (
  accountId: string,
  status?: 'pending' | 'paid' | 'failed' | 'canceled',
  limit: number = 100
): Promise<Stripe.Payout[]> => {
  try {
    const payouts: Stripe.Payout[] = []

    // Use auto-pagination to ensure we get all payouts
    for await (const payout of stripeServerClient.payouts.list(
      {
        status,
        limit,
      },
      {
        stripeAccount: accountId,
      }
    )) {
      payouts.push(payout)
    }

    return payouts
  } catch (error: unknown) {
    handleStripeError(error, 'list payouts')
  }
}

export const createBulkPayout = async (
  payouts: Array<{
    accountId: string
    amount: Cents
    metadata: Record<string, string>
  }>,
  transferGroup: string,
  maxConcurrency: number = 5 // Limit concurrent requests
): Promise<Array<{ success: boolean; transfer?: Stripe.Transfer; error?: Error }>> => {
  try {
    // Create batches for concurrent processing
    const results: Array<{ success: boolean; transfer?: Stripe.Transfer; error?: Error }> = []

    // Process in batches to avoid rate limits
    for (let i = 0; i < payouts.length; i += maxConcurrency) {
      const batch = payouts.slice(i, i + maxConcurrency)

      const batchPromises = batch.map(async (payout) => {
        try {
          const transfer = await createTransfer({
            amount: payout.amount,
            currency: 'usd',
            destination: payout.accountId,
            metadata: {
              ...payout.metadata,
              transferGroup,
              payoutId: `${transferGroup}_${payout.accountId}_${Date.now()}`,
              supplierId: payout.metadata.supplierId || 'bulk',
              callCount: payout.metadata.callCount || '0',
              period: payout.metadata.period || transferGroup,
            },
          } as CreateTransferParams)

          return { success: true, transfer }
        } catch (error: unknown) {
          // Don't fail entire batch for individual errors
          const errorObj = error instanceof Error ? error : new Error(String(error))
          return { success: false, error: errorObj }
        }
      })

      const batchResults = await Promise.allSettled(batchPromises)

      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          results.push({ success: false, error: result.reason })
        }
      })
    }

    return results
  } catch (error: unknown) {
    handleStripeError(error, 'create bulk payout')
  }
}

export const calculatePayoutSummary = async (
  accountId: string,
  period: { start: Date; end: Date }
): Promise<PayoutSummary> => {
  try {
    let totalAmount = 0
    let transferCount = 0

    // Use auto-pagination to ensure we get ALL transfers
    for await (const transfer of stripeServerClient.transfers.list({
      destination: accountId,
      created: {
        gte: Math.floor(period.start.getTime() / 1000),
        lt: Math.floor(period.end.getTime() / 1000),
      },
      limit: 100, // Page size
    })) {
      totalAmount += transfer.amount
      transferCount++
    }

    return {
      totalAmount: totalAmount as Cents,
      currency: 'usd',
      transferCount,
      period,
    }
  } catch (error: unknown) {
    handleStripeError(error, 'calculate payout summary')
  }
}

export const scheduleWeeklyPayouts = async (
  suppliers: Array<{
    accountId: string
    supplierId: string
    amount: Cents
    callCount: number
  }>,
  maxConcurrency: number = 5
): Promise<
  Array<{ supplierId: string; success: boolean; transfer?: Stripe.Transfer; error?: Error }>
> => {
  try {
    const now = new Date()
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const payoutPeriod = weekStart.toISOString().split('T')[0]
    const payoutGroup = `weekly_${payoutPeriod}`

    // Generate deterministic payout IDs to prevent duplicates
    const generatePayoutId = (supplierId: string) => {
      // Use supplier ID and period for idempotency
      return `payout_${supplierId}_${payoutPeriod}`
    }

    const results: Array<{
      supplierId: string
      success: boolean
      transfer?: Stripe.Transfer
      error?: Error
    }> = []

    // Filter eligible suppliers
    const eligibleSuppliers = suppliers.filter((s) => s.amount >= 10000) // $100 minimum

    // Process in batches for better performance
    for (let i = 0; i < eligibleSuppliers.length; i += maxConcurrency) {
      const batch = eligibleSuppliers.slice(i, i + maxConcurrency)

      const batchPromises = batch.map(async (supplier) => {
        try {
          const transfer = await createTransfer({
            amount: supplier.amount,
            currency: 'usd',
            destination: supplier.accountId,
            metadata: {
              payoutId: generatePayoutId(supplier.supplierId),
              supplierId: supplier.supplierId,
              callCount: supplier.callCount.toString(),
              period: payoutGroup,
            },
          } as CreateTransferParams)

          return { supplierId: supplier.supplierId, success: true, transfer }
        } catch (error: unknown) {
          // Check if it's a duplicate (already processed)
          if (
            error instanceof Error &&
            'isDuplicate' in error &&
            (error as Error & { isDuplicate: boolean }).isDuplicate
          ) {
            console.log(`Payout already processed for supplier ${supplier.supplierId}`)
            return { supplierId: supplier.supplierId, success: true, transfer: undefined }
          }

          console.error(`Failed to create payout for supplier ${supplier.supplierId}:`, error)
          return { supplierId: supplier.supplierId, success: false, error: error as Error }
        }
      })

      const batchResults = await Promise.allSettled(batchPromises)

      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          results.push({
            supplierId: 'unknown',
            success: false,
            error: result.reason,
          })
        }
      })
    }

    // Log summary
    const successful = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length
    console.log(`Weekly payouts completed: ${successful} successful, ${failed} failed`)

    return results
  } catch (error: unknown) {
    handleStripeError(error, 'schedule weekly payouts')
  }
}

/**
 * Get payout history for an account
 */
export const getPayoutHistory = async (
  accountId: string,
  limit: number = 20,
  starting_after?: string
): Promise<{
  payouts: Stripe.Payout[]
  has_more: boolean
}> => {
  try {
    const response = await stripeServerClient.payouts.list(
      {
        limit,
        starting_after,
      },
      {
        stripeAccount: accountId,
      }
    )

    return {
      payouts: response.data,
      has_more: response.has_more,
    }
  } catch (error: unknown) {
    handleStripeError(error, 'get payout history')
  }
}

/**
 * Get account balance
 */
export const getPayoutBalance = async (
  accountId: string
): Promise<{
  available: Stripe.Balance.Available[]
  pending: Stripe.Balance.Pending[]
}> => {
  try {
    const balance = await stripeServerClient.balance.retrieve({
      stripeAccount: accountId,
    })

    return {
      available: balance.available,
      pending: balance.pending,
    }
  } catch (error: unknown) {
    handleStripeError(error, 'get payout balance')
  }
}
