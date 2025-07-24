import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import type {
  Network,
  NetworkCampaign,
  NetworkMetrics,
  NetworkRelationship,
  RoutingRule,
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
  selectedMode: 'buyer' | 'supplier' | 'network'

  // Actions
  setNetwork: (network: Network | null) => void
  setSelectedMode: (mode: 'buyer' | 'supplier' | 'network') => void
  fetchNetworkData: (networkId: string) => Promise<void>
  fetchCampaigns: () => Promise<void>
  fetchRelationships: () => Promise<void>
  fetchMetrics: (dateRange: { start: string; end: string }) => Promise<void>

  // Campaign management
  createCampaign: (campaign: Partial<NetworkCampaign>) => Promise<NetworkCampaign>
  updateCampaign: (id: string, updates: Partial<NetworkCampaign>) => Promise<void>
  deleteCampaign: (id: string) => Promise<void>

  // Relationship management
  addRelationship: (relationship: Partial<NetworkRelationship>) => Promise<NetworkRelationship>
  updateRelationship: (id: string, updates: Partial<NetworkRelationship>) => Promise<void>
  removeRelationship: (id: string) => Promise<void>

  // Routing management
  updateRoutingRules: (rules: RoutingRule[]) => Promise<void>

  // Real-time subscriptions
  subscribeToUpdates: () => () => void

  // Reset
  reset: () => void
}

export const useNetworkStore = create<NetworkState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    network: null,
    campaigns: [],
    relationships: [],
    metrics: null,
    isLoading: false,
    error: null,
    selectedMode: 'network',

    // Basic setters
    setNetwork: (network) => set({ network }),
    setSelectedMode: (mode) => set({ selectedMode: mode }),

    // Fetch network data
    fetchNetworkData: async (networkId) => {
      set({ isLoading: true, error: null })
      try {
        const { data, error } = await supabase
          .from('networks')
          .select('*')
          .eq('id', networkId)
          .single()

        if (error) throw error
        set({ network: data, isLoading: false })
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to fetch network data',
          isLoading: false,
        })
      }
    },

    // Fetch campaigns
    fetchCampaigns: async () => {
      const { network } = get()
      if (!network) return

      set({ isLoading: true, error: null })
      try {
        const { data, error } = await supabase
          .from('network_campaigns')
          .select('*')
          .eq('network_id', network.id)
          .order('created_at', { ascending: false })

        if (error) throw error
        set({ campaigns: data || [], isLoading: false })
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to fetch campaigns',
          isLoading: false,
        })
      }
    },

    // Fetch relationships
    fetchRelationships: async () => {
      const { network } = get()
      if (!network) return

      set({ isLoading: true, error: null })
      try {
        const { data, error } = await supabase
          .from('network_relationships')
          .select('*')
          .eq('network_id', network.id)

        if (error) throw error
        set({ relationships: data || [], isLoading: false })
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to fetch relationships',
          isLoading: false,
        })
      }
    },

    // Fetch metrics
    fetchMetrics: async (dateRange) => {
      const { network } = get()
      if (!network) return

      set({ isLoading: true, error: null })
      try {
        const { data, error } = await supabase
          .from('network_metrics')
          .select('*')
          .eq('network_id', network.id)
          .gte('date', dateRange.start)
          .lte('date', dateRange.end)
          .single()

        if (error) throw error
        set({ metrics: data, isLoading: false })
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to fetch metrics',
          isLoading: false,
        })
      }
    },

    // Create campaign
    createCampaign: async (campaign) => {
      const { network } = get()
      if (!network) throw new Error('No network selected')

      const { data, error } = await supabase
        .from('network_campaigns')
        .insert({
          ...campaign,
          network_id: network.id,
        })
        .select()
        .single()

      if (error) throw error

      set((state) => ({
        campaigns: [data, ...state.campaigns],
      }))

      return data
    },

    // Update campaign
    updateCampaign: async (id, updates) => {
      const { data, error } = await supabase
        .from('network_campaigns')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      set((state) => ({
        campaigns: state.campaigns.map((c) => (c.id === id ? data : c)),
      }))
    },

    // Delete campaign
    deleteCampaign: async (id) => {
      const { error } = await supabase.from('network_campaigns').delete().eq('id', id)

      if (error) throw error

      set((state) => ({
        campaigns: state.campaigns.filter((c) => c.id !== id),
      }))
    },

    // Add relationship
    addRelationship: async (relationship) => {
      const { network } = get()
      if (!network) throw new Error('No network selected')

      const { data, error } = await supabase
        .from('network_relationships')
        .insert({
          ...relationship,
          network_id: network.id,
        })
        .select()
        .single()

      if (error) throw error

      set((state) => ({
        relationships: [...state.relationships, data],
      }))

      return data
    },

    // Update relationship
    updateRelationship: async (id, updates) => {
      const { data, error } = await supabase
        .from('network_relationships')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      set((state) => ({
        relationships: state.relationships.map((r) => (r.id === id ? data : r)),
      }))
    },

    // Remove relationship
    removeRelationship: async (id) => {
      const { error } = await supabase.from('network_relationships').delete().eq('id', id)

      if (error) throw error

      set((state) => ({
        relationships: state.relationships.filter((r) => r.id !== id),
      }))
    },

    // Update routing rules
    updateRoutingRules: async (rules) => {
      const { network } = get()
      if (!network) throw new Error('No network selected')

      const { error } = await supabase
        .from('networks')
        .update({ routing_rules: rules })
        .eq('id', network.id)

      if (error) throw error

      set((state) => ({
        network: state.network ? { ...state.network, routing_rules: rules } : null,
      }))
    },

    // Subscribe to real-time updates
    subscribeToUpdates: () => {
      const { network } = get()
      if (!network) return () => {}

      // Subscribe to campaign updates
      const campaignSub = supabase
        .channel(`network-campaigns-${network.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'network_campaigns',
            filter: `network_id=eq.${network.id}`,
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              set((state) => ({
                campaigns: [payload.new as NetworkCampaign, ...state.campaigns],
              }))
            } else if (payload.eventType === 'UPDATE') {
              set((state) => ({
                campaigns: state.campaigns.map((c) =>
                  c.id === payload.new.id ? (payload.new as NetworkCampaign) : c
                ),
              }))
            } else if (payload.eventType === 'DELETE') {
              set((state) => ({
                campaigns: state.campaigns.filter((c) => c.id !== payload.old.id),
              }))
            }
          }
        )
        .subscribe()

      // Subscribe to metrics updates
      const metricsSub = supabase
        .channel(`network-metrics-${network.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'network_metrics',
            filter: `network_id=eq.${network.id}`,
          },
          (payload) => {
            if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
              set({ metrics: payload.new as NetworkMetrics })
            }
          }
        )
        .subscribe()

      // Return cleanup function
      return () => {
        campaignSub.unsubscribe()
        metricsSub.unsubscribe()
      }
    },

    // Reset store
    reset: () =>
      set({
        network: null,
        campaigns: [],
        relationships: [],
        metrics: null,
        isLoading: false,
        error: null,
        selectedMode: 'network',
      }),
  }))
)
