/**
 * Supplier Store Schema Definitions - Phase 3.1b
 * Versioned schemas for supplier state persistence
 */

import { z } from 'zod'
import { registerSchema } from './index'

// Availability hours schema
const AvailabilityHoursSchema = z.object({
  start: z.string(),
  end: z.string(),
  timezone: z.string(),
  days: z.array(z.string()),
})

// Filters schema
const FiltersSchema = z.object({
  lead_types: z.array(z.string()),
})

// Performance metrics schema
const PerformanceMetricsSchema = z.object({
  conversion_rate: z.number(),
  average_call_duration: z.number(),
  buyer_satisfaction: z.number(),
})

// Call listing schema
const CallListingSchema = z.object({
  id: z.string(),
  supplier_id: z.string(),
  vertical: z.string(),
  title: z.string(),
  description: z.string(),
  price_per_call: z.number(),
  quality_score: z.number(),
  geographic_coverage: z.array(z.string()),
  daily_cap: z.number(),
  weekly_cap: z.number(),
  monthly_cap: z.number(),
  availability_hours: AvailabilityHoursSchema,
  filters: FiltersSchema,
  performance_metrics: PerformanceMetricsSchema,
  status: z.enum(['active', 'paused', 'draft', 'archived']),
  created_at: z.string(),
  updated_at: z.string(),
})

