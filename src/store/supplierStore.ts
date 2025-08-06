/**
 * Supplier Store - Migrated to Standard Store Factory
 * 
 * This is the migrated version of supplierStore using the unified mutator chain.
 * It maintains backward compatibility while fixing TypeScript issues and 
 * improving security by never persisting financial data.
 * 
 * Key Security Features:
 * - Financial data (metrics, sales) is NEVER persisted
 * - Uses encrypted storage for business data
 * - Maintains compliance and fraud prevention features
 * - Preserves AI insights and optimization settings
 * - Abstracts Supabase calls for future service layer migration
 */

import { createStandardStore } from './factories/createStandardStore'
import type { StandardStateCreator } from './types/mutators'
import { from, getSession } from '../lib/supabase-optimized'
import { StorageFactory } from './utils/storage/encryptedStorage'
import { DataClassification, StorageType } from './utils/dataClassification'
import { createJSONStorage } from 'zustand/middleware'
import { settingsToJson } from './types/enhanced'
import type {
  CallListing,
  InventoryItem,
  LeadSource,
  SalesMetrics,
  SupplierDashboardData,
  Sale,
  CallListingForm,
  LeadSourceForm,
  PricingStrategyForm,
  BulkUploadResult,
  QualityScoring,
  ListingStatus,
  SaleStatus,
} from '../types/supplier'
import type { Database } from '../types/database-extended'

// Enhanced types with compliance and AI features from migrations
interface EnhancedCallListing extends CallListing {
  _analytics?: {
    conversionRate: number
    averageCallDuration: number
    qualityTrend: 'improving' | 'stable' | 'declining'
    lastOptimized?: string
  }
  _testing?: {
    variants: Array<{
      id: string
      name: string
      trafficSplit: number
      isActive: boolean
    }>
    currentVariant?: string
  }
  _compliance?: {
    tcpaCompliant: boolean
    dncScrubbed: boolean
    lastComplianceCheck?: string
    complianceNotes?: string
  }
  _aiInsights?: {
    performancePrediction?: number
    optimizationSuggestions: string[]
    marketTrends: Array<{
      trend: string
      impact: 'positive' | 'negative' | 'neutral'
      confidence: number
    }>
    lastAnalysis?: string
  }
}

interface EnhancedLeadSource extends LeadSource {
  _attribution?: {
    utmParameters: Record<string, string>
    referrerDomain?: string
    firstTouchDate?: string
    touchpointCount: number
  }
  _qualityHistory?: Array<{
    date: string
    score: number
    factors: string[]
    notes?: string
  }>
  _fraudPrevention?: {
    riskScore: number
    lastFraudCheck?: string
    flaggedReasons: string[]
    whiteListed: boolean
    quarantined: boolean
  }
  _predictiveAnalytics?: {
    expectedVolume?: number
    qualityForecast?: number
    seasonalityFactors: Array<{
      period: string
      multiplier: number
    }>
    lastPrediction?: string
  }
}

// Compliance tracking from migrations
interface SupplierCompliance {
  tcpaConsent: boolean
  dncListProvider?: string
  lastAuditDate?: string
  certifications: string[]
  complianceContact?: string
}

// Performance optimization settings from migrations
interface OptimizationSettings {
  autoOptimizationEnabled: boolean
  optimizationGoals: Array<'volume' | 'quality' | 'revenue' | 'compliance'>
  lastOptimizationRun?: string
  optimizationHistory: Array<{
    date: string
    changes: string[]
    impact: {
      volumeChange: number
      qualityChange: number
      revenueChange: number
    }
  }>
}

export interface SupplierState {
  // Inventory state - can be persisted
  listings: EnhancedCallListing[]
  inventory: InventoryItem[]
  leadSources: EnhancedLeadSource[]
  
  // Sales state - NEVER PERSISTED (contains financial data)
  metrics: SalesMetrics | null
  sales: Sale[]
  qualityScoring: QualityScoring[]
  dashboardData: SupplierDashboardData | null
  
  // UI state - not persisted
  loading: boolean
  error: string | null
  
  // Compliance and optimization - can be persisted
  _supplierCompliance?: SupplierCompliance
  _optimization?: OptimizationSettings
  
