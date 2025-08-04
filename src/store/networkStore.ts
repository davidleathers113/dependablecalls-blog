import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
// Mock implementation - all database calls replaced with mock data
import type {
  Network,
  NetworkCampaign,
  NetworkMetrics,
  NetworkRelationship,
} from '../types/network'

interface NetworkState {
  // Core network data
  network: Network | null
  campaigns: NetworkCampaign[]
  relationships: NetworkRelationship[]
  metrics: NetworkMetrics | null

  // UI state
  isLoading: boolean
  error: string | null
  selectedMode: 'network' | 'supplier' | 'buyer'

  // Actions
  setNetwork: (network: Network | null) => void
  setSelectedMode: (mode: 'network' | 'supplier' | 'buyer') => void
  
  // Mock async actions
  fetchNetworkData: (networkId: string) => Promise<void>
  fetchCampaigns: () => Promise<void>
  fetchRelationships: () => Promise<void>
  fetchMetrics: () => Promise<void>
  createCampaign: (campaign: Partial<NetworkCampaign>) => Promise<void>
  updateCampaign: (id: string, updates: Partial<NetworkCampaign>) => Promise<void>
  deleteCampaign: (id: string) => Promise<void>
  addRelationship: (relationship: Partial<NetworkRelationship>) => Promise<void>
  updateRelationship: (id: string, updates: Partial<NetworkRelationship>) => Promise<void>
  removeRelationship: (id: string) => Promise<void>
  clearError: () => void
  reset: () => void
}

const initialState = {
  network: null,
  campaigns: [],
  relationships: [],
  metrics: null,
  isLoading: false,
  error: null,
  selectedMode: 'network' as const,
}

