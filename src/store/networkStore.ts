/**
 * Network Store - Migrated to Standard Store Factory
 * 
 * This store manages network-related state including campaigns, relationships,
 * and metrics. Migrated from manual middleware setup to standardized factory.
 * 
 * Changes from v1:
 * - Uses createDataStore factory for consistent middleware chain
 * - Immer integration for immutable updates 
 * - Proper TypeScript types with StandardStateCreator
 * - Monitoring integration for performance tracking
 * - Feature flag compatibility for gradual rollout
 */

import { createDataStore } from './factories/createStandardStore'
import type { StandardStateCreator } from './types/mutators'
import type {
  Network,
  NetworkCampaign,
  NetworkMetrics,
  NetworkRelationship,
} from '../types/network'

// Network Store State Interface
export interface NetworkState {
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
  
  // Async actions
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

// Initial state
const initialState = {
  network: null,
  campaigns: [],
  relationships: [],
  metrics: null,
  isLoading: false,
  error: null,
  selectedMode: 'network' as const,
}

// Create the store state using standard factory pattern
const createNetworkStoreState: StandardStateCreator<NetworkState> = (set, _get) => ({
  ...initialState,

  // Basic setters
  setNetwork: (network) => {
    set((state) => {
      state.network = network
    })
  },

  setSelectedMode: (mode) => {
    set((state) => {
      state.selectedMode = mode
    })
  },

  // Async actions with proper Immer usage
  fetchNetworkData: async (networkId: string) => {
    set((state) => {
      state.isLoading = true
      state.error = null
    })

    try {
      // Mock network data - replace with actual API call
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
      }

      set((state) => {
        state.network = mockNetwork
        state.isLoading = false
      })
    } catch (error) {
      set((state) => {
        state.error = error instanceof Error ? error.message : 'Failed to fetch network data'
        state.isLoading = false
      })
    }
  },

  fetchCampaigns: async () => {
    set((state) => {
      state.isLoading = true
      state.error = null
    })

    try {
      // Mock campaigns data - replace with actual API call
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

      set((state) => {
        state.campaigns = mockCampaigns
        state.isLoading = false
      })
    } catch (error) {
      set((state) => {
        state.error = error instanceof Error ? error.message : 'Failed to fetch campaigns'
        state.isLoading = false
      })
    }
  },

  fetchRelationships: async () => {
    set((state) => {
      state.isLoading = true
      state.error = null
    })

    try {
      // Mock relationships data - replace with actual API call
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

      set((state) => {
        state.relationships = mockRelationships
        state.isLoading = false
      })
    } catch (error) {
      set((state) => {
        state.error = error instanceof Error ? error.message : 'Failed to fetch relationships'
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
      // Mock metrics data - replace with actual API call
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

      set((state) => {
        state.metrics = mockMetrics
        state.isLoading = false
      })
    } catch (error) {
      set((state) => {
        state.error = error instanceof Error ? error.message : 'Failed to fetch metrics'
        state.isLoading = false
      })
    }
  },

  createCampaign: async (campaignData: Partial<NetworkCampaign>) => {
    set((state) => {
      state.isLoading = true
      state.error = null
    })

    try {
      // Mock create campaign - replace with actual API call
      const newCampaign: NetworkCampaign = {
        id: Date.now().toString(),
        network_id: '1',
        name: campaignData.name || 'New Campaign',
        status: 'active',
        supplier_campaigns: [],
        source_filters: [],
        buyer_campaigns: [],
        distribution_rules: [],
        floor_price: 0,
        ceiling_price: 100,
        current_count: 0,
        ...campaignData
      }
      
      set((state) => {
        state.campaigns.push(newCampaign)
        state.isLoading = false
      })
    } catch (error) {
      set((state) => {
        state.error = error instanceof Error ? error.message : 'Failed to create campaign'
        state.isLoading = false
      })
    }
  },

  updateCampaign: async (id: string, updates: Partial<NetworkCampaign>) => {
    set((state) => {
      state.isLoading = true
      state.error = null
    })

    try {
      // Mock update campaign - replace with actual API call
      set((state) => {
        const campaignIndex = state.campaigns.findIndex((campaign) => campaign.id === id)
        if (campaignIndex !== -1) {
          Object.assign(state.campaigns[campaignIndex], updates)
        }
        state.isLoading = false
      })
    } catch (error) {
      set((state) => {
        state.error = error instanceof Error ? error.message : 'Failed to update campaign'
        state.isLoading = false
      })
    }
  },

  deleteCampaign: async (id: string) => {
    set((state) => {
      state.isLoading = true
      state.error = null
    })

    try {
      // Mock delete campaign - replace with actual API call
      set((state) => {
        state.campaigns = state.campaigns.filter((campaign) => campaign.id !== id)
        state.isLoading = false
      })
    } catch (error) {
      set((state) => {
        state.error = error instanceof Error ? error.message : 'Failed to delete campaign'
        state.isLoading = false
      })
    }
  },

  addRelationship: async (relationshipData: Partial<NetworkRelationship>) => {
    set((state) => {
      state.isLoading = true
      state.error = null
    })

    try {
      // Mock add relationship - replace with actual API call
      const newRelationship: NetworkRelationship = {
        id: Date.now().toString(),
        network_id: '1',
        entity_id: relationshipData.entity_id || '1',
        entity_type: relationshipData.entity_type || 'supplier',
        status: 'active',
        notes: relationshipData.notes || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...relationshipData
      }
      
      set((state) => {
        state.relationships.push(newRelationship)
        state.isLoading = false
      })
    } catch (error) {
      set((state) => {
        state.error = error instanceof Error ? error.message : 'Failed to add relationship'
        state.isLoading = false
      })
    }
  },

  updateRelationship: async (id: string, updates: Partial<NetworkRelationship>) => {
    set((state) => {
      state.isLoading = true
      state.error = null
    })

    try {
      // Mock update relationship - replace with actual API call
      set((state) => {
        const relationshipIndex = state.relationships.findIndex((rel) => rel.id === id)
        if (relationshipIndex !== -1) {
          state.relationships[relationshipIndex] = {
            ...state.relationships[relationshipIndex],
            ...updates,
            updated_at: new Date().toISOString()
          }
        }
        state.isLoading = false
      })
    } catch (error) {
      set((state) => {
        state.error = error instanceof Error ? error.message : 'Failed to update relationship'
        state.isLoading = false
      })
    }
  },

  removeRelationship: async (id: string) => {
    set((state) => {
      state.isLoading = true
      state.error = null
    })

    try {
      // Mock remove relationship - replace with actual API call
      set((state) => {
        state.relationships = state.relationships.filter((rel) => rel.id !== id)
        state.isLoading = false
      })
    } catch (error) {
      set((state) => {
        state.error = error instanceof Error ? error.message : 'Failed to remove relationship'
        state.isLoading = false
      })
    }
  },

  clearError: () => {
    set((state) => {
      state.error = null
    })
  },

  reset: () => {
    set(() => initialState)
  },
})

// Create the store using the data store factory (includes monitoring and performance tracking)
export const useNetworkStore = createDataStore<NetworkState>(
  'network-store',
  createNetworkStoreState
  // No persistence needed for network store - session only
)

// Selectors for common access patterns
export const useNetworkData = () => useNetworkStore((state) => state.network)
export const useNetworkCampaigns = () => useNetworkStore((state) => state.campaigns)
export const useNetworkRelationships = () => useNetworkStore((state) => state.relationships)
export const useNetworkMetrics = () => useNetworkStore((state) => state.metrics)
export const useNetworkLoading = () => useNetworkStore((state) => ({
  isLoading: state.isLoading,
  error: state.error,
}))
export const useNetworkSelectedMode = () => useNetworkStore((state) => state.selectedMode)

// Development helpers
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  ;(window as unknown as Record<string, unknown>).__networkStore = useNetworkStore
}