  // Actions - Setters
  setListings: (listings: EnhancedCallListing[]) => void
  setInventory: (inventory: InventoryItem[]) => void
  setMetrics: (metrics: SalesMetrics) => void
  setSales: (sales: Sale[]) => void
  setLeadSources: (leadSources: EnhancedLeadSource[]) => void
  setQualityScoring: (qualityScoring: QualityScoring[]) => void
  setDashboardData: (data: SupplierDashboardData) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  // Actions - Inventory management
  createListing: (listing: CallListingForm) => Promise<CallListing>
  updateListing: (id: string, updates: Partial<CallListingForm>) => Promise<void>
  deleteListing: (id: string) => Promise<void>
  bulkUpload: (file: File) => Promise<BulkUploadResult>
  updatePricing: (listingId: string, strategy: PricingStrategyForm) => Promise<void>
  fetchListings: () => Promise<void>
  fetchInventory: () => Promise<void>
  
  // Actions - Enhanced listing management
  updateListingAnalytics: (listingId: string, analytics: EnhancedCallListing['_analytics']) => void
  updateListingCompliance: (listingId: string, compliance: EnhancedCallListing['_compliance']) => void
  runAIOptimization: (listingId: string) => Promise<void>
  
  // Actions - Sales analytics (never persisted)
  fetchMetrics: () => Promise<void>
  fetchSales: () => Promise<void>
  exportSalesData: (format: 'csv' | 'pdf', timeframe: string) => Promise<void>
  
  // Actions - Lead management
  createLeadSource: (source: LeadSourceForm) => Promise<LeadSource>
  updateLeadSource: (id: string, updates: Partial<LeadSourceForm>) => Promise<void>
  deleteLeadSource: (id: string) => Promise<void>
  fetchLeadSources: () => Promise<void>
  analyzeLeadQuality: (leadId: string) => Promise<QualityScoring>
  
  // Actions - Enhanced lead source management
  updateLeadSourceAttribution: (sourceId: string, attribution: EnhancedLeadSource['_attribution']) => void
  updateFraudPrevention: (sourceId: string, fraudData: EnhancedLeadSource['_fraudPrevention']) => void
  runPredictiveAnalysis: (sourceId: string) => Promise<void>
  
  // Actions - Dashboard
  fetchDashboardData: () => Promise<void>
  
  // Actions - Compliance and optimization
  updateSupplierCompliance: (compliance: Partial<SupplierCompliance>) => void
  updateOptimizationSettings: (settings: Partial<OptimizationSettings>) => void
  runComplianceAudit: () => Promise<void>
  
  // Utility actions
  clearError: () => void
  reset: () => void
}

