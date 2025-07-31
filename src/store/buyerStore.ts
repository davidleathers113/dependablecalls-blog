import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { from, getSession } from '../lib/supabase-optimized'
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

interface BuyerStore {
  // Existing state
  currentBalance: number
  creditLimit: number
  campaigns: Campaign[]
  
  // New marketplace state
  listings: MarketplaceListing[]
  searchFilters: SearchFilters
  savedSearches: SavedSearch[]
  
  // Purchase state
  purchases: Purchase[]
  activePurchases: Purchase[]
  
  // Analytics state
  metrics: BuyerMetrics | null
  dashboardData: BuyerDashboardData | null
  
  // UI state
  isLoading: boolean
  error: string | null

  // Existing actions
  fetchBalance: (buyerId: string) => Promise<void>
  updateBalance: (newBalance: number) => void
  fetchCampaigns: (buyerId: string) => Promise<void>
  updateCampaign: (campaignId: string, updates: Partial<Campaign>) => void
  
  // New marketplace actions
  setListings: (listings: MarketplaceListing[]) => void
  setSearchFilters: (filters: SearchFilters) => void
  setSavedSearches: (searches: SavedSearch[]) => void
  setPurchases: (purchases: Purchase[]) => void
  setMetrics: (metrics: BuyerMetrics) => void
  setDashboardData: (data: BuyerDashboardData) => void
  
  // Async marketplace actions
  searchMarketplace: (filters: SearchFilters) => Promise<void>
  saveSearch: (name: string, filters: SearchFilters, alertEnabled: boolean) => Promise<void>
  createPurchase: (request: PurchaseRequest) => Promise<Purchase>
  fetchPurchases: () => Promise<void>
  fetchMetrics: () => Promise<void>
  fetchDashboardData: () => Promise<void>
  
  // Purchase management
  cancelPurchase: (purchaseId: string) => Promise<void>
  pausePurchase: (purchaseId: string) => Promise<void>
  resumePurchase: (purchaseId: string) => Promise<void>
  
  // Utility actions
  clearError: () => void
  reset: () => void
}

const initialState = {
  currentBalance: 0,
  creditLimit: 0,
  campaigns: [],
  listings: [],
  searchFilters: {},
  savedSearches: [],
  purchases: [],
  activePurchases: [],
  metrics: null,
  dashboardData: null,
  isLoading: false,
  error: null,
}

