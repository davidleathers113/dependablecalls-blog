/**
 * Buyer Store Schema Definitions - Phase 3.1b
 * Versioned schemas for buyer state persistence
 */

import { z } from 'zod'
import { registerSchema } from './index'

// Campaign schema (from database type)
const CampaignSchema = z.object({
  id: z.string(),
  buyer_id: z.string(),
  name: z.string(),
  status: z.string(),
  budget: z.number().nullable(),
  daily_budget: z.number().nullable(),
  bid_price: z.number().nullable(),
  target_cpl: z.number().nullable(),
  vertical: z.string().nullable(),
  geo_targeting: z.unknown().nullable(), // JSON field
  demographic_targeting: z.unknown().nullable(), // JSON field
  schedule: z.unknown().nullable(), // JSON field
  quality_filters: z.unknown().nullable(), // JSON field
  conversion_tracking: z.unknown().nullable(), // JSON field
  created_at: z.string(),
  updated_at: z.string().nullable(),
  is_active: z.boolean().nullable(),
  priority: z.number().min(0).int(),
})

// Saved search schema
const SavedSearchSchema = z.object({
  id: z.string(),
  buyer_id: z.string(),
  name: z.string(),
  filters: z.record(z.unknown()), // SearchFilters as record
  alert_enabled: z.boolean(),
  last_results_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
})

// Search filters schema
const SearchFiltersSchema = z.record(z.unknown())

// Marketplace listing schema
const MarketplaceListingSchema = z.object({
  id: z.string(),
  campaign_id: z.string(),
  supplier_id: z.string(),
  supplier_name: z.string(),
  vertical: z.string(),
  description: z.string(),
  price_per_call: z.number(),
  quality_score: z.number(),
  estimated_volume: z.number(),
  geographic_coverage: z.array(z.string()),
  availability_hours: z.object({
    start: z.string(),
    end: z.string(),
    timezone: z.string(),
  }),
  call_caps: z.object({
    daily: z.number(),
    weekly: z.number(),
    monthly: z.number(),
  }),
  filters: z.object({
    states: z.array(z.string()),
    age_range: z.tuple([z.number(), z.number()]),
    income_range: z.tuple([z.number(), z.number()]),
  }),
  created_at: z.string(),
  updated_at: z.string(),
})

// Purchase schema
const PurchaseSchema = z.object({
  id: z.string(),
  buyer_id: z.string(),
  supplier_id: z.string(),
  listing_id: z.string(),
  campaign_id: z.string(),
  quantity: z.number(),
  price_per_call: z.number(),
  total_amount: z.number(),
  status: z.enum(['pending_approval', 'approved', 'active', 'paused', 'cancelled', 'completed']),
  start_date: z.string(),
  end_date: z.string(),
  calls_received: z.number(),
  calls_converted: z.number(),
  roi_percentage: z.number(),
  special_instructions: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

// Buyer metrics schema
const BuyerMetricsSchema = z.object({
  total_spent: z.number(),
  total_calls: z.number(),
  total_conversions: z.number(),
  average_cost_per_call: z.number(),
  average_cost_per_acquisition: z.number(),
  conversion_rate: z.number(),
  roi_percentage: z.number(),
  active_campaigns: z.number(),
  top_performing_verticals: z.array(z.unknown()),
})

// Dashboard data schema
const BuyerDashboardDataSchema = z.object({
  metrics: BuyerMetricsSchema,
  recent_purchases: z.array(PurchaseSchema),
  active_campaigns: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      status: z.string(),
      calls_today: z.number(),
      conversions_today: z.number(),
      spend_today: z.number(),
    })
  ),
  budget_alerts: z.array(z.unknown()),
  market_opportunities: z.array(z.unknown()),
})

// Full buyer state schema
const BuyerStateSchema = z.object({
  // Financial data
  currentBalance: z.number(),
  creditLimit: z.number(),

  // Campaign data
  campaigns: z.array(CampaignSchema),

  // Marketplace data
  listings: z.array(MarketplaceListingSchema),
  searchFilters: SearchFiltersSchema,
  savedSearches: z.array(SavedSearchSchema),

  // Purchase data
  purchases: z.array(PurchaseSchema),
  activePurchases: z.array(PurchaseSchema),

  // Analytics data
  metrics: BuyerMetricsSchema.nullable(),
  dashboardData: BuyerDashboardDataSchema.nullable(),

  // UI state
  isLoading: z.boolean(),
  error: z.string().nullable(),
})

// Persisted buyer data schema (subset of full state - SECURITY CRITICAL)
// WARNING: This currently persists financial data - needs encryption in Phase 3.1c
const BuyerPersistedSchema = z.object({
  currentBalance: z.number(),
  creditLimit: z.number(),
  campaigns: z.array(CampaignSchema),
  savedSearches: z.array(SavedSearchSchema),
})

// Register version 1 of buyer store schema
registerSchema(
  'buyer-store',
  1,
  BuyerPersistedSchema,
  {
    createdAt: new Date().toISOString(),
    description: 'Initial buyer store schema - includes financial data (REQUIRES ENCRYPTION)',
    isBreaking: false,
  },
  ['currentBalance', 'creditLimit', 'campaigns', 'savedSearches']
)

// Export schemas
export {
  CampaignSchema,
  SavedSearchSchema,
  SearchFiltersSchema,
  MarketplaceListingSchema,
  PurchaseSchema,
  BuyerMetricsSchema,
  BuyerDashboardDataSchema,
  BuyerStateSchema,
  BuyerPersistedSchema,
}

// Export types with proper required fields
export type Campaign = z.infer<typeof CampaignSchema>
export type SavedSearch = z.infer<typeof SavedSearchSchema>
export type SearchFilters = z.infer<typeof SearchFiltersSchema>
export type MarketplaceListing = z.infer<typeof MarketplaceListingSchema>
export type Purchase = z.infer<typeof PurchaseSchema>
export type BuyerMetrics = z.infer<typeof BuyerMetricsSchema>
export type BuyerDashboardData = z.infer<typeof BuyerDashboardDataSchema>
export type BuyerState = z.infer<typeof BuyerStateSchema>
export type BuyerPersisted = z.infer<typeof BuyerPersistedSchema>