const useNetworkStoreLegacy = create<NetworkState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // Basic setters
    setNetwork: (network) => set({ network }),
    setSelectedMode: (mode) => set({ selectedMode: mode }),

    // Mock async actions
    fetchNetworkData: async (networkId: string) => {
      set({ isLoading: true, error: null })
      try {
        // Mock network data
        const mockNetwork: Network = {
          id: networkId,
          user_id: 'user-123',
          company_name: 'Mock Network',
          buyer_status: 'active',
          credit_limit: 10000,
          current_balance: 5000,
          supplier_status: 'active',
          credit_balance: 2000,
          margin_percentage: 20,
          routing_rules: [],
          quality_thresholds: {
            minimum_duration: 30,
            maximum_duration: 3600,
            required_fields: ['phone', 'email'],
            blocked_numbers: [],
            allowed_states: [],
            business_hours: {
              timezone: 'America/New_York',
              schedule: {}
            }
          },
          approved_suppliers: [],
          approved_buyers: [],
          settings: {
            auto_accept_calls: false,
            auto_route_calls: true,
            margin_type: 'percentage',
            minimum_margin: 5,
            payment_terms: 30,
            notifications: {
              email_alerts: true,
              sms_alerts: false,
              webhook_url: undefined,
              alert_thresholds: {
                low_margin: 10,
                high_rejection_rate: 30,
                low_quality_score: 70
              }
            }
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          // created_at: new Date().toISOString(), // Not in NetworkCampaign interface
          // updated_at: new Date().toISOString()
        }
        set({ network: mockNetwork, isLoading: false })
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to fetch network data',
          isLoading: false,
        })
      }
    },

    fetchCampaigns: async () => {
      set({ isLoading: true, error: null })
      try {
        // Mock campaigns data
        const mockCampaigns: NetworkCampaign[] = [
          {
            id: '1',
            network_id: '1',
            name: 'Mock Campaign 1',
            status: 'active',
            supplier_campaigns: [],
            source_filters: [],
            buyer_campaigns: [],
            distribution_rules: [],
            floor_price: 0,
            ceiling_price: 100,
            current_count: 0
          }
        ]
        set({ campaigns: mockCampaigns, isLoading: false })
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to fetch campaigns',
          isLoading: false,
        })
      }
    },

    fetchRelationships: async () => {
      set({ isLoading: true, error: null })
      try {
        // Mock relationships data
        const mockRelationships: NetworkRelationship[] = [
          {
            id: '1',
            network_id: '1',
            entity_id: '1',
            entity_type: 'supplier',
            status: 'active',
            notes: 'Primary supplier relationship',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]
        set({ relationships: mockRelationships, isLoading: false })
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to fetch relationships',
          isLoading: false,
        })
      }
    },

    fetchMetrics: async () => {
      set({ isLoading: true, error: null })
      try {
        // Mock metrics data
        const mockMetrics: NetworkMetrics = {
          network_id: '1',
          date: new Date().toISOString(),
          calls_purchased: 500,
          total_cost: 12500,
          average_cost_per_call: 25.0,
          calls_sold: 1000,
          total_revenue: 25000,
          average_revenue_per_call: 25.0,
          gross_margin: 12500,
          net_margin: 10000,
          rejection_rate: 5.0,
          quality_score: 85.0
        }
        set({ metrics: mockMetrics, isLoading: false })
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to fetch metrics',
          isLoading: false,
        })
      }
    },

    createCampaign: async (campaign: Partial<NetworkCampaign>) => {
      set({ isLoading: true, error: null })
      try {
        // Mock create campaign
        const newCampaign: NetworkCampaign = {
          id: Date.now().toString(),
          network_id: '1',
          name: campaign.name || 'New Campaign',
          status: 'active',
          supplier_campaigns: [],
          source_filters: [],
          buyer_campaigns: [],
          distribution_rules: [],
          floor_price: 0,
          ceiling_price: 100,
          current_count: 0
        }
        
        const currentCampaigns = get().campaigns
        set({ campaigns: [...currentCampaigns, newCampaign], isLoading: false })
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to create campaign',
          isLoading: false,
        })
      }
    },

    updateCampaign: async (id: string, updates: Partial<NetworkCampaign>) => {
      set({ isLoading: true, error: null })
      try {
        // Mock update campaign
        const currentCampaigns = get().campaigns
        const updatedCampaigns = currentCampaigns.map((campaign: NetworkCampaign) =>
          campaign.id === id ? { ...campaign, ...updates, updated_at: new Date().toISOString() } : campaign
        )
        set({ campaigns: updatedCampaigns, isLoading: false })
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to update campaign',
          isLoading: false,
        })
      }
    },

    deleteCampaign: async (id: string) => {
      set({ isLoading: true, error: null })
      try {
        // Mock delete campaign
        const currentCampaigns = get().campaigns
        const filteredCampaigns = currentCampaigns.filter((campaign: NetworkCampaign) => campaign.id !== id)
        set({ campaigns: filteredCampaigns, isLoading: false })
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to delete campaign',
          isLoading: false,
        })
      }
    },

    addRelationship: async () => {
      set({ isLoading: true, error: null })
      try {
        // Mock add relationship
        const newRelationship: NetworkRelationship = {
          id: Date.now().toString(),
          network_id: '1',
          entity_id: '1',
          entity_type: 'supplier',
          status: 'active',
          notes: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        const currentRelationships = get().relationships
        set({ relationships: [...currentRelationships, newRelationship], isLoading: false })
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to add relationship',
          isLoading: false,
        })
      }
    },

    updateRelationship: async (id: string, updates: Partial<NetworkRelationship>) => {
      set({ isLoading: true, error: null })
      try {
        // Mock update relationship
        const currentRelationships = get().relationships
        const updatedRelationships = currentRelationships.map((rel: NetworkRelationship) =>
          rel.id === id ? { ...rel, ...updates } : rel
        )
        set({ relationships: updatedRelationships, isLoading: false })
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to update relationship',
          isLoading: false,
        })
      }
    },

    removeRelationship: async (id: string) => {
      set({ isLoading: true, error: null })
      try {
        // Mock remove relationship
        const currentRelationships = get().relationships
        const filteredRelationships = currentRelationships.filter((rel: NetworkRelationship) => rel.id !== id)
        set({ relationships: filteredRelationships, isLoading: false })
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to remove relationship',
          isLoading: false,
        })
      }
    },

    clearError: () => set({ error: null }),
    reset: () => set(initialState),
  }))
)

// Import the new v2 implementation
let useNetworkStoreV2: any
try {
  const v2Module = require('./networkStore.v2')
  useNetworkStoreV2 = v2Module.useNetworkStore
} catch (error) {
  console.warn('[Network Store] v2 implementation not available, using legacy')
}

// Export the appropriate implementation based on feature flag
export const useNetworkStore = (() => {
  if (import.meta.env.VITE_USE_STANDARD_STORE === 'true' && useNetworkStoreV2) {
    console.log('[Network Store] Using v2 implementation with standard middleware')
    return useNetworkStoreV2
  } else {
    console.log('[Network Store] Using legacy implementation')
    return useNetworkStoreLegacy
  }
})()