export const useBuyerStore = create<BuyerStore>()(
  devtools(
    subscribeWithSelector(
      persist(
        (set, get) => ({
          ...initialState,

          // Existing actions
          fetchBalance: async (buyerId: string) => {
            set({ isLoading: true, error: null })

            try {
              const { data, error } = await from('buyers')
                .select('current_balance, credit_limit')
                .eq('id', buyerId)
                .single()

              if (error) throw error

              set({
                currentBalance: data.current_balance || 0,
                creditLimit: data.credit_limit || 0,
                isLoading: false,
              })
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to fetch balance'
              set({ error: message, isLoading: false })
            }
          },

          updateBalance: (newBalance: number) => {
            set({ currentBalance: newBalance })
          },

          fetchCampaigns: async (buyerId: string) => {
            set({ isLoading: true, error: null })

            try {
              const { data, error } = await from('buyer_campaigns')
                .select('*')
                .eq('buyer_id', buyerId)
                .order('created_at', { ascending: false })

              if (error) throw error

              set({
                campaigns: data || [],
                isLoading: false,
              })
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to fetch campaigns'
              set({ error: message, isLoading: false })
            }
          },

          updateCampaign: (campaignId: string, updates: Partial<Campaign>) => {
            set((state: BuyerStore) => ({
              campaigns: state.campaigns.map((campaign: Campaign) =>
                campaign.id === campaignId ? { ...campaign, ...updates } : campaign
              ),
            }))
          },

          // New marketplace actions
          setListings: (listings: MarketplaceListing[]) => set({ listings }),
          setSearchFilters: (searchFilters: SearchFilters) => set({ searchFilters }),
          setSavedSearches: (savedSearches: SavedSearch[]) => set({ savedSearches }),
          setPurchases: (purchases: Purchase[]) => {
            const activePurchases = purchases.filter((p: Purchase) => 
              ['approved', 'active'].includes(p.status)
            )
            set({ purchases, activePurchases })
          },
          setMetrics: (metrics: BuyerMetrics) => set({ metrics }),
          setDashboardData: (dashboardData: BuyerDashboardData) => set({ dashboardData }),

          // Marketplace search (mock implementation)
          searchMarketplace: async (filters: SearchFilters) => {
            set({ isLoading: true, error: null })
            try {
              // Mock marketplace data since marketplace_listings table doesn't exist
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
                },
                {
                  id: '2',
                  campaign_id: 'campaign-2',
                  supplier_id: '2',
                  supplier_name: 'Quality Home Services',
                  vertical: 'home_services',
                  description: 'Home improvement and repair service leads',
                  price_per_call: 30.00,
                  quality_score: 85,
                  estimated_volume: 75,
                  geographic_coverage: ['TX', 'FL'],
                  availability_hours: {
                    start: '08:00',
                    end: '18:00',
                    timezone: 'CST'
                  },
                  call_caps: {
                    daily: 40,
                    weekly: 250,
                    monthly: 1000
                  },
                  filters: {
                    states: ['TX', 'FL'],
                    age_range: [30, 70],
                    income_range: [40000, 120000]
                  },
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }
              ]

              // Apply basic filtering to mock data
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

              set({ listings: filteredListings, searchFilters: filters })
            } catch (error) {
              set({ error: error instanceof Error ? error.message : 'Failed to search marketplace' })
            } finally {
              set({ isLoading: false })
            }
          },

          // Save search (mock implementation)
          saveSearch: async (name: string, filters: SearchFilters, alertEnabled: boolean) => {
            set({ isLoading: true, error: null })
            try {
              const { data: session } = await getSession()
              if (!session.session?.user) throw new Error('Not authenticated')

              // Mock saved search since saved_searches table doesn't exist
              const newSearch: SavedSearch = {
                id: Date.now().toString(),
                buyer_id: session.session.user.id,
                name,
                filters,
                alert_enabled: alertEnabled,
                last_results_count: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }

              const currentSearches = get().savedSearches
              set({ savedSearches: [...currentSearches, newSearch] })
            } catch (error) {
              set({ error: error instanceof Error ? error.message : 'Failed to save search' })
            } finally {
              set({ isLoading: false })
            }
          },

          // Create purchase (mock implementation)
          createPurchase: async (request: PurchaseRequest): Promise<Purchase> => {
            set({ isLoading: true, error: null })
            try {
              const { data: session } = await getSession()
              if (!session.session?.user) throw new Error('Not authenticated')

              // Mock purchase since purchases table doesn't exist
              const newPurchase: Purchase = {
                id: Date.now().toString(),
                buyer_id: session.session.user.id,
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

              const currentPurchases = get().purchases
              set({ purchases: [...currentPurchases, newPurchase] })

              return newPurchase
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Failed to create purchase'
              set({ error: errorMessage })
              throw new Error(errorMessage)
            } finally {
              set({ isLoading: false })
            }
          },

          // Fetch purchases
          fetchPurchases: async () => {
            set({ isLoading: true, error: null })
            try {
              const { data: session } = await getSession()
              if (!session.session?.user) throw new Error('Not authenticated')

              // Mock data since purchases table doesn't exist
              set({ purchases: [] })
            } catch (error) {
              set({ error: error instanceof Error ? error.message : 'Failed to fetch purchases' })
            } finally {
              set({ isLoading: false })
            }
          },

          // Fetch metrics
          fetchMetrics: async () => {
            set({ isLoading: true, error: null })
            try {
              const { data: session } = await getSession()
              if (!session.session?.user) throw new Error('Not authenticated')

              // Mock metrics since get_buyer_metrics RPC doesn't exist
              const mockMetrics: BuyerMetrics = {
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

              set({ metrics: mockMetrics })
            } catch (error) {
              set({ error: error instanceof Error ? error.message : 'Failed to fetch metrics' })
            } finally {
              set({ isLoading: false })
            }
          },

          // Fetch dashboard data
          fetchDashboardData: async () => {
            set({ isLoading: true, error: null })
            try {
              const { data: session } = await getSession()
              if (!session.session?.user) throw new Error('Not authenticated')

              // Mock dashboard data since get_buyer_dashboard RPC doesn't exist
              const mockDashboardData: BuyerDashboardData = {
                metrics: {
                  total_spent: 5000,
                  total_calls: 250,
                  total_conversions: 39,
                  average_cost_per_call: 20.0,
                  average_cost_per_acquisition: 128.2,
                  conversion_rate: 15.5,
                  roi_percentage: 125.5,
                  active_campaigns: 5,
                  top_performing_verticals: []
                },
                recent_purchases: [],
                active_campaigns: [
                  {
                    id: '1',
                    name: 'Insurance Lead Campaign',
                    status: 'active',
                    calls_today: 5,
                    conversions_today: 2,
                    spend_today: 150
                  }
                ],
                budget_alerts: [],
                market_opportunities: []
              }

              set({ dashboardData: mockDashboardData })
            } catch (error) {
              set({ error: error instanceof Error ? error.message : 'Failed to fetch dashboard data' })
            } finally {
              set({ isLoading: false })
            }
          },

          // Purchase management actions (mock implementation)
          cancelPurchase: async (purchaseId: string) => {
            set({ isLoading: true, error: null })
            try {
              // Mock cancel purchase since purchases table doesn't exist
              const currentPurchases = get().purchases
              const updatedPurchases = currentPurchases.map((p: Purchase) =>
                p.id === purchaseId ? { ...p, status: 'cancelled' as const } : p
              )
              set({ purchases: updatedPurchases })
            } catch (error) {
              set({ error: error instanceof Error ? error.message : 'Failed to cancel purchase' })
            } finally {
              set({ isLoading: false })
            }
          },

          pausePurchase: async (purchaseId: string) => {
            set({ isLoading: true, error: null })
            try {
              // Mock pause purchase since purchases table doesn't exist
              const currentPurchases = get().purchases
              const updatedPurchases = currentPurchases.map((p: Purchase) =>
                p.id === purchaseId ? { ...p, status: 'paused' as const } : p
              )
              set({ purchases: updatedPurchases })
            } catch (error) {
              set({ error: error instanceof Error ? error.message : 'Failed to pause purchase' })
            } finally {
              set({ isLoading: false })
            }
          },

          resumePurchase: async (purchaseId: string) => {
            set({ isLoading: true, error: null })
            try {
              // Mock resume purchase since purchases table doesn't exist
              const currentPurchases = get().purchases
              const updatedPurchases = currentPurchases.map((p: Purchase) =>
                p.id === purchaseId ? { ...p, status: 'active' as const } : p
              )
              set({ purchases: updatedPurchases })
            } catch (error) {
              set({ error: error instanceof Error ? error.message : 'Failed to resume purchase' })
            } finally {
              set({ isLoading: false })
            }
          },

          clearError: () => set({ error: null }),

          reset: () => set(initialState),
        }),
        {
          name: 'buyer-store',
          partialize: (state) => ({
            currentBalance: state.currentBalance,
            creditLimit: state.creditLimit,
            campaigns: state.campaigns,
            savedSearches: state.savedSearches,
          }),
        }
      )
    ),
    {
      name: 'buyer-store',
    }
  )
)