// Inventory item schema
const InventoryItemSchema = z.object({
  id: z.string(),
  supplier_id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  quantity: z.number(),
  price: z.number(),
  status: z.enum(['available', 'reserved', 'sold']),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

// Volume metrics schema
const VolumeMetricsSchema = z.object({
  daily_average: z.number(),
  weekly_total: z.number(),
  monthly_total: z.number(),
})

// Lead source performance metrics schema
const LeadSourcePerformanceMetricsSchema = z.object({
  conversion_rate: z.number(),
  cost_per_acquisition: z.number(),
  roi_percentage: z.number(),
})

// Lead source schema
const LeadSourceSchema = z.object({
  id: z.string(),
  supplier_id: z.string(),
  name: z.string(),
  type: z.string(),
  url: z.string().optional(),
  description: z.string(),
  status: z.enum(['active', 'paused', 'inactive']),
  quality_score: z.number(),
  volume_metrics: VolumeMetricsSchema,
  performance_metrics: LeadSourcePerformanceMetricsSchema,
  created_at: z.string(),
  updated_at: z.string(),
})

// Quality factor schema
const QualityFactorSchema = z.object({
  factor: z.string(),
  weight: z.number(),
  score: z.number(),
  impact: z.enum(['positive', 'negative', 'neutral']),
  description: z.string(),
})

// Quality scores schema
const QualityScoresSchema = z.object({
  lead_quality: z.number(),
  call_duration: z.number(),
  buyer_satisfaction: z.number(),
  conversion_likelihood: z.number(),
  fraud_risk: z.number(),
})

// Quality scoring schema
const QualityScoringSchema = z.object({
  id: z.string(),
  lead_id: z.string(),
  call_id: z.string(),
  scores: QualityScoresSchema,
  factors: z.array(QualityFactorSchema),
  overall_score: z.number(),
  recommendations: z.array(z.string()),
  created_at: z.string(),
})

// Vertical performance schema
const VerticalPerformanceSchema = z.object({
  vertical: z.string(),
  revenue: z.number(),
  calls_sold: z.number(),
  average_price: z.number(),
  profit_margin: z.number(),
  growth_rate: z.number(),
})

// Monthly trend schema
const MonthlyTrendSchema = z.object({
  month: z.string(),
  revenue: z.number(),
  calls_sold: z.number(),
  new_buyers: z.number(),
  repeat_buyers: z.number(),
  average_order_size: z.number(),
})

// Quality trend schema
const QualityTrendSchema = z.object({
  period: z.string(),
  average_quality_score: z.number(),
  buyer_satisfaction: z.number(),
  conversion_rate: z.number(),
  fraud_incidents: z.number(),
})

// Sales metrics schema
const SalesMetricsSchema = z.object({
  total_revenue: z.number(),
  total_calls_sold: z.number(),
  average_price_per_call: z.number(),
  conversion_rate: z.number(),
  top_performing_verticals: z.array(VerticalPerformanceSchema),
  monthly_trends: z.array(MonthlyTrendSchema),
  buyer_analytics: z.array(z.unknown()),
  quality_trends: z.array(QualityTrendSchema),
})

// Sale schema
const SaleSchema = z.object({
  id: z.string(),
  buyer_id: z.string(),
  buyer_name: z.string(),
  listing_id: z.string(),
  vertical: z.string(),
  quantity: z.number(),
  price_per_call: z.number(),
  total_amount: z.number(),
  commission_amount: z.number(),
  net_amount: z.number(),
  status: z.enum(['pending', 'delivering', 'completed', 'disputed']),
  created_at: z.string(),
  delivered_at: z.string().optional(),
})

// Inventory status schema
const InventoryStatusSchema = z.object({
  total_listings: z.number(),
  active_listings: z.number(),
  total_daily_capacity: z.number(),
  allocated_capacity: z.number(),
  available_capacity: z.number(),
  utilization_rate: z.number(),
  forecast_demand: z.array(z.unknown()),
})

// Supplier dashboard data schema
const SupplierDashboardDataSchema = z.object({
  metrics: SalesMetricsSchema,
  recent_sales: z.array(SaleSchema),
  active_listings: z.array(CallListingSchema),
  performance_alerts: z.array(z.unknown()),
  top_buyers: z.array(z.unknown()),
  inventory_status: InventoryStatusSchema,
})

// Full supplier state schema
const SupplierStateSchema = z.object({
  // Inventory state
  listings: z.array(CallListingSchema),
  inventory: z.array(InventoryItemSchema),
  
  // Sales state
  metrics: SalesMetricsSchema.nullable(),
  sales: z.array(SaleSchema),
  
  // Lead management state
  leadSources: z.array(LeadSourceSchema),
  qualityScoring: z.array(QualityScoringSchema),
  
  // Dashboard state
  dashboardData: SupplierDashboardDataSchema.nullable(),
  
  // UI state
  loading: z.boolean(),
  error: z.string().nullable(),
})

// Persisted supplier data schema (subset of full state)
const SupplierPersistedSchema = z.object({
  listings: z.array(CallListingSchema),
  leadSources: z.array(LeadSourceSchema),
})

// Register version 1 of supplier store schema
registerSchema(
  'supplier-store',
  1,
  SupplierPersistedSchema,
  {
    createdAt: new Date().toISOString(),
    description: 'Initial supplier store schema - persists listings and lead sources',
    isBreaking: false,
  },
  ['listings', 'leadSources']
)

// Export schemas
export {
  AvailabilityHoursSchema,
  FiltersSchema,
  PerformanceMetricsSchema,
  CallListingSchema,
  InventoryItemSchema,
  VolumeMetricsSchema,
  LeadSourcePerformanceMetricsSchema,
  LeadSourceSchema,
  QualityFactorSchema,
  QualityScoresSchema,
  QualityScoringSchema,
  VerticalPerformanceSchema,
  MonthlyTrendSchema,
  QualityTrendSchema,
  SalesMetricsSchema,
  SaleSchema,
  InventoryStatusSchema,
  SupplierDashboardDataSchema,
  SupplierStateSchema,
  SupplierPersistedSchema,
}

// Export types
export type AvailabilityHours = z.infer<typeof AvailabilityHoursSchema>
export type Filters = z.infer<typeof FiltersSchema>
export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>
export type CallListing = z.infer<typeof CallListingSchema>
export type InventoryItem = z.infer<typeof InventoryItemSchema>
export type VolumeMetrics = z.infer<typeof VolumeMetricsSchema>
export type LeadSourcePerformanceMetrics = z.infer<typeof LeadSourcePerformanceMetricsSchema>
export type LeadSource = z.infer<typeof LeadSourceSchema>
export type QualityFactor = z.infer<typeof QualityFactorSchema>
export type QualityScores = z.infer<typeof QualityScoresSchema>
export type QualityScoring = z.infer<typeof QualityScoringSchema>
export type VerticalPerformance = z.infer<typeof VerticalPerformanceSchema>
export type MonthlyTrend = z.infer<typeof MonthlyTrendSchema>
export type QualityTrend = z.infer<typeof QualityTrendSchema>
export type SalesMetrics = z.infer<typeof SalesMetricsSchema>
export type Sale = z.infer<typeof SaleSchema>
export type InventoryStatus = z.infer<typeof InventoryStatusSchema>
export type SupplierDashboardData = z.infer<typeof SupplierDashboardDataSchema>
export type SupplierState = z.infer<typeof SupplierStateSchema>
export type SupplierPersisted = z.infer<typeof SupplierPersistedSchema>