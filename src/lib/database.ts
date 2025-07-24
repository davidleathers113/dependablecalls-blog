import { supabase } from './supabase'
import type { Database } from '../types/database'

// Type aliases for cleaner code
type Views = Database['public']['Views']
type Functions = Database['public']['Functions']

// View types
type SupplierStats = Views['supplier_stats_view']['Row']
type BuyerStats = Views['buyer_stats_view']['Row']
type CampaignPerformance = Views['campaign_performance_view']['Row']

// Function return types
type UserStatsReturn = Functions['get_user_stats']['Returns']
type SupplierPayoutReturn = Functions['calculate_supplier_payout']['Returns']
type AddCreditsReturn = Functions['add_buyer_credits']['Returns']
type DeductBalanceReturn = Functions['deduct_buyer_balance']['Returns']

/**
 * Database View Queries
 */

/**
 * Get supplier statistics from the view
 * @param supplierId - The supplier ID to filter by (optional)
 * @returns Array of supplier statistics
 */
export async function getSupplierStats(supplierId?: string): Promise<SupplierStats[]> {
  const query = supabase.from('supplier_stats_view').select('*')

  if (supplierId) {
    query.eq('supplier_id', supplierId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch supplier stats: ${error.message}`)
  }

  return data || []
}

/**
 * Get buyer statistics from the view
 * @param buyerId - The buyer ID to filter by (optional)
 * @returns Array of buyer statistics
 */
export async function getBuyerStats(buyerId?: string): Promise<BuyerStats[]> {
  const query = supabase.from('buyer_stats_view').select('*')

  if (buyerId) {
    query.eq('buyer_id', buyerId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch buyer stats: ${error.message}`)
  }

  return data || []
}

/**
 * Get campaign performance data from the view
 * @param filters - Optional filters for campaign performance
 * @returns Array of campaign performance data
 */
export async function getCampaignPerformance(filters?: {
  campaignId?: string
  supplierId?: string
  status?: string
}): Promise<CampaignPerformance[]> {
  const query = supabase.from('campaign_performance_view').select('*')

  if (filters?.campaignId) {
    query.eq('campaign_id', filters.campaignId)
  }

  if (filters?.supplierId) {
    query.eq('supplier_id', filters.supplierId)
  }

  if (filters?.status) {
    query.eq('status', filters.status)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch campaign performance: ${error.message}`)
  }

  return data || []
}

/**
 * Database RPC Functions
 */

/**
 * Get user statistics including calls, minutes, revenue, and average call duration
 * @param userId - The user ID to get stats for
 * @returns User statistics object
 */
export async function getUserStats(userId: string): Promise<UserStatsReturn> {
  const { data, error } = await supabase.rpc('get_user_stats', {
    user_id: userId,
  })

  if (error) {
    throw new Error(`Failed to get user stats: ${error.message}`)
  }

  if (!data) {
    throw new Error('No data returned from get_user_stats')
  }

  return data
}

/**
 * Calculate supplier payout for a given date range
 * @param supplierId - The supplier ID
 * @param startDate - Start date for the calculation (ISO string)
 * @param endDate - End date for the calculation (ISO string)
 * @returns Payout calculation result with total amount, call count, and call details
 */
export async function calculateSupplierPayout(
  supplierId: string,
  startDate: string,
  endDate: string
): Promise<SupplierPayoutReturn> {
  const { data, error } = await supabase.rpc('calculate_supplier_payout', {
    supplier_id: supplierId,
    start_date: startDate,
    end_date: endDate,
  })

  if (error) {
    throw new Error(`Failed to calculate supplier payout: ${error.message}`)
  }

  if (!data) {
    throw new Error('No data returned from calculate_supplier_payout')
  }

  return data
}

/**
 * Add credits to a buyer's account
 * @param buyerId - The buyer ID
 * @param amount - Amount to add (positive number)
 * @param paymentIntentId - Stripe payment intent ID for tracking
 * @returns New balance and transaction ID
 */
export async function addBuyerCredits(
  buyerId: string,
  amount: number,
  paymentIntentId: string
): Promise<AddCreditsReturn> {
  if (amount <= 0) {
    throw new Error('Amount must be greater than 0')
  }

  const { data, error } = await supabase.rpc('add_buyer_credits', {
    buyer_id: buyerId,
    amount: amount,
    payment_intent_id: paymentIntentId,
  })

  if (error) {
    throw new Error(`Failed to add buyer credits: ${error.message}`)
  }

  if (!data) {
    throw new Error('No data returned from add_buyer_credits')
  }

  return data
}

/**
 * Deduct from a buyer's balance for a call
 * @param buyerId - The buyer ID
 * @param amount - Amount to deduct (positive number)
 * @param callId - The call ID this deduction is for
 * @returns New balance and transaction ID
 */
export async function deductBuyerBalance(
  buyerId: string,
  amount: number,
  callId: string
): Promise<DeductBalanceReturn> {
  if (amount <= 0) {
    throw new Error('Amount must be greater than 0')
  }

  const { data, error } = await supabase.rpc('deduct_buyer_balance', {
    buyer_id: buyerId,
    amount: amount,
    call_id: callId,
  })

  if (error) {
    throw new Error(`Failed to deduct buyer balance: ${error.message}`)
  }

  if (!data) {
    throw new Error('No data returned from deduct_buyer_balance')
  }

  return data
}

/**
 * Helper function to format dates for database queries
 * @param date - JavaScript Date object
 * @returns ISO string formatted for PostgreSQL
 */
export function formatDateForDB(date: Date): string {
  return date.toISOString()
}

/**
 * Helper to check if a database error is due to insufficient funds
 * @param error - The error object from Supabase
 * @returns boolean indicating if it's an insufficient funds error
 */
export function isInsufficientFundsError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.toLowerCase().includes('insufficient') ||
      error.message.toLowerCase().includes('balance')
    )
  }
  return false
}

// Re-export types for convenience
export type {
  SupplierStats,
  BuyerStats,
  CampaignPerformance,
  UserStatsReturn,
  SupplierPayoutReturn,
  AddCreditsReturn,
  DeductBalanceReturn,
}
