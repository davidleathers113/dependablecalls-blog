// Supplier-specific interfaces for inventory management and sales analytics
export interface CallListing {
  id: string
  supplier_id: string
  vertical: string
  title: string
  description: string
  price_per_call: number
  quality_score: number
  geographic_coverage: string[]
  daily_cap: number
  weekly_cap: number
  monthly_cap: number
  availability_hours: {
    start: string
    end: string
    timezone: string
    days: string[]
  }
  filters: ListingFilters
  performance_metrics: {
    conversion_rate: number
    average_call_duration: number
    buyer_satisfaction: number
  }
  status: ListingStatus
  created_at: string
  updated_at: string
}

export interface ListingFilters {
  states?: string[]
  age_range?: [number, number]
  income_range?: [number, number]
  lead_types: string[]
  exclusions?: string[]
  time_restrictions?: TimeRestriction[]
}

export interface TimeRestriction {
  day: string
  start_time: string
  end_time: string
}

export type ListingStatus = 'draft' | 'active' | 'paused' | 'archived'

export interface PricingStrategy {
  id: string
  listing_id: string
  strategy_type: 'fixed' | 'dynamic' | 'auction' | 'tiered'
  base_price: number
  pricing_rules: PricingRule[]
  performance_adjustments: {
    quality_bonus: number
    volume_discount: number
    loyalty_discount: number
  }
  created_at: string
  updated_at: string
}

export interface PricingRule {
  condition: 'time_of_day' | 'day_of_week' | 'volume' | 'quality_score'
  operator: 'gt' | 'lt' | 'eq' | 'between'
  value: number | [number, number] | string
  price_adjustment: number
  adjustment_type: 'percentage' | 'fixed'
}

export interface InventoryItem {
  id: string
  listing_id: string
  date: string
  available_volume: number
  allocated_volume: number
  sold_volume: number
  price_per_call: number
  performance_score: number
  buyer_assignments: BuyerAssignment[]
}

export interface BuyerAssignment {
  buyer_id: string
  buyer_name: string
  allocated_volume: number
  consumed_volume: number
  conversion_rate: number
  average_call_quality: number
}

export interface LeadSource {
  id: string
  supplier_id: string
  name: string
  type: 'website' | 'phone' | 'social' | 'partner' | 'referral'
  url?: string
  phone_number?: string
  cost_per_lead: number
  quality_score: number
  volume_metrics: {
    daily_average: number
    weekly_total: number
    monthly_total: number
  }
  performance_metrics: {
    conversion_rate: number
    cost_per_acquisition: number
    roi_percentage: number
  }
  status: 'active' | 'paused' | 'testing'
  created_at: string
  updated_at: string
}

export interface QualityScoring {
  id: string
  lead_id: string
  call_id: string
  scores: {
    lead_quality: number
    call_duration: number
    buyer_satisfaction: number
    conversion_likelihood: number
    fraud_risk: number
  }
  factors: QualityFactor[]
  overall_score: number
  recommendations: string[]
  created_at: string
}

export interface QualityFactor {
  factor: string
  weight: number
  score: number
  impact: 'positive' | 'negative' | 'neutral'
  description: string
}

export interface SalesMetrics {
  total_revenue: number
  total_calls_sold: number
  average_price_per_call: number
  conversion_rate: number
  top_performing_verticals: VerticalPerformance[]
  monthly_trends: MonthlyTrend[]
  buyer_analytics: BuyerAnalytics[]
  quality_trends: QualityTrend[]
}

export interface VerticalPerformance {
  vertical: string
  revenue: number
  calls_sold: number
  average_price: number
  profit_margin: number
  growth_rate: number
}

export interface MonthlyTrend {
  month: string
  revenue: number
  calls_sold: number
  new_buyers: number
  repeat_buyers: number
  average_order_size: number
}

export interface BuyerAnalytics {
  buyer_id: string
  buyer_name: string
  total_purchases: number
  total_revenue: number
  average_order_size: number
  conversion_rate: number
  satisfaction_score: number
  last_purchase_date: string
  relationship_score: number
}

