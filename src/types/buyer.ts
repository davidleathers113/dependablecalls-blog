
// Buyer-specific interfaces for marketplace and purchasing
export interface MarketplaceListing {
  id: string
  campaign_id: string
  supplier_id: string
  supplier_name: string
  vertical: string
  description: string
  price_per_call: number
  quality_score: number
  estimated_volume: number
  geographic_coverage: string[]
  availability_hours: {
    start: string
    end: string
    timezone: string
  }
  call_caps: {
    daily: number
    weekly: number
    monthly: number
  }
  filters: ListingFilters
  created_at: string
  updated_at: string
}

export interface ListingFilters {
  states?: string[]
  age_range?: [number, number]
  income_range?: [number, number]
  time_restrictions?: TimeRestriction[]
  lead_types?: string[]
  exclusions?: string[]
}

export interface TimeRestriction {
  day: string
  start_time: string
  end_time: string
}

export interface SearchFilters {
  vertical?: string
  min_quality_score?: number
  max_price?: number
  geographic_coverage?: string[]
  min_volume?: number
  availability_24_7?: boolean
  keywords?: string
}

export interface SavedSearch {
  id: string
  buyer_id: string
  name: string
  filters: SearchFilters
  alert_enabled: boolean
  last_results_count: number
  created_at: string
  updated_at: string
}

export interface PurchaseRequest {
  listing_id: string
  quantity: number
  budget_limit: number
  campaign_id: string
  start_date: string
  end_date?: string
  special_instructions?: string
}

export interface Purchase {
  id: string
  buyer_id: string
  supplier_id: string
  listing_id: string
  campaign_id: string
  quantity: number
  price_per_call: number
  total_amount: number
  status: PurchaseStatus
  start_date: string
  end_date?: string
  calls_received: number
  calls_converted: number
  roi_percentage: number
  special_instructions?: string
  created_at: string
  updated_at: string
}

export type PurchaseStatus = 
  | 'pending_approval'
  | 'approved'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'refunded'

export interface BuyerMetrics {
  total_spent: number
  total_calls: number
  total_conversions: number
  average_cost_per_call: number
  average_cost_per_acquisition: number
  conversion_rate: number
  roi_percentage: number
  active_campaigns: number
  top_performing_verticals: VerticalPerformance[]
}

export interface VerticalPerformance {
  vertical: string
  total_calls: number
  conversions: number
  conversion_rate: number
  cost_per_acquisition: number
  roi_percentage: number
}

export interface ROIAnalysis {
  timeframe: string
  investment: number
  revenue: number
  profit: number
  roi_percentage: number
  call_volume: number
  conversion_rate: number
  average_order_value: number
}

export interface ConversionMetrics {
  total_calls: number
  qualified_calls: number
  converted_calls: number
  qualification_rate: number
  conversion_rate: number
  average_call_duration: number
  peak_hours: Array<{ hour: number; call_count: number }>
  geographic_breakdown: Array<{ state: string; conversion_rate: number }>
}

export interface BudgetTracker {
  campaign_id: string
  campaign_name: string
  allocated_budget: number
  spent_budget: number
  remaining_budget: number
  daily_spend_rate: number
  projected_end_date: string
  budget_utilization: number
  days_remaining: number
  is_on_track: boolean
}

export interface BuyerDashboardData {
  metrics: BuyerMetrics
  recent_purchases: Purchase[]
  active_campaigns: Array<{
    id: string
    name: string
    status: string
    calls_today: number
    conversions_today: number
    spend_today: number
  }>
  budget_alerts: Array<{
    campaign_id: string
    campaign_name: string
    alert_type: 'overspend' | 'underspend' | 'depletion'
    severity: 'low' | 'medium' | 'high'
    message: string
  }>
  market_opportunities: MarketplaceListing[]
}

export interface PaymentMethod {
  id: string
  type: 'credit_card' | 'ach' | 'wire_transfer'
  last_four: string
  expiry_month?: number
  expiry_year?: number
  brand?: string
  is_default: boolean
  billing_address: {
    street: string
    city: string
    state: string
    zip: string
    country: string
  }
}

// Form types for validation schemas
export interface MarketplaceSearchForm {
  vertical?: string
  min_quality_score?: number
  max_price?: number
  geographic_coverage?: string[]
  min_volume?: number
  availability_24_7?: boolean
  keywords?: string
}

export interface PurchaseFlowForm {
  listing_id: string
  quantity: number
  budget_limit: number
  campaign_id: string
  start_date: string
  end_date?: string
  payment_method_id: string
  special_instructions?: string
  terms_accepted: boolean
}

export interface SavedSearchForm {
  name: string
  filters: SearchFilters
  alert_enabled: boolean
}

// Hook return types
export interface UseMarketplaceResult {
  listings: MarketplaceListing[]
  loading: boolean
  error: string | null
  searchListings: (filters: SearchFilters) => Promise<void>
  saveSearch: (search: SavedSearchForm) => Promise<void>
  savedSearches: SavedSearch[]
}

export interface UsePurchaseResult {
  purchases: Purchase[]
  loading: boolean
  error: string | null
  createPurchase: (request: PurchaseRequest) => Promise<Purchase>
  cancelPurchase: (purchaseId: string) => Promise<void>
  pausePurchase: (purchaseId: string) => Promise<void>
  resumePurchase: (purchaseId: string) => Promise<void>
}

export interface UseBuyerAnalyticsResult {
  metrics: BuyerMetrics | null
  roiAnalysis: ROIAnalysis[]
  conversionMetrics: ConversionMetrics | null
  budgetTrackers: BudgetTracker[]
  loading: boolean
  error: string | null
  refreshMetrics: () => Promise<void>
  exportData: (format: 'csv' | 'pdf') => Promise<void>
}