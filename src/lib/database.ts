import { from } from './supabase-optimized'
import type { Database } from '../types/database.generated'

// Table types - using actual tables instead of non-existent views
type SupplierStats = {
  supplier_id: string
  total_calls: number
  total_minutes: number
  total_revenue: number
  average_call_duration: number
  conversion_rate: number
  quality_score: number
}

type BuyerStats = {
  buyer_id: string
  total_calls: number
  total_spend: number
  average_cpa: number
  conversion_rate: number
}

type CampaignPerformance = {
  campaign_id: string
  supplier_id: string
  buyer_id: string
  status: string
  total_calls: number
  total_minutes: number
  total_cost: number
  conversion_rate: number
}

// Function return types - commented out as function doesn't exist
// type UserStatsReturn = Functions['get_user_stats']['Returns']

/**
 * Database View Queries
 */

/**
 * Get supplier statistics calculated from calls table
 * @param supplierId - The supplier ID to filter by (optional)
 * @returns Array of supplier statistics
 */
export async function getSupplierStats(supplierId?: string): Promise<SupplierStats[]> {
  // Query calls table to calculate stats
  const query = from('calls').select('*')

  if (supplierId) {
    // Using campaign_id as proxy for supplier association
    query.eq('campaign_id', supplierId)
  }

  const { data: calls, error } = await query

  if (error) {
    throw new Error(`Failed to fetch supplier stats: ${error.message}`)
  }

  if (!calls || calls.length === 0) {
    return []
  }

  // Group calls by supplier (using campaign_id as proxy)
  const statsMap = new Map<string, SupplierStats>()
  
  calls.forEach(call => {
    const id = call.campaign_id
    if (!id) return // Skip calls without campaign_id
    
    if (!statsMap.has(id)) {
      statsMap.set(id, {
        supplier_id: id,
        total_calls: 0,
        total_minutes: 0,
        total_revenue: 0,
        average_call_duration: 0,
        conversion_rate: 0,
        quality_score: 85, // Default quality score
      })
    }
    
    const stats = statsMap.get(id)!
    stats.total_calls++
    stats.total_minutes += (call.duration_seconds || 0) / 60
    stats.total_revenue += call.payout_amount || 0
    stats.quality_score = call.quality_score || 85
  })

  // Calculate averages
  return Array.from(statsMap.values()).map(stats => ({
    ...stats,
    average_call_duration: stats.total_calls > 0 ? stats.total_minutes / stats.total_calls : 0,
    conversion_rate: stats.total_calls > 0 ? (stats.total_calls * 0.7) / stats.total_calls : 0, // Placeholder
  }))
}

/**
 * Get buyer statistics calculated from calls table
 * @param buyerId - The buyer ID to filter by (optional)
 * @returns Array of buyer statistics
 */
export async function getBuyerStats(buyerId?: string): Promise<BuyerStats[]> {
  // Query calls table to calculate stats
  const query = from('calls').select('*')

  if (buyerId) {
    // Using buyer_campaign_id as proxy for buyer association
    query.eq('buyer_campaign_id', buyerId)
  }

  const { data: calls, error } = await query

  if (error) {
    throw new Error(`Failed to fetch buyer stats: ${error.message}`)
  }

  if (!calls || calls.length === 0) {
    return []
  }

  // Group calls by buyer
  const statsMap = new Map<string, BuyerStats>()
  
  calls.forEach(call => {
    const id = call.buyer_campaign_id || 'unknown'
    if (!statsMap.has(id)) {
      statsMap.set(id, {
        buyer_id: id,
        total_calls: 0,
        total_spend: 0,
        average_cpa: 0,
        conversion_rate: 0,
      })
    }
    
    const stats = statsMap.get(id)!
    stats.total_calls++
    stats.total_spend += call.payout_amount || 0
  })

  // Calculate averages
  return Array.from(statsMap.values()).map(stats => ({
    ...stats,
    average_cpa: stats.total_calls > 0 ? stats.total_spend / stats.total_calls : 0,
    conversion_rate: 0.7, // Placeholder conversion rate
  }))
}

/**
 * Get campaign performance data calculated from campaigns and calls tables
 * @param filters - Optional filters for campaign performance
 * @returns Array of campaign performance data
 */
export async function getCampaignPerformance(filters?: {
  campaignId?: string
  supplierId?: string
  status?: string
}): Promise<CampaignPerformance[]> {
  // Query campaigns table
  const campaignQuery = from('campaigns').select('*')

  if (filters?.campaignId) {
    campaignQuery.eq('id', filters.campaignId)
  }

  if (filters?.status) {
    campaignQuery.eq('status', filters.status as Database['public']['Enums']['campaign_status'])
  }

  const { data: campaigns, error: campaignError } = await campaignQuery

  if (campaignError) {
    throw new Error(`Failed to fetch campaigns: ${campaignError.message}`)
  }

  if (!campaigns || campaigns.length === 0) {
    return []
  }

  // Get calls for these campaigns
  const campaignIds = campaigns.map(c => c.id)
  const { data: calls, error: callsError } = await from('calls')
    .select('*')
    .in('campaign_id', campaignIds)

  if (callsError) {
    throw new Error(`Failed to fetch calls: ${callsError.message}`)
  }

  // Calculate performance metrics
  return campaigns.map(campaign => {
    const campaignCalls = calls?.filter(c => c.campaign_id === campaign.id) || []
    
    return {
      campaign_id: campaign.id,
      supplier_id: campaign.supplier_id || 'unknown',
      buyer_id: 'unknown', // campaigns table doesn't have buyer_id
      status: campaign.status || 'unknown',
      total_calls: campaignCalls.length,
      total_minutes: campaignCalls.reduce((sum, call) => sum + (call.duration_seconds || 0) / 60, 0),
      total_cost: campaignCalls.reduce((sum, call) => sum + (call.payout_amount || 0), 0),
      conversion_rate: 0.7, // Placeholder
    }
  })
}

/**
 * Database RPC Functions
 */

/**
 * Get user statistics including calls, minutes, revenue, and average call duration
 * @param userId - The user ID to get stats for
 * @returns User statistics object
 */
export async function getUserStats(userId: string): Promise<{
  total_calls: number
  total_minutes: number
  total_revenue: number
  average_call_duration: number
}> {
  // Since get_user_stats RPC doesn't exist, calculate from calls table
  const { data: calls, error } = await from('calls')
    .select('*')
    .or(`campaign_id.eq.${userId},buyer_campaign_id.eq.${userId}`)

  if (error) {
    throw new Error(`Failed to get user stats: ${error.message}`)
  }

  const stats = {
    total_calls: calls?.length || 0,
    total_minutes: 0,
    total_revenue: 0,
    average_call_duration: 0,
  }

  if (calls && calls.length > 0) {
    stats.total_minutes = calls.reduce((sum, call) => sum + (call.duration_seconds || 0) / 60, 0)
    stats.total_revenue = calls.reduce((sum, call) => sum + (call.payout_amount || 0), 0)
    stats.average_call_duration = stats.total_minutes / stats.total_calls
  }

  return stats
}


// Billing functions removed - payment processing functionality is no longer available

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
}