// Service layer abstraction helpers
const SupplierDataService = {
  async fetchCampaigns(userId: string) {
    const { data, error } = await from('campaigns')
      .select('*')
      .eq('supplier_id', userId)
    
    if (error) throw error
    return data || []
  },

  async createCampaign(campaignData: Database['public']['Tables']['campaigns']['Insert']) {
    const { data, error } = await from('campaigns')
      .insert(campaignData)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async updateCampaign(id: string, updates: Database['public']['Tables']['campaigns']['Update']) {
    const { error } = await from('campaigns')
      .update(updates)
      .eq('id', id)
    
    if (error) throw error
  },

  async deleteCampaign(id: string) {
    const { error } = await from('campaigns')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  },

  async fetchCallsWithCampaigns(userId: string) {
    const { data, error } = await from('calls')
      .select(`
        *,
        campaigns!campaign_id (name, vertical)
      `)
      .eq('campaigns.supplier_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  async generateMockMetrics(): Promise<SalesMetrics> {
    return {
      total_revenue: 15750.50,
      total_calls_sold: 245,
      average_price_per_call: 64.29,
      conversion_rate: 0.73,
      top_performing_verticals: [{
        vertical: 'insurance',
        revenue: 8500.25,
        calls_sold: 120,
        average_price: 70.84,
        profit_margin: 0.45,
        growth_rate: 0.15
      }],
      monthly_trends: [{
        month: '2024-01',
        revenue: 15750.50,
        calls_sold: 245,
        new_buyers: 8,
        repeat_buyers: 12,
        average_order_size: 64.29
      }],
      buyer_analytics: [],
      quality_trends: [{
        period: '2024-01',
        average_quality_score: 8.2,
        buyer_satisfaction: 4.1,
        conversion_rate: 0.73,
        fraud_incidents: 2
      }]
    }
  },

  mapCallStatusToSaleStatus(callStatus: Database['public']['Enums']['call_status'] | null): SaleStatus {
    switch (callStatus) {
      case 'initiated':
      case 'ringing':
        return 'pending'
      case 'connected':
        return 'delivering'
      case 'completed':
        return 'completed'
      case 'failed':
      case 'rejected':
        return 'disputed'
      default:
        return 'pending'
    }
  }
}

const initialState = {
  // Inventory state
  listings: [],
  inventory: [],
  leadSources: [],
  
  // Sales state - not persisted
  metrics: null,
  sales: [],
  qualityScoring: [],
  dashboardData: null,
  
  // UI state
  loading: false,
  error: null,
  
  // Compliance and optimization - default conservative settings
  _supplierCompliance: {
    tcpaConsent: false,
    dncListProvider: undefined,
    lastAuditDate: undefined,
    certifications: [],
    complianceContact: undefined,
  },
  _optimization: {
    autoOptimizationEnabled: false,
    optimizationGoals: ['quality'] as Array<'volume' | 'quality' | 'revenue' | 'compliance'>,
    lastOptimizationRun: undefined,
    optimizationHistory: [],
  },
}

// Helper function to add enhanced features to listings
const enhanceListing = (listing: CallListing): EnhancedCallListing => ({
  ...listing,
  _analytics: {
    conversionRate: 0,
    averageCallDuration: 0,
    qualityTrend: 'stable',
    lastOptimized: undefined,
  },
  _testing: {
    variants: [],
    currentVariant: undefined,
  },
  _compliance: {
    tcpaCompliant: true,
    dncScrubbed: false,
    lastComplianceCheck: undefined,
    complianceNotes: undefined,
  },
  _aiInsights: {
    performancePrediction: undefined,
    optimizationSuggestions: [],
    marketTrends: [],
    lastAnalysis: undefined,
  },
})

// Helper function to add enhanced features to lead sources
const enhanceLeadSource = (source: LeadSource): EnhancedLeadSource => ({
  ...source,
  _attribution: {
    utmParameters: {},
    referrerDomain: undefined,
    firstTouchDate: source.created_at,
    touchpointCount: 1,
  },
  _qualityHistory: [{
    date: new Date().toISOString(),
    score: source.quality_score,
    factors: ['initial_assessment'],
    notes: 'Initial quality score from migration',
  }],
  _fraudPrevention: {
    riskScore: 0,
    lastFraudCheck: undefined,
    flaggedReasons: [],
    whiteListed: false,
    quarantined: false,
  },
  _predictiveAnalytics: {
    expectedVolume: undefined,
    qualityForecast: undefined,
    seasonalityFactors: [],
    lastPrediction: undefined,
  },
})

// Create store state using Immer for immutable updates
const createSupplierState: StandardStateCreator<SupplierState> = (set, get) => ({
  ...initialState,

  // Simple setters with explicit parameter types
  setListings: (listings: EnhancedCallListing[]) => {
    set((state: SupplierState) => {
      state.listings = listings
    })
  },

  setInventory: (inventory: InventoryItem[]) => {
    set((state: SupplierState) => {
      state.inventory = inventory
    })
  },

  setMetrics: (metrics: SalesMetrics) => {
    set((state: SupplierState) => {
      state.metrics = metrics
    })
  },

  setSales: (sales: Sale[]) => {
    set((state: SupplierState) => {
      state.sales = sales
    })
  },

  setLeadSources: (leadSources: EnhancedLeadSource[]) => {
    set((state: SupplierState) => {
      state.leadSources = leadSources
    })
  },

  setQualityScoring: (qualityScoring: QualityScoring[]) => {
    set((state: SupplierState) => {
      state.qualityScoring = qualityScoring
    })
  },

  setDashboardData: (dashboardData: SupplierDashboardData) => {
    set((state: SupplierState) => {
      state.dashboardData = dashboardData
    })
  },

  setLoading: (loading: boolean) => {
    set((state: SupplierState) => {
      state.loading = loading
    })
  },

  setError: (error: string | null) => {
    set((state: SupplierState) => {
      state.error = error
    })
  },

  // Create listing
  createListing: async (listing: CallListingForm): Promise<CallListing> => {
    set((state: SupplierState) => {
      state.loading = true
      state.error = null
    })

    try {
      const { data: session } = await getSession()
      if (!session.session?.user) throw new Error('Not authenticated')

      const campaignStatus: Database['public']['Enums']['campaign_status'] = 
        listing.status === 'archived' ? 'completed' : 
        listing.status === 'draft' ? 'draft' :
        listing.status === 'active' ? 'active' :
        listing.status === 'paused' ? 'paused' : 'draft'

      const campaignData = {
        supplier_id: session.session.user.id,
        name: listing.title,
        description: listing.description,
        vertical: listing.vertical,
        bid_floor: listing.price_per_call,
        daily_cap: listing.daily_cap,
        monthly_cap: listing.monthly_cap,
        status: campaignStatus,
        schedule: settingsToJson({
          hours: listing.availability_hours,
          days: listing.availability_hours.days,
        }),
        targeting: settingsToJson({
          geographic_coverage: listing.geographic_coverage,
          filters: listing.filters,
        }),
      }

      const data = await SupplierDataService.createCampaign(campaignData)

      const newListing: CallListing = {
        id: data.id,
        supplier_id: data.supplier_id || session.session.user.id,
        vertical: data.vertical || listing.vertical,
        title: data.name,
        description: data.description || listing.description,
        price_per_call: data.bid_floor || listing.price_per_call,
        quality_score: data.quality_threshold || 85,
        geographic_coverage: listing.geographic_coverage,
        daily_cap: data.daily_cap || listing.daily_cap,
        weekly_cap: listing.weekly_cap,
        monthly_cap: data.monthly_cap || listing.monthly_cap,
        availability_hours: listing.availability_hours,
        filters: listing.filters,
        performance_metrics: {
          conversion_rate: 0,
          average_call_duration: 0,
          buyer_satisfaction: 0,
        },
        status: data.status === 'completed' ? 'archived' : (data.status as ListingStatus) || 'draft',
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString(),
      }

      const enhancedListing = enhanceListing(newListing)

      set((state: SupplierState) => {
        state.listings = [...state.listings, enhancedListing]
        state.loading = false
      })

      return newListing
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create listing'
      set((state: SupplierState) => {
        state.error = errorMessage
        state.loading = false
      })
      throw new Error(errorMessage)
    }
  },

  // Update listing
  updateListing: async (id: string, updates: Partial<CallListingForm>) => {
    set((state: SupplierState) => {
      state.loading = true
      state.error = null
    })

    try {
      const campaignUpdates: Partial<Database['public']['Tables']['campaigns']['Update']> = {}
      
      if (updates.title !== undefined) campaignUpdates.name = updates.title
      if (updates.description !== undefined) campaignUpdates.description = updates.description
      if (updates.vertical !== undefined) campaignUpdates.vertical = updates.vertical
      if (updates.price_per_call !== undefined) campaignUpdates.bid_floor = updates.price_per_call
      if (updates.daily_cap !== undefined) campaignUpdates.daily_cap = updates.daily_cap
      if (updates.monthly_cap !== undefined) campaignUpdates.monthly_cap = updates.monthly_cap
      if (updates.status !== undefined) {
        const status: Database['public']['Enums']['campaign_status'] = 
          updates.status === 'archived' ? 'completed' : 
          updates.status === 'draft' ? 'draft' :
          updates.status === 'active' ? 'active' :
          updates.status === 'paused' ? 'paused' : 'draft'
        campaignUpdates.status = status
      }

      await SupplierDataService.updateCampaign(id, campaignUpdates)

      set((state: SupplierState) => {
        state.listings = state.listings.map(listing =>
          listing.id === id ? { ...listing, ...updates } : listing
        )
        state.loading = false
      })
    } catch (error) {
      set((state: SupplierState) => {
        state.error = error instanceof Error ? error.message : 'Failed to update listing'
        state.loading = false
      })
    }
  },

  // Delete listing
  deleteListing: async (id: string) => {
    set((state: SupplierState) => {
      state.loading = true
      state.error = null
    })

    try {
      await SupplierDataService.deleteCampaign(id)

      set((state: SupplierState) => {
        state.listings = state.listings.filter(listing => listing.id !== id)
        state.loading = false
      })
    } catch (error) {
      set((state: SupplierState) => {
        state.error = error instanceof Error ? error.message : 'Failed to delete listing'
        state.loading = false
      })
    }
  },

  // Bulk upload
  bulkUpload: async (_file: File): Promise<BulkUploadResult> => {
    set((state: SupplierState) => {
      state.loading = true
      state.error = null
    })

    try {
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 2000))

      const mockResult: BulkUploadResult = {
        total_processed: 50,
        successful_uploads: 47,
        failed_uploads: 3,
        errors: [
          { row: 5, field: 'price_per_call', message: 'Invalid price format', value: 'abc' },
          { row: 12, field: 'geographic_coverage', message: 'Invalid state code', value: 'XX' },
          { row: 28, field: 'daily_cap', message: 'Value must be positive', value: '-10' },
        ],
        created_listings: Array.from({ length: 47 }, (_, i) => `listing_${i + 1}`),
      }

      // Refresh listings after bulk upload
      await get().fetchListings()

      set((state: SupplierState) => {
        state.loading = false
      })

      return mockResult
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to bulk upload'
      set((state: SupplierState) => {
        state.error = errorMessage
        state.loading = false
      })
      throw new Error(errorMessage)
    }
  },

  // Update pricing strategy
  updatePricing: async (listingId: string, strategy: PricingStrategyForm) => {
    set((state: SupplierState) => {
      state.loading = true
      state.error = null
    })

    try {
      if (strategy.strategy_type === 'fixed') {
        await get().updateListing(listingId, { price_per_call: strategy.base_price })
      }
      
      set((state: SupplierState) => {
        state.loading = false
      })
    } catch (error) {
      set((state: SupplierState) => {
        state.error = error instanceof Error ? error.message : 'Failed to update pricing'
        state.loading = false
      })
    }
  },

  // Fetch listings
  fetchListings: async () => {
    set((state: SupplierState) => {
      state.loading = true
      state.error = null
    })

    try {
      const { data: session } = await getSession()
      if (!session.session?.user) throw new Error('Not authenticated')

      const campaigns = await SupplierDataService.fetchCampaigns(session.session.user.id)

      const listings: EnhancedCallListing[] = campaigns.map((campaign: Database['public']['Tables']['campaigns']['Row']) => {
        const baseListing: CallListing = {
          id: campaign.id,
          supplier_id: campaign.supplier_id || session.session.user.id,
          vertical: campaign.vertical || 'general',
          title: campaign.name,
          description: campaign.description || '',
          price_per_call: campaign.bid_floor || 0,
          quality_score: campaign.quality_threshold || 85,
          geographic_coverage: [],
          daily_cap: campaign.daily_cap || 0,
          weekly_cap: 0,
          monthly_cap: campaign.monthly_cap || 0,
          availability_hours: {
            start: '09:00',
            end: '17:00',
            timezone: 'America/New_York',
            days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          },
          filters: {
            lead_types: [],
          },
          performance_metrics: {
            conversion_rate: 0,
            average_call_duration: 0,
            buyer_satisfaction: 0,
          },
          status: campaign.status === 'completed' ? 'archived' : (campaign.status as ListingStatus) || 'draft',
          created_at: campaign.created_at || new Date().toISOString(),
          updated_at: campaign.updated_at || new Date().toISOString(),
        }
        
        return enhanceListing(baseListing)
      })

      set((state: SupplierState) => {
        state.listings = listings
        state.loading = false
      })
    } catch (error) {
      set((state: SupplierState) => {
        state.error = error instanceof Error ? error.message : 'Failed to fetch listings'
        state.loading = false
      })
    }
  },

  // Fetch inventory
  fetchInventory: async () => {
    set((state: SupplierState) => {
      state.loading = true
      state.error = null
    })

    try {
      // Mock implementation
      set((state: SupplierState) => {
        state.inventory = []
        state.loading = false
      })
    } catch (error) {
      set((state: SupplierState) => {
        state.error = error instanceof Error ? error.message : 'Failed to fetch inventory'
        state.loading = false
      })
    }
  },

  // Enhanced listing management
  updateListingAnalytics: (listingId: string, analytics: EnhancedCallListing['_analytics']) => {
    set((state: SupplierState) => {
      state.listings = state.listings.map(listing =>
        listing.id === listingId ? { ...listing, _analytics: analytics } : listing
      )
    })
  },

  updateListingCompliance: (listingId: string, compliance: EnhancedCallListing['_compliance']) => {
    set((state: SupplierState) => {
      state.listings = state.listings.map(listing =>
        listing.id === listingId ? { ...listing, _compliance: compliance } : listing
      )
    })
  },

  runAIOptimization: async (listingId: string) => {
    set((state: SupplierState) => {
      state.loading = true
      state.error = null
    })

    try {
      // Mock AI optimization
      const mockInsights = {
        performancePrediction: 8.5,
        optimizationSuggestions: [
          'Increase bid floor by 10% for better quality leads',
          'Expand geographic coverage to include adjacent states',
          'Adjust availability hours to match peak demand'
        ],
        marketTrends: [
          {
            trend: 'Increasing demand for insurance leads in Q1',
            impact: 'positive' as const,
            confidence: 0.85
          }
        ],
        lastAnalysis: new Date().toISOString(),
      }

      set((state: SupplierState) => {
        state.listings = state.listings.map(listing =>
          listing.id === listingId ? { ...listing, _aiInsights: mockInsights } : listing
        )
        state.loading = false
      })
    } catch (error) {
      set((state: SupplierState) => {
        state.error = error instanceof Error ? error.message : 'Failed to run AI optimization'
        state.loading = false
      })
    }
  },

  // Fetch sales metrics - NEVER PERSISTED
  fetchMetrics: async () => {
    set((state: SupplierState) => {
      state.loading = true
      state.error = null
    })

    try {
      const { data: session } = await getSession()
      if (!session.session?.user) throw new Error('Not authenticated')

      const metrics = await SupplierDataService.generateMockMetrics()
      
      set((state: SupplierState) => {
        state.metrics = metrics
        state.loading = false
      })
    } catch (error) {
      set((state: SupplierState) => {
        state.error = error instanceof Error ? error.message : 'Failed to fetch metrics'
        state.loading = false
      })
    }
  },

  // Fetch sales - NEVER PERSISTED
  fetchSales: async () => {
    set((state: SupplierState) => {
      state.loading = true
      state.error = null
    })

    try {
      const { data: session } = await getSession()
      if (!session.session?.user) throw new Error('Not authenticated')

      const callsData = await SupplierDataService.fetchCallsWithCampaigns(session.session.user.id)

      const sales: Sale[] = callsData.map((call: { 
        id: string
        buyer_campaign_id: string | null
        campaign_id: string | null
        charge_amount: number | null
        payout_amount: number | null
        status: Database['public']['Enums']['call_status'] | null
        created_at: string | null
        ended_at: string | null
        campaigns: { name: string; vertical: string } | null
      }) => {
        const campaign = call.campaigns
        return {
          id: call.id,
          buyer_id: call.buyer_campaign_id || 'unknown',
          buyer_name: 'Unknown Buyer',
          listing_id: call.campaign_id || 'unknown',
          vertical: campaign?.vertical || 'general',
          quantity: 1,
          price_per_call: call.charge_amount || 0,
          total_amount: call.charge_amount || 0,
          commission_amount: (call.charge_amount || 0) - (call.payout_amount || 0),
          net_amount: call.payout_amount || 0,
          status: SupplierDataService.mapCallStatusToSaleStatus(call.status),
          created_at: call.created_at || new Date().toISOString(),
          delivered_at: call.ended_at || undefined,
        }
      })

      set((state: SupplierState) => {
        state.sales = sales
        state.loading = false
      })
    } catch (error) {
      set((state: SupplierState) => {
        state.error = error instanceof Error ? error.message : 'Failed to fetch sales'
        state.loading = false
      })
    }
  },

  // Export sales data - FINANCIAL DATA NOT PERSISTED
  exportSalesData: async (format: 'csv' | 'pdf', timeframe: string) => {
    set((state: SupplierState) => {
      state.loading = true
      state.error = null
    })

    try {
      const state = get()
      const { sales, metrics } = state

      const exportData = {
        sales,
        metrics,
        timeframe,
        exportedAt: new Date().toISOString(),
      }

      if (format === 'csv') {
        const csvContent = [
          'Date,Buyer,Vertical,Quantity,Price,Total,Commission,Net',
          ...sales.map(sale => 
            `${sale.created_at},${sale.buyer_name},${sale.vertical},${sale.quantity},${sale.price_per_call},${sale.total_amount},${sale.commission_amount},${sale.net_amount}`
          )
        ].join('\n')
        
        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `sales-data-${timeframe}-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      } else {
        const jsonContent = JSON.stringify(exportData, null, 2)
        const blob = new Blob([jsonContent], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `sales-data-${timeframe}-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }

      set((state: SupplierState) => {
        state.loading = false
      })
    } catch (error) {
      set((state: SupplierState) => {
        state.error = error instanceof Error ? error.message : 'Failed to export data'
        state.loading = false
      })
    }
  },

  // Create lead source
  createLeadSource: async (source: LeadSourceForm): Promise<LeadSource> => {
    set((state: SupplierState) => {
      state.loading = true
      state.error = null
    })

    try {
      const { data: session } = await getSession()
      if (!session.session?.user) throw new Error('Not authenticated')

      const newSource: LeadSource = {
        id: `source_${Date.now()}`,
        supplier_id: session.session.user.id,
        ...source,
        quality_score: 80,
        volume_metrics: {
          daily_average: 0,
          weekly_total: 0,
          monthly_total: 0,
        },
        performance_metrics: {
          conversion_rate: 0,
          cost_per_acquisition: 0,
          roi_percentage: 0,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const enhancedSource = enhanceLeadSource(newSource)

      set((state: SupplierState) => {
        state.leadSources = [...state.leadSources, enhancedSource]
        state.loading = false
      })

      return newSource
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create lead source'
      set((state: SupplierState) => {
        state.error = errorMessage
        state.loading = false
      })
      throw new Error(errorMessage)
    }
  },

  // Update lead source
  updateLeadSource: async (id: string, updates: Partial<LeadSourceForm>) => {
    set((state: SupplierState) => {
      state.loading = true
      state.error = null
    })

    try {
      set((state: SupplierState) => {
        state.leadSources = state.leadSources.map(source =>
          source.id === id ? { ...source, ...updates } : source
        )
        state.loading = false
      })
    } catch (error) {
      set((state: SupplierState) => {
        state.error = error instanceof Error ? error.message : 'Failed to update lead source'
        state.loading = false
      })
    }
  },

  // Delete lead source
  deleteLeadSource: async (id: string) => {
    set((state: SupplierState) => {
      state.loading = true
      state.error = null
    })

    try {
      set((state: SupplierState) => {
        state.leadSources = state.leadSources.filter(source => source.id !== id)
        state.loading = false
      })
    } catch (error) {
      set((state: SupplierState) => {
        state.error = error instanceof Error ? error.message : 'Failed to delete lead source'
        state.loading = false
      })
    }
  },

  // Fetch lead sources
  fetchLeadSources: async () => {
    set((state: SupplierState) => {
      state.loading = true
      state.error = null
    })

    try {
      // Mock implementation
      set((state: SupplierState) => {
        state.leadSources = []
        state.loading = false
      })
    } catch (error) {
      set((state: SupplierState) => {
        state.error = error instanceof Error ? error.message : 'Failed to fetch lead sources'
        state.loading = false
      })
    }
  },

  // Analyze lead quality
  analyzeLeadQuality: async (leadId: string): Promise<QualityScoring> => {
    set((state: SupplierState) => {
      state.loading = true
      state.error = null
    })

    try {
      const mockQualityScoring: QualityScoring = {
        id: `scoring_${Date.now()}`,
        lead_id: leadId,
        call_id: `call_${Date.now()}`,
        scores: {
          lead_quality: 8.5,
          call_duration: 7.2,
          buyer_satisfaction: 4.1,
          conversion_likelihood: 0.75,
          fraud_risk: 0.1
        },
        factors: [{
          factor: 'demographics_match',
          weight: 0.3,
          score: 8.5,
          impact: 'positive',
          description: 'Lead demographics match buyer requirements'
        }],
        overall_score: 8.1,
        recommendations: ['Increase bid for similar leads', 'Monitor conversion rate'],
        created_at: new Date().toISOString()
      }

      set((state: SupplierState) => {
        state.qualityScoring = [...state.qualityScoring, mockQualityScoring]
        state.loading = false
      })

      return mockQualityScoring
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to analyze lead quality'
      set((state: SupplierState) => {
        state.error = errorMessage
        state.loading = false
      })
      throw new Error(errorMessage)
    }
  },

  // Enhanced lead source management
  updateLeadSourceAttribution: (sourceId: string, attribution: EnhancedLeadSource['_attribution']) => {
    set((state: SupplierState) => {
      state.leadSources = state.leadSources.map(source =>
        source.id === sourceId ? { ...source, _attribution: attribution } : source
      )
    })
  },

  updateFraudPrevention: (sourceId: string, fraudData: EnhancedLeadSource['_fraudPrevention']) => {
    set((state: SupplierState) => {
      state.leadSources = state.leadSources.map(source =>
        source.id === sourceId ? { ...source, _fraudPrevention: fraudData } : source
      )
    })
  },

  runPredictiveAnalysis: async (sourceId: string) => {
    set((state: SupplierState) => {
      state.loading = true
      state.error = null
    })

    try {
      // Mock predictive analysis
      const mockAnalytics = {
        expectedVolume: 150,
        qualityForecast: 8.2,
        seasonalityFactors: [
          { period: 'Q1', multiplier: 1.2 },
          { period: 'Q2', multiplier: 0.9 },
        ],
        lastPrediction: new Date().toISOString(),
      }

      set((state: SupplierState) => {
        state.leadSources = state.leadSources.map(source =>
          source.id === sourceId ? { ...source, _predictiveAnalytics: mockAnalytics } : source
        )
        state.loading = false
      })
    } catch (error) {
      set((state: SupplierState) => {
        state.error = error instanceof Error ? error.message : 'Failed to run predictive analysis'
        state.loading = false
      })
    }
  },

  // Fetch dashboard data - NEVER PERSISTED
  fetchDashboardData: async () => {
    set((state: SupplierState) => {
      state.loading = true
      state.error = null
    })

    try {
      const mockDashboardData: SupplierDashboardData = {
        metrics: await SupplierDataService.generateMockMetrics(),
        recent_sales: [],
        active_listings: [],
        performance_alerts: [],
        top_buyers: [],
        inventory_status: {
          total_listings: 12,
          active_listings: 8,
          total_daily_capacity: 500,
          allocated_capacity: 380,
          available_capacity: 120,
          utilization_rate: 0.76,
          forecast_demand: []
        }
      }

      set((state: SupplierState) => {
        state.dashboardData = mockDashboardData
        state.loading = false
      })
    } catch (error) {
      set((state: SupplierState) => {
        state.error = error instanceof Error ? error.message : 'Failed to fetch dashboard data'
        state.loading = false
      })
    }
  },

  // Compliance and optimization actions
  updateSupplierCompliance: (compliance: Partial<SupplierCompliance>) => {
    set((state: SupplierState) => {
      if (state._supplierCompliance) {
        Object.assign(state._supplierCompliance, compliance)
      }
    })
  },

  updateOptimizationSettings: (settings: Partial<OptimizationSettings>) => {
    set((state: SupplierState) => {
      if (state._optimization) {
        Object.assign(state._optimization, settings)
      }
    })
  },

  runComplianceAudit: async () => {
    set((state: SupplierState) => {
      state.loading = true
      state.error = null
    })

    try {
      // Mock compliance audit
      set((state: SupplierState) => {
        if (state._supplierCompliance) {
          state._supplierCompliance.lastAuditDate = new Date().toISOString()
        }
        state.loading = false
      })
    } catch (error) {
      set((state: SupplierState) => {
        state.error = error instanceof Error ? error.message : 'Failed to run compliance audit'
        state.loading = false
      })
    }
  },

  // Utility actions
  clearError: () => {
    set((state: SupplierState) => {
      state.error = null
    })
  },

  reset: () => {
    set((state: SupplierState) => {
      // Reset to initial state but preserve compliance and optimization settings
      const compliance = state._supplierCompliance
      const optimization = state._optimization
      Object.assign(state, initialState)
      state._supplierCompliance = compliance
      state._optimization = optimization
    })
  },
})

// Create the store using the standard factory
export const useSupplierStore = createStandardStore<SupplierState>({
  name: 'supplier-store',
  creator: createSupplierState,
  persist: {
    // SECURITY CRITICAL: Only persist business data, NO financial information
    partialize: (state): Partial<SupplierState> => ({
      listings: state.listings || [],
      leadSources: state.leadSources,
      _supplierCompliance: state._supplierCompliance,
      _optimization: state._optimization,
      // Return partial state with required properties for persistence
      loading: false, // Reset loading state on rehydration
      error: null, // Clear errors on rehydration
    }),
    // Use encrypted storage for business data (INTERNAL classification)
    storage: createJSONStorage(() => StorageFactory.createZustandStorage(
      DataClassification.INTERNAL,
      StorageType.LOCAL
    )),
  },
  monitoring: {
    enabled: true,
    trackPerformance: true,
    trackStateChanges: true,
  },
  devtools: {
    trace: true, // Enable action tracing for debugging
  },
})

// Export the type for external use
export type UseSupplierStore = typeof useSupplierStore