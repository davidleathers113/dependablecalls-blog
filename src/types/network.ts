// Extended network interface with computed properties
export interface Network {
  id: string
  user_id: string
  company_name: string

  // Buyer-side properties
  buyer_id?: string
  buyer_status: 'pending' | 'active' | 'suspended' | 'banned'
  credit_limit: number
  current_balance: number

  // Supplier-side properties
  supplier_id?: string
  supplier_status: 'pending' | 'active' | 'suspended' | 'banned'
  credit_balance: number

  // Network-specific properties
  margin_percentage: number
  routing_rules: RoutingRule[]
  quality_thresholds: QualityThresholds
  approved_suppliers: string[]
  approved_buyers: string[]
  settings: NetworkSettings

  // Timestamps
  created_at: string
  updated_at: string
}

// Routing rules for network call distribution
export interface RoutingRule {
  id: string
  name: string
  priority: number
  conditions: RoutingCondition[]
  actions: RoutingAction[]
  enabled: boolean
}

export interface RoutingCondition {
  field: 'geography' | 'time' | 'quality' | 'volume' | 'buyer_type'
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between'
  value: unknown
}

export interface RoutingAction {
  type: 'route_to_buyer' | 'apply_margin' | 'reject' | 'hold'
  params: Record<string, unknown>
}

// Quality thresholds for accepting calls
export interface QualityThresholds {
  minimum_duration: number
  maximum_duration: number
  required_fields: string[]
  blocked_numbers: string[]
  allowed_states: string[]
  business_hours: BusinessHours
}

export interface BusinessHours {
  timezone: string
  schedule: {
    [day: string]: {
      open: string
      close: string
      enabled: boolean
    }
  }
}

// Network-specific settings
export interface NetworkSettings {
  auto_accept_calls: boolean
  auto_route_calls: boolean
  margin_type: 'percentage' | 'fixed'
  minimum_margin: number
  payment_terms: number // days
  notifications: NotificationSettings
}

export interface NotificationSettings {
  email_alerts: boolean
  sms_alerts: boolean
  webhook_url?: string
  alert_thresholds: {
    low_margin: number
    high_rejection_rate: number
    low_quality_score: number
  }
}

// Network performance metrics
export interface NetworkMetrics {
  network_id: string
  date: string

  // Buy-side metrics
  calls_purchased: number
  total_cost: number
  average_cost_per_call: number

  // Sell-side metrics
  calls_sold: number
  total_revenue: number
  average_revenue_per_call: number

  // Network metrics
  gross_margin: number
  net_margin: number
  rejection_rate: number
  quality_score: number
}

// Network campaign (bridges supplier campaigns to buyer campaigns)
export interface NetworkCampaign {
  id: string
  network_id: string
  name: string
  status: 'active' | 'paused' | 'completed'

  // Source configuration
  supplier_campaigns: string[]
  source_filters: CampaignFilter[]

  // Target configuration
  buyer_campaigns: string[]
  distribution_rules: DistributionRule[]

  // Pricing
  margin_override?: number
  floor_price: number
  ceiling_price: number

  // Limits
  daily_cap?: number
  total_cap?: number
  current_count: number
}

export interface CampaignFilter {
  field: string
  operator: string
  value: unknown
}

export interface DistributionRule {
  buyer_campaign_id: string
  percentage: number
  priority: number
  conditions?: RoutingCondition[]
}

// Network relationship management
export interface NetworkRelationship {
  id: string
  network_id: string
  entity_id: string
  entity_type: 'supplier' | 'buyer'
  status: 'pending' | 'active' | 'suspended' | 'terminated'
  custom_terms?: {
    margin_override?: number
    payment_terms?: number
    quality_requirements?: Partial<QualityThresholds>
  }
  notes: string
  created_at: string
  updated_at: string
}

// Type guards
export function isNetworkUser(user: unknown): user is { userType: 'network' } {
  return (
    typeof user === 'object' && user !== null && 'userType' in user && user.userType === 'network'
  )
}

export function hasNetworkAccess(user: unknown): boolean {
  return (
    isNetworkUser(user) ||
    (typeof user === 'object' && user !== null && 'userType' in user && user.userType === 'admin')
  )
}
