/**
 * Buyer Store V2 - Migrated to Standard Store Factory
 * 
 * This is the migrated version of buyerStore using the unified mutator chain.
 * It maintains backward compatibility while fixing TypeScript issues and 
 * improving security by never persisting financial data.
 * 
 * Key Security Features:
 * - Financial data (currentBalance, creditLimit) is NEVER persisted
 * - Uses encrypted storage for business data
 * - Maintains GDPR compliance features
 * - Abstracts Supabase calls for future service layer migration
 */

import { createStandardStore } from './factories/createStandardStore'
import type { StandardStateCreator } from './types/mutators'
import { from, getSession } from '../lib/supabase-optimized'
import { StorageFactory } from './utils/storage/encryptedStorage'
import { DataClassification, StorageType } from './utils/dataClassification'
import type { Database } from '../types/database-extended'
import type {
  MarketplaceListing,
  SearchFilters,
  SavedSearch,
  Purchase,
  BuyerMetrics,
  BuyerDashboardData,
  PurchaseRequest,
} from '../types/buyer'

type Campaign = Database['public']['Tables']['buyer_campaigns']['Row']

// GDPR compliance interface from migrations
interface GDPRCompliance {
  consentGiven: boolean
  consentDate?: string
  dataRetentionDays: number
  purposeLimitation: string[]
}

interface PrivacyControls {
  sharePerformanceData: boolean
  shareWithNetwork: boolean
  anonymizeInReports: boolean
}

// Enhanced types with privacy and GDPR compliance
interface EnhancedSavedSearch extends SavedSearch {
  _gdpr?: GDPRCompliance
}

interface EnhancedCampaign extends Campaign {
  _privacy?: PrivacyControls
}

export interface BuyerState {
  // Financial state - NEVER PERSISTED
  currentBalance: number
  creditLimit: number
  
  // Business data - can be persisted with encryption
  campaigns: EnhancedCampaign[]
  listings: MarketplaceListing[]
  searchFilters: SearchFilters
  savedSearches: EnhancedSavedSearch[]
  purchases: Purchase[]
  activePurchases: Purchase[]
  
  // Analytics state - not persisted (fetched fresh)
  metrics: BuyerMetrics | null
  dashboardData: BuyerDashboardData | null
  
  // UI state - not persisted
  isLoading: boolean
  error: string | null
  
  // GDPR compliance tracking
  _gdprCompliance?: {
    consentVersion: string
    consentDate?: string
    dataProcessingPurposes: string[]
    retentionPeriod: number
    rightToBeFororgotten: boolean
  }

  // Actions - Financial data management
  fetchBalance: (buyerId: string) => Promise<void>
  updateBalance: (newBalance: number) => void
  
  // Actions - Campaign management
  fetchCampaigns: (buyerId: string) => Promise<void>
  updateCampaign: (campaignId: string, updates: Partial<Campaign>) => void
  updateCampaignPrivacy: (campaignId: string, privacy: PrivacyControls) => void
  
  // Actions - Marketplace
  setListings: (listings: MarketplaceListing[]) => void
  setSearchFilters: (filters: SearchFilters) => void
  setSavedSearches: (searches: EnhancedSavedSearch[]) => void
  setPurchases: (purchases: Purchase[]) => void
  setMetrics: (metrics: BuyerMetrics) => void
  setDashboardData: (data: BuyerDashboardData) => void
  
  // Actions - Async operations
  searchMarketplace: (filters: SearchFilters) => Promise<void>
  saveSearch: (name: string, filters: SearchFilters, alertEnabled: boolean) => Promise<void>
  createPurchase: (request: PurchaseRequest) => Promise<Purchase>
  fetchPurchases: () => Promise<void>
  fetchMetrics: () => Promise<void>
  fetchDashboardData: () => Promise<void>
  
  // Actions - Purchase management
  cancelPurchase: (purchaseId: string) => Promise<void>
  pausePurchase: (purchaseId: string) => Promise<void>
  resumePurchase: (purchaseId: string) => Promise<void>
  
  // Actions - GDPR compliance
  updateGDPRConsent: (consent: boolean, purposes: string[]) => void
  requestDataDeletion: () => Promise<void>
  exportUserData: () => Promise<Blob>
  
  // Utility actions
  clearError: () => void
  reset: () => void
}