export interface QualityTrend {
  period: string
  average_quality_score: number
  buyer_satisfaction: number
  conversion_rate: number
  fraud_incidents: number
}

export interface SupplierDashboardData {
  metrics: SalesMetrics
  recent_sales: Sale[]
  active_listings: CallListing[]
  performance_alerts: Alert[]
  top_buyers: BuyerAnalytics[]
  inventory_status: InventoryStatus
}

export interface Sale {
  id: string
  buyer_id: string
  buyer_name: string
  listing_id: string
  vertical: string
  quantity: number
  price_per_call: number
  total_amount: number
  commission_amount: number
  net_amount: number
  status: SaleStatus
  created_at: string
  delivered_at?: string
}

export type SaleStatus = 'pending' | 'delivering' | 'delivered' | 'completed' | 'disputed'

export interface Alert {
  id: string
  type: 'inventory_low' | 'quality_drop' | 'price_competition' | 'buyer_complaint'
  severity: 'low' | 'medium' | 'high'
  title: string
  message: string
  action_required: boolean
  created_at: string
  resolved_at?: string
}

export interface InventoryStatus {
  total_listings: number
  active_listings: number
  total_daily_capacity: number
  allocated_capacity: number
  available_capacity: number
  utilization_rate: number
  forecast_demand: ForecastDemand[]
}

export interface ForecastDemand {
  date: string
  predicted_volume: number
  confidence_level: number
  factors: string[]
}

export interface BulkUploadResult {
  total_processed: number
  successful_uploads: number
  failed_uploads: number
  errors: BulkUploadError[]
  created_listings: string[]
}

export interface BulkUploadError {
  row: number
  field: string
  message: string
  value: string
}

// Form types
export interface CallListingForm {
  vertical: string
  title: string
  description: string
  price_per_call: number
  geographic_coverage: string[]
  daily_cap: number
  weekly_cap: number
  monthly_cap: number
  availability_hours: {
    start: string
    end: string
    timezone: string
    days: string[]
  }
  filters: ListingFilters
  status: ListingStatus
}

export interface LeadSourceForm {
  name: string
  type: 'website' | 'phone' | 'social' | 'partner' | 'referral'
  url?: string
  phone_number?: string
  cost_per_lead: number
  status: 'active' | 'paused' | 'testing'
}

export interface PricingStrategyForm {
  strategy_type: 'fixed' | 'dynamic' | 'auction' | 'tiered'
  base_price: number
  pricing_rules: PricingRule[]
  performance_adjustments: {
    quality_bonus: number
    volume_discount: number
    loyalty_discount: number
  }
}

// Hook return types
export interface UseInventoryResult {
  listings: CallListing[]
  inventory: InventoryItem[]
  loading: boolean
  error: string | null
  createListing: (listing: CallListingForm) => Promise<CallListing>
  updateListing: (id: string, updates: Partial<CallListingForm>) => Promise<void>
  deleteListing: (id: string) => Promise<void>
  bulkUpload: (file: File) => Promise<BulkUploadResult>
  updatePricing: (listingId: string, strategy: PricingStrategyForm) => Promise<void>
  refreshInventory: () => Promise<void>
}

export interface UseSalesDataResult {
  metrics: SalesMetrics | null
  sales: Sale[]
  loading: boolean
  error: string | null
  refreshMetrics: () => Promise<void>
  exportSalesData: (format: 'csv' | 'pdf', timeframe: string) => Promise<void>
  getDetailedBuyerAnalytics: (buyerId: string) => Promise<BuyerAnalytics>
}

export interface UseLeadManagementResult {
  leadSources: LeadSource[]
  qualityScoring: QualityScoring[]
  loading: boolean
  error: string | null
  createLeadSource: (source: LeadSourceForm) => Promise<LeadSource>
  updateLeadSource: (id: string, updates: Partial<LeadSourceForm>) => Promise<void>
  deleteLeadSource: (id: string) => Promise<void>
  analyzeLeadQuality: (leadId: string) => Promise<QualityScoring>
  refreshLeadSources: () => Promise<void>
}