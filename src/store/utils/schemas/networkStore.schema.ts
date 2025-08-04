/**
 * Network Store Schema Definitions - Phase 3.1b
 * Versioned schemas for network state (NO PERSISTENCE - session only)
 */

import { z } from 'zod'
import { registerSchema } from './index'

// Quality thresholds schema
const QualityThresholdsSchema = z.object({
  minimum_duration: z.number(),
  maximum_duration: z.number(),
  required_fields: z.array(z.string()),
  blocked_numbers: z.array(z.string()),
  allowed_states: z.array(z.string()),
  business_hours: z.object({
    timezone: z.string(),
    schedule: z.record(z.unknown()),
  }),
})

// Network configuration schema
const NetworkConfigSchema = z.object({
  auto_accept_calls: z.boolean(),
  auto_route_calls: z.boolean(),
  margin_type: z.enum(['percentage', 'fixed']),
  minimum_margin: z.number(),
  payment_terms: z.number(),
  notifications: z.object({
    email_alerts: z.boolean(),
    sms_alerts: z.boolean(),
    webhook_url: z.string().optional(),
    alert_thresholds: z.object({
      low_margin: z.number(),
      high_rejection_rate: z.number(),
      low_quality_score: z.number(),
    }),
  }),
})

// Network schema
const NetworkSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  company_name: z.string(),
  buyer_status: z.enum(['active', 'inactive', 'suspended']),
  credit_limit: z.number(),
  current_balance: z.number(),
  supplier_status: z.enum(['active', 'inactive', 'suspended']),
  credit_balance: z.number(),
  margin_percentage: z.number(),
  routing_rules: z.array(z.unknown()),
  quality_thresholds: QualityThresholdsSchema,
  approved_suppliers: z.array(z.string()),
  approved_buyers: z.array(z.string()),
  settings: NetworkConfigSchema,
  created_at: z.string(),
  updated_at: z.string(),
})

// Network campaign schema
const NetworkCampaignSchema = z.object({
  id: z.string(),
  network_id: z.string(),
  name: z.string(),
  status: z.enum(['active', 'inactive', 'paused']),
  supplier_campaigns: z.array(z.unknown()),
  source_filters: z.array(z.unknown()),
  buyer_campaigns: z.array(z.unknown()),
  distribution_rules: z.array(z.unknown()),
  floor_price: z.number(),
  ceiling_price: z.number(),
  current_count: z.number(),
})

// Network relationship schema
const NetworkRelationshipSchema = z.object({
  id: z.string(),
  network_id: z.string(),
  entity_id: z.string(),
  entity_type: z.enum(['supplier', 'buyer']),
  status: z.enum(['active', 'inactive', 'pending']),
  notes: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})

// Network metrics schema
const NetworkMetricsSchema = z.object({
  network_id: z.string(),
  date: z.string(),
  calls_purchased: z.number(),
  total_cost: z.number(),
  average_cost_per_call: z.number(),
  calls_sold: z.number(),
  total_revenue: z.number(),
  average_revenue_per_call: z.number(),
  gross_margin: z.number(),
  net_margin: z.number(),
  rejection_rate: z.number(),
  quality_score: z.number(),
})

// Full network state schema
const NetworkStateSchema = z.object({
  // Core network data
  network: NetworkSchema.nullable(),
  campaigns: z.array(NetworkCampaignSchema),
  relationships: z.array(NetworkRelationshipSchema),
  metrics: NetworkMetricsSchema.nullable(),

  // UI state
  isLoading: z.boolean(),
  error: z.string().nullable(),
  selectedMode: z.enum(['network', 'supplier', 'buyer']),
})

// NOTE: Network store has NO PERSISTENCE - all data is session-only
// This is intentional as network data is fetched from server and not persisted locally
// However, we still register an empty schema for consistency and future extensibility

const NetworkPersistedSchema = z.object({
  // No fields persisted - network store is session-only
})

// Register version 1 of network store schema (empty persistence)
registerSchema(
  'network-store',
  1,
  NetworkPersistedSchema,
  {
    createdAt: new Date().toISOString(),
    description: 'Network store schema - NO PERSISTENCE (session-only data)',
    isBreaking: false,
  },
  [] // No fields are persisted
)

// Export schemas
export {
  QualityThresholdsSchema,
  NetworkConfigSchema,
  NetworkSchema,
  NetworkCampaignSchema,
  NetworkRelationshipSchema,
  NetworkMetricsSchema,
  NetworkStateSchema,
  NetworkPersistedSchema,
}

// Export types
export type QualityThresholds = z.infer<typeof QualityThresholdsSchema>
export type NetworkConfig = z.infer<typeof NetworkConfigSchema>
export type Network = z.infer<typeof NetworkSchema>
export type NetworkCampaign = z.infer<typeof NetworkCampaignSchema>
export type NetworkRelationship = z.infer<typeof NetworkRelationshipSchema>
export type NetworkMetrics = z.infer<typeof NetworkMetricsSchema>
export type NetworkState = z.infer<typeof NetworkStateSchema>
export type NetworkPersisted = z.infer<typeof NetworkPersistedSchema>