// Service layer abstraction helpers
const BuyerDataService = {
  async fetchBalance(buyerId: string) {
    const { data, error } = await from('buyers')
      .select('current_balance, credit_limit')
      .eq('id', buyerId)
      .single()
    
    if (error) throw error
    return {
      currentBalance: data.current_balance || 0,
      creditLimit: data.credit_limit || 0,
    }
  },

  async fetchCampaigns(buyerId: string) {
    const { data, error } = await from('buyer_campaigns')
      .select('*')
      .eq('buyer_id', buyerId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  async createMockPurchase(request: PurchaseRequest, userId: string): Promise<Purchase> {
    // Mock implementation - would be replaced with real service call
    return {
      id: Date.now().toString(),
      buyer_id: userId,
      supplier_id: 'mock-supplier-id',
      listing_id: request.listing_id,
      campaign_id: request.campaign_id,
      quantity: request.quantity,
      price_per_call: 25.00,
      total_amount: request.quantity * 25.00,
      status: 'pending_approval',
      start_date: request.start_date,
      end_date: request.end_date,
      calls_received: 0,
      calls_converted: 0,
      roi_percentage: 0,
      special_instructions: request.special_instructions,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  },

  async generateMockMetrics(): Promise<BuyerMetrics> {
    // Mock implementation - would be replaced with real service call
    return {
      total_spent: 5000,
      total_calls: 250,
      total_conversions: 39,
      average_cost_per_call: 20.0,
      average_cost_per_acquisition: 128.2,
      conversion_rate: 15.5,
      roi_percentage: 125.5,
      active_campaigns: 5,
      top_performing_verticals: []
    }
  },

  async generateMockListings(filters: SearchFilters): Promise<MarketplaceListing[]> {
    // Mock implementation with filtered results
    const mockListings: MarketplaceListing[] = [
      {
        id: '1',
        campaign_id: 'campaign-1',
        supplier_id: '1',
        supplier_name: 'Premium Insurance Leads',
        vertical: filters.vertical || 'insurance',
        description: 'High-quality insurance leads from qualified prospects',
        price_per_call: 25.00,
        quality_score: 95,
        estimated_volume: 100,
        geographic_coverage: ['CA', 'NY'],
        availability_hours: {
          start: '09:00',
          end: '17:00',
          timezone: 'EST'
        },
        call_caps: {
          daily: 50,
          weekly: 300,
          monthly: 1200
        },
        filters: {
          states: ['CA', 'NY'],
          age_range: [25, 65],
          income_range: [50000, 150000]
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ]

    // Apply basic filtering
    let filteredListings = mockListings
    if (filters.vertical) {
      filteredListings = filteredListings.filter(l => l.vertical === filters.vertical)
    }
    if (filters.min_quality_score !== undefined) {
      filteredListings = filteredListings.filter(l => l.quality_score >= filters.min_quality_score!)
    }
    if (filters.max_price !== undefined) {
      filteredListings = filteredListings.filter(l => l.price_per_call <= filters.max_price!)
    }

    return filteredListings
  }
}

const initialState = {
  // Financial data - defaults to 0, will be fetched fresh
  currentBalance: 0,
  creditLimit: 0,
  
  // Business data
  campaigns: [],
  listings: [],
  searchFilters: {},
  savedSearches: [],
  purchases: [],
  activePurchases: [],
  
  // Analytics data
  metrics: null,
  dashboardData: null,
  
  // UI state
  isLoading: false,
  error: null,
  
  // GDPR compliance - default conservative settings
  _gdprCompliance: {
    consentVersion: '1.0',
    consentDate: undefined,
    dataProcessingPurposes: ['campaign_management', 'performance_analytics', 'billing_processing'],
    retentionPeriod: 2555, // 7 years default
    rightToBeFororgotten: false,
  },
}

// Create store state using Immer for immutable updates
const createBuyerState: StandardStateCreator<BuyerState> = (set, get) => ({
  ...initialState,

  // Financial data actions - NEVER PERSISTED for security
  fetchBalance: async (buyerId: string) => {
    set((state) => {
      state.isLoading = true
      state.error = null
    })

    try {
      const { currentBalance, creditLimit } = await BuyerDataService.fetchBalance(buyerId)
      
      set((state) => {
        state.currentBalance = currentBalance
        state.creditLimit = creditLimit
        state.isLoading = false
      })
    } catch (error) {
      set((state) => {
        state.error = error instanceof Error ? error.message : 'Failed to fetch balance'
        state.isLoading = false
      })
    }
  },

  updateBalance: (newBalance: number) => {
    set((state) => {
      state.currentBalance = newBalance
    })
  },

  // Campaign management actions
  fetchCampaigns: async (buyerId: string) => {
    set((state) => {
      state.isLoading = true
      state.error = null
    })

    try {
      const campaigns = await BuyerDataService.fetchCampaigns(buyerId)
      
      // Add default privacy controls to campaigns
      const enhancedCampaigns: EnhancedCampaign[] = campaigns.map(campaign => ({
        ...campaign,
        _privacy: {
          sharePerformanceData: false,
          shareWithNetwork: true,
          anonymizeInReports: false,
        }
      }))

      set((state) => {
        state.campaigns = enhancedCampaigns
        state.isLoading = false
      })
    } catch (error) {
      set((state) => {
        state.error = error instanceof Error ? error.message : 'Failed to fetch campaigns'
        state.isLoading = false
      })
    }
  },

  updateCampaign: (campaignId: string, updates: Partial<Campaign>) => {
    set((state) => {
      state.campaigns = state.campaigns.map((campaign) =>
        campaign.id === campaignId ? { ...campaign, ...updates } : campaign
      )
    })
  },

  updateCampaignPrivacy: (campaignId: string, privacy: PrivacyControls) => {
    set((state) => {
      state.campaigns = state.campaigns.map((campaign) =>
        campaign.id === campaignId ? { ...campaign, _privacy: privacy } : campaign
      )
    })
  },

  // Simple setters
  setListings: (listings) => {
    set((state) => {
      state.listings = listings
    })
  },

  setSearchFilters: (searchFilters) => {
    set((state) => {
      state.searchFilters = searchFilters
    })
  },

  setSavedSearches: (savedSearches) => {
    set((state) => {
      state.savedSearches = savedSearches
    })
  },

  setPurchases: (purchases) => {
    const activePurchases = purchases.filter(p => 
      ['approved', 'active'].includes(p.status)
    )
    set((state) => {
      state.purchases = purchases
      state.activePurchases = activePurchases
    })
  },

  setMetrics: (metrics) => {
    set((state) => {
      state.metrics = metrics
    })
  },

  setDashboardData: (dashboardData) => {
    set((state) => {
      state.dashboardData = dashboardData
    })
  },

  // Async marketplace actions
  searchMarketplace: async (filters: SearchFilters) => {
    set((state) => {
      state.isLoading = true
      state.error = null
    })

    try {
      const listings = await BuyerDataService.generateMockListings(filters)
      
      set((state) => {
        state.listings = listings
        state.searchFilters = filters
        state.isLoading = false
      })
    } catch (error) {
      set((state) => {
        state.error = error instanceof Error ? error.message : 'Failed to search marketplace'
        state.isLoading = false
      })
    }
  },

  saveSearch: async (name: string, filters: SearchFilters, alertEnabled: boolean) => {
    set((state) => {
      state.isLoading = true
      state.error = null
    })

    try {
      const { data: session } = await getSession()
      if (!session.session?.user) throw new Error('Not authenticated')

      const newSearch: EnhancedSavedSearch = {
        id: Date.now().toString(),
        buyer_id: session.session.user.id,
        name,
        filters,
        alert_enabled: alertEnabled,
        last_results_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _gdpr: {
          consentGiven: false,
          consentDate: undefined,
          dataRetentionDays: 365,
          purposeLimitation: ['campaign_management'],
        }
      }

      set((state) => {
        state.savedSearches = [...state.savedSearches, newSearch]
        state.isLoading = false
      })
    } catch (error) {
      set((state) => {
        state.error = error instanceof Error ? error.message : 'Failed to save search'
        state.isLoading = false
      })
    }
  },

  createPurchase: async (request: PurchaseRequest): Promise<Purchase> => {
    set((state) => {
      state.isLoading = true
      state.error = null
    })

    try {
      const { data: session } = await getSession()
      if (!session.session?.user) throw new Error('Not authenticated')

      const newPurchase = await BuyerDataService.createMockPurchase(request, session.session.user.id)
      
      set((state) => {
        state.purchases = [...state.purchases, newPurchase]
        state.isLoading = false
      })

      return newPurchase
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create purchase'
      set((state) => {
        state.error = errorMessage
        state.isLoading = false
      })
      throw new Error(errorMessage)
    }
  },

  fetchPurchases: async () => {
    set((state) => {
      state.isLoading = true
      state.error = null
    })

    try {
      const { data: session } = await getSession()
      if (!session.session?.user) throw new Error('Not authenticated')

      // Mock implementation - would be replaced with real service
      set((state) => {
        state.purchases = []
        state.isLoading = false
      })
    } catch (error) {
      set((state) => {
        state.error = error instanceof Error ? error.message : 'Failed to fetch purchases'
        state.isLoading = false
      })
    }
  },

  fetchMetrics: async () => {
    set((state) => {
      state.isLoading = true
      state.error = null
    })

    try {
      const { data: session } = await getSession()
      if (!session.session?.user) throw new Error('Not authenticated')

      const metrics = await BuyerDataService.generateMockMetrics()
      
      set((state) => {
        state.metrics = metrics
        state.isLoading = false
      })
    } catch (error) {
      set((state) => {
        state.error = error instanceof Error ? error.message : 'Failed to fetch metrics'
        state.isLoading = false
      })
    }
  },

  fetchDashboardData: async () => {
    set((state) => {
      state.isLoading = true
      state.error = null
    })

    try {
      const { data: session } = await getSession()
      if (!session.session?.user) throw new Error('Not authenticated')

      const mockDashboardData: BuyerDashboardData = {
        metrics: await BuyerDataService.generateMockMetrics(),
        recent_purchases: [],
        active_campaigns: [{
          id: '1',
          name: 'Insurance Lead Campaign',
          status: 'active',
          calls_today: 5,
          conversions_today: 2,
          spend_today: 150
        }],
        budget_alerts: [],
        market_opportunities: []
      }

      set((state) => {
        state.dashboardData = mockDashboardData
        state.isLoading = false
      })
    } catch (error) {
      set((state) => {
        state.error = error instanceof Error ? error.message : 'Failed to fetch dashboard data'
        state.isLoading = false
      })
    }
  },

  // Purchase management actions
  cancelPurchase: async (purchaseId: string) => {
    set((state) => {
      state.isLoading = true
      state.error = null
    })

    try {
      set((state) => {
        state.purchases = state.purchases.map(p =>
          p.id === purchaseId ? { ...p, status: 'cancelled' as const } : p
        )
        state.isLoading = false
      })
    } catch (error) {
      set((state) => {
        state.error = error instanceof Error ? error.message : 'Failed to cancel purchase'
        state.isLoading = false
      })
    }
  },

  pausePurchase: async (purchaseId: string) => {
    set((state) => {
      state.isLoading = true
      state.error = null
    })

    try {
      set((state) => {
        state.purchases = state.purchases.map(p =>
          p.id === purchaseId ? { ...p, status: 'paused' as const } : p
        )
        state.isLoading = false
      })
    } catch (error) {
      set((state) => {
        state.error = error instanceof Error ? error.message : 'Failed to pause purchase'
        state.isLoading = false
      })
    }
  },

  resumePurchase: async (purchaseId: string) => {
    set((state) => {
      state.isLoading = true
      state.error = null
    })

    try {
      set((state) => {
        state.purchases = state.purchases.map(p =>
          p.id === purchaseId ? { ...p, status: 'active' as const } : p
        )
        state.isLoading = false
      })
    } catch (error) {
      set((state) => {
        state.error = error instanceof Error ? error.message : 'Failed to resume purchase'
        state.isLoading = false
      })
    }
  },

  // GDPR compliance actions
  updateGDPRConsent: (consent: boolean, purposes: string[]) => {
    set((state) => {
      if (state._gdprCompliance) {
        state._gdprCompliance.consentDate = consent ? new Date().toISOString() : undefined
        state._gdprCompliance.dataProcessingPurposes = purposes
      }
    })
  },

  requestDataDeletion: async () => {
    set((state) => {
      state.isLoading = true
      state.error = null
    })

    try {
      const { data: session } = await getSession()
      if (!session.session?.user) throw new Error('Not authenticated')

      // Mock implementation - would trigger actual data deletion process
      console.log('Data deletion requested for user:', session.session.user.id)
      
      set((state) => {
        if (state._gdprCompliance) {
          state._gdprCompliance.rightToBeFororgotten = true
        }
        state.isLoading = false
      })
    } catch (error) {
      set((state) => {
        state.error = error instanceof Error ? error.message : 'Failed to request data deletion'
        state.isLoading = false
      })
    }
  },

  exportUserData: async (): Promise<Blob> => {
    const state = get()
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      campaigns: state.campaigns,
      savedSearches: state.savedSearches,
      purchases: state.purchases,
      gdprCompliance: state._gdprCompliance,
      // NOTE: Financial data is NOT included in export for security
    }

    return new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    })
  },

  // Utility actions
  clearError: () => {
    set((state) => {
      state.error = null
    })
  },

  reset: () => {
    set((state) => {
      // Reset to initial state but preserve GDPR compliance
      const gdprCompliance = state._gdprCompliance
      Object.assign(state, initialState)
      state._gdprCompliance = gdprCompliance
    })
  },
})

// Create the store using the standard factory
export const useBuyerStore = createStandardStore<BuyerState>({
  name: 'buyer-store',
  creator: createBuyerState,
  persist: {
    // SECURITY CRITICAL: Only persist non-sensitive business data
    // Financial data (currentBalance, creditLimit) is NEVER persisted
    partialize: (state) => ({
      campaigns: state.campaigns,
      savedSearches: state.savedSearches,
      _gdprCompliance: state._gdprCompliance,
      // EXPLICITLY EXCLUDED for security:
      // - currentBalance: fetch fresh from server
      // - creditLimit: fetch fresh from server
      // - metrics: contains financial data
      // - dashboardData: contains financial data
      // - purchases: may contain financial data
    }),
    // Use encrypted storage for business data (INTERNAL classification)
    storage: StorageFactory.createZustandStorage(
      DataClassification.INTERNAL,
      StorageType.LOCAL
    ),
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
export type UseBuyerStore = typeof useBuyerStore