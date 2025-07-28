import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { from, getSession } from '../lib/supabase-optimized'
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
import type { Database, Json } from '../types/database'

// Helper function to map call status to sale status
const mapCallStatusToSaleStatus = (callStatus: Database['public']['Enums']['call_status'] | null): SaleStatus => {
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

interface SupplierState {
  // Inventory state
  listings: CallListing[]
  inventory: InventoryItem[]
  
  // Sales state
  metrics: SalesMetrics | null
  sales: Sale[]
  
  // Lead management state
  leadSources: LeadSource[]
  qualityScoring: QualityScoring[]
  
  // Dashboard state
  dashboardData: SupplierDashboardData | null
  
  // UI state
  loading: boolean
  error: string | null
  
  // Actions
  setListings: (listings: CallListing[]) => void
  setInventory: (inventory: InventoryItem[]) => void
  setMetrics: (metrics: SalesMetrics) => void
  setSales: (sales: Sale[]) => void
  setLeadSources: (leadSources: LeadSource[]) => void
  setQualityScoring: (qualityScoring: QualityScoring[]) => void
  setDashboardData: (data: SupplierDashboardData) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  // Inventory management
  createListing: (listing: CallListingForm) => Promise<CallListing>
  updateListing: (id: string, updates: Partial<CallListingForm>) => Promise<void>
  deleteListing: (id: string) => Promise<void>
  bulkUpload: (file: File) => Promise<BulkUploadResult>
  updatePricing: (listingId: string, strategy: PricingStrategyForm) => Promise<void>
  fetchListings: () => Promise<void>
  fetchInventory: () => Promise<void>
  
  // Sales analytics
  fetchMetrics: () => Promise<void>
  fetchSales: () => Promise<void>
  exportSalesData: (format: 'csv' | 'pdf', timeframe: string) => Promise<void>
  
  // Lead management
  createLeadSource: (source: LeadSourceForm) => Promise<LeadSource>
  updateLeadSource: (id: string, updates: Partial<LeadSourceForm>) => Promise<void>
  deleteLeadSource: (id: string) => Promise<void>
  fetchLeadSources: () => Promise<void>
  analyzeLeadQuality: (leadId: string) => Promise<QualityScoring>
  
  // Dashboard
  fetchDashboardData: () => Promise<void>
  
  // Utility actions
  clearError: () => void
  reset: () => void
}

const initialState = {
  listings: [],
  inventory: [],
  metrics: null,
  sales: [],
  leadSources: [],
  qualityScoring: [],
  dashboardData: null,
  loading: false,
  error: null,
}

export const useSupplierStore = create<SupplierState>()(
  devtools(
    subscribeWithSelector(
      persist(
        (set, get) => ({
          ...initialState,

          // Simple setters
          setListings: (listings) => set({ listings }),
          setInventory: (inventory) => set({ inventory }),
          setMetrics: (metrics) => set({ metrics }),
          setSales: (sales) => set({ sales }),
          setLeadSources: (leadSources) => set({ leadSources }),
          setQualityScoring: (qualityScoring) => set({ qualityScoring }),
          setDashboardData: (dashboardData) => set({ dashboardData }),
          setLoading: (loading) => set({ loading }),
          setError: (error) => set({ error }),

          // Create listing
          createListing: async (listing: CallListingForm): Promise<CallListing> => {
            set({ loading: true, error: null })
            try {
              const { data: session } = await getSession()
              if (!session.session?.user) throw new Error('Not authenticated')

              // Map CallListingForm fields to campaigns table fields
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
                schedule: {
                  hours: listing.availability_hours,
                  days: listing.availability_hours.days,
                } as unknown as Json,
                targeting: {
                  geographic_coverage: listing.geographic_coverage,
                  filters: listing.filters,
                } as unknown as Json,
              }

              const { data, error } = await from('campaigns')
                .insert(campaignData)
                .select()
                .single()

              if (error) throw error

              // Transform campaign data to CallListing format
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

              const currentListings = get().listings
              set({ listings: [...currentListings, newListing] })
              set({ listings: [...currentListings, newListing] })

              return newListing
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Failed to create listing'
              set({ error: errorMessage })
              throw new Error(errorMessage)
            } finally {
              set({ loading: false })
            }
          },

          // Update listing
          updateListing: async (id: string, updates: Partial<CallListingForm>) => {
            set({ loading: true, error: null })
            try {
              // Map CallListingForm updates to campaigns table fields
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
              if (updates.availability_hours !== undefined) {
                campaignUpdates.schedule = {
                  hours: updates.availability_hours,
                  days: updates.availability_hours.days,
                } as unknown as Json
              }
              if (updates.geographic_coverage !== undefined || updates.filters !== undefined) {
                campaignUpdates.targeting = {
                  geographic_coverage: updates.geographic_coverage,
                  filters: updates.filters,
                } as unknown as Json
              }

              const { error } = await from('campaigns')
                .update(campaignUpdates)
                .eq('id', id)

              if (error) throw error

              const currentListings = get().listings
              const updatedListings = currentListings.map(listing =>
                listing.id === id ? { ...listing, ...updates } : listing
              )
              set({ listings: updatedListings })
            } catch (error) {
              set({ error: error instanceof Error ? error.message : 'Failed to update listing' })
            } finally {
              set({ loading: false })
            }
          },

          // Delete listing
          deleteListing: async (id: string) => {
            set({ loading: true, error: null })
            try {
              // Mock: call_listings table doesn't exist, using campaigns instead
              const { error } = await from('campaigns')
                .delete()
                .eq('id', id)

              if (error) throw error

              const currentListings = get().listings
              set({ listings: currentListings.filter(listing => listing.id !== id) })
            } catch (error) {
              set({ error: error instanceof Error ? error.message : 'Failed to delete listing' })
            } finally {
              set({ loading: false })
            }
          },

          // Bulk upload
          bulkUpload: async (file: File): Promise<BulkUploadResult> => {
            set({ loading: true, error: null })
            try {
              // In a real implementation, this would parse the CSV file
              // and create multiple listings. For now, we'll simulate the process.
              
              const formData = new FormData()
              formData.append('file', file)

              // Mock processing
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

              return mockResult
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Failed to bulk upload'
              set({ error: errorMessage })
              throw new Error(errorMessage)
            } finally {
              set({ loading: false })
            }
          },

          // Update pricing strategy
          updatePricing: async (listingId: string, strategy: PricingStrategyForm) => {
            set({ loading: true, error: null })
            try {
              // Mock: pricing_strategies table doesn't exist
              const error = null // Mock success

              if (error) throw error

              // Update the listing's price if it's a fixed strategy
              if (strategy.strategy_type === 'fixed') {
                await get().updateListing(listingId, { price_per_call: strategy.base_price })
              }
            } catch (error) {
              set({ error: error instanceof Error ? error.message : 'Failed to update pricing' })
            } finally {
              set({ loading: false })
            }
          },

          // Fetch listings
          fetchListings: async () => {
            set({ loading: true, error: null })
            try {
              const { data: session } = await getSession()
              if (!session.session?.user) throw new Error('Not authenticated')

              // Fetch campaigns and transform to CallListing format
              const { data, error } = await from('campaigns')
                .select('*')
                .eq('supplier_id', session.session.user.id)

              if (error) throw error

              // Transform campaigns to CallListing format
              const listings: CallListing[] = (data || []).map(campaign => ({
                id: campaign.id,
                supplier_id: campaign.supplier_id || session.session.user.id,
                vertical: campaign.vertical || 'general',
                title: campaign.name,
                description: campaign.description || '',
                price_per_call: campaign.bid_floor || 0,
                quality_score: campaign.quality_threshold || 85,
                geographic_coverage: (campaign.targeting as any)?.geographic_coverage || [],
                daily_cap: campaign.daily_cap || 0,
                weekly_cap: 0, // Not stored in campaigns table
                monthly_cap: campaign.monthly_cap || 0,
                availability_hours: (campaign.schedule as any)?.hours || {
                  start: '09:00',
                  end: '17:00',
                  timezone: 'America/New_York',
                  days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                },
                filters: (campaign.targeting as any)?.filters || {
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
              }))

              set({ listings })
            } catch (error) {
              set({ error: error instanceof Error ? error.message : 'Failed to fetch listings' })
            } finally {
              set({ loading: false })
            }
          },

          // Fetch inventory
          fetchInventory: async () => {
            set({ loading: true, error: null })
            try {
              const { data: session } = await getSession()
              if (!session.session?.user) throw new Error('Not authenticated')

              // Mock: inventory_items table doesn't exist
              const data: InventoryItem[] = []
              const error = null

              if (error) throw error

              set({ inventory: data || [] })
            } catch (error) {
              set({ error: error instanceof Error ? error.message : 'Failed to fetch inventory' })
            } finally {
              set({ loading: false })
            }
          },

          // Fetch sales metrics
          fetchMetrics: async () => {
            set({ loading: true, error: null })
            try {
              const { data: session } = await getSession()
              if (!session.session?.user) throw new Error('Not authenticated')

              // Mock: get_supplier_metrics function doesn't exist
              const mockMetrics: SalesMetrics = {
                total_revenue: 15750.50,
                total_calls_sold: 245,
                average_price_per_call: 64.29,
                conversion_rate: 0.73,
                top_performing_verticals: [
                  {
                    vertical: 'insurance',
                    revenue: 8500.25,
                    calls_sold: 120,
                    average_price: 70.84,
                    profit_margin: 0.45,
                    growth_rate: 0.15
                  }
                ],
                monthly_trends: [
                  {
                    month: '2024-01',
                    revenue: 15750.50,
                    calls_sold: 245,
                    new_buyers: 8,
                    repeat_buyers: 12,
                    average_order_size: 64.29
                  }
                ],
                buyer_analytics: [],
                quality_trends: [
                  {
                    period: '2024-01',
                    average_quality_score: 8.2,
                    buyer_satisfaction: 4.1,
                    conversion_rate: 0.73,
                    fraud_incidents: 2
                  }
                ]
              }
              const error = null

              if (error) throw error

              set({ metrics: mockMetrics })
            } catch (error) {
              set({ error: error instanceof Error ? error.message : 'Failed to fetch metrics' })
            } finally {
              set({ loading: false })
            }
          },

          // Fetch sales
          fetchSales: async () => {
            set({ loading: true, error: null })
            try {
              const { data: session } = await getSession()
              if (!session.session?.user) throw new Error('Not authenticated')

              // Fetch calls and transform to Sale format
              const { data, error } = await from('calls')
                .select(`
                  *,
                  campaigns!campaign_id (name, vertical)
                `)
                .eq('campaigns.supplier_id', session.session.user.id)
                .order('created_at', { ascending: false })

              if (error) throw error

              // Transform calls to Sale format
              const sales: Sale[] = (data || []).map(call => {
                const campaign = (call as any).campaigns
                return {
                  id: call.id,
                  buyer_id: call.buyer_campaign_id || 'unknown',
                  buyer_name: 'Unknown Buyer', // Would need buyer join
                  listing_id: call.campaign_id || 'unknown',
                  vertical: campaign?.vertical || 'general',
                  quantity: 1, // Each call is one unit
                  price_per_call: call.charge_amount || 0,
                  total_amount: call.charge_amount || 0,
                  commission_amount: (call.charge_amount || 0) - (call.payout_amount || 0),
                  net_amount: call.payout_amount || 0,
                  status: mapCallStatusToSaleStatus(call.status),
                  created_at: call.created_at || new Date().toISOString(),
                  delivered_at: call.ended_at || undefined,
                }
              })

              set({ sales })
            } catch (error) {
              set({ error: error instanceof Error ? error.message : 'Failed to fetch sales' })
            } finally {
              set({ loading: false })
            }
          },

          // Export sales data
          exportSalesData: async (format: 'csv' | 'pdf', timeframe: string) => {
            set({ loading: true, error: null })
            try {
              const sales = get().sales
              const metrics = get().metrics

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
                // For PDF, download as JSON for now
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
            } catch (error) {
              set({ error: error instanceof Error ? error.message : 'Failed to export data' })
            } finally {
              set({ loading: false })
            }
          },

          // Create lead source
          createLeadSource: async (source: LeadSourceForm): Promise<LeadSource> => {
            set({ loading: true, error: null })
            try {
              const { data: session } = await getSession()
              if (!session.session?.user) throw new Error('Not authenticated')

              // Mock: lead_sources table doesn't exist
              const mockSource = {
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
              const data = mockSource
              const error = null

              if (error) throw error

              const currentSources = get().leadSources
              const newSource = data as LeadSource
              set({ leadSources: [...currentSources, newSource] })

              return newSource
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Failed to create lead source'
              set({ error: errorMessage })
              throw new Error(errorMessage)
            } finally {
              set({ loading: false })
            }
          },

          // Update lead source
          updateLeadSource: async (id: string, updates: Partial<LeadSourceForm>) => {
            set({ loading: true, error: null })
            try {
              // Mock: lead_sources table doesn't exist
              const error = null

              if (error) throw error

              const currentSources = get().leadSources
              const updatedSources = currentSources.map(source =>
                source.id === id ? { ...source, ...updates } : source
              )
              set({ leadSources: updatedSources })
            } catch (error) {
              set({ error: error instanceof Error ? error.message : 'Failed to update lead source' })
            } finally {
              set({ loading: false })
            }
          },

          // Delete lead source
          deleteLeadSource: async (id: string) => {
            set({ loading: true, error: null })
            try {
              // Mock: lead_sources table doesn't exist
              const error = null

              if (error) throw error

              const currentSources = get().leadSources
              set({ leadSources: currentSources.filter(source => source.id !== id) })
            } catch (error) {
              set({ error: error instanceof Error ? error.message : 'Failed to delete lead source' })
            } finally {
              set({ loading: false })
            }
          },

          // Fetch lead sources
          fetchLeadSources: async () => {
            set({ loading: true, error: null })
            try {
              const { data: session } = await getSession()
              if (!session.session?.user) throw new Error('Not authenticated')

              // Mock: lead_sources table doesn't exist
              const data: LeadSource[] = []
              const error = null

              if (error) throw error

              set({ leadSources: data || [] })
            } catch (error) {
              set({ error: error instanceof Error ? error.message : 'Failed to fetch lead sources' })
            } finally {
              set({ loading: false })
            }
          },

          // Analyze lead quality
          analyzeLeadQuality: async (leadId: string): Promise<QualityScoring> => {
            set({ loading: true, error: null })
            try {
              // Mock: analyze_lead_quality function doesn't exist  
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
                factors: [
                  {
                    factor: 'demographics_match',
                    weight: 0.3,
                    score: 8.5,
                    impact: 'positive',
                    description: 'Lead demographics match buyer requirements'
                  }
                ],
                overall_score: 8.1,
                recommendations: ['Increase bid for similar leads', 'Monitor conversion rate'],
                created_at: new Date().toISOString()
              }
              const error = null

              if (error) throw error

              const currentScoring = get().qualityScoring
              set({ qualityScoring: [...currentScoring, mockQualityScoring] })

              return mockQualityScoring
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Failed to analyze lead quality'
              set({ error: errorMessage })
              throw new Error(errorMessage)
            } finally {
              set({ loading: false })
            }
          },

          // Fetch dashboard data
          fetchDashboardData: async () => {
            set({ loading: true, error: null })
            try {
              const { data: session } = await getSession()
              if (!session.session?.user) throw new Error('Not authenticated')

              // Mock: get_supplier_dashboard function doesn't exist
              const mockDashboardData: SupplierDashboardData = {
                metrics: {
                  total_revenue: 15750.50,
                  total_calls_sold: 245,
                  average_price_per_call: 64.29,
                  conversion_rate: 0.73,
                  top_performing_verticals: [],
                  monthly_trends: [],
                  buyer_analytics: [],
                  quality_trends: []
                },
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
              const error = null

              if (error) throw error

              set({ dashboardData: mockDashboardData })
            } catch (error) {
              set({ error: error instanceof Error ? error.message : 'Failed to fetch dashboard data' })
            } finally {
              set({ loading: false })
            }
          },

          // Utility actions
          clearError: () => set({ error: null }),
          reset: () => set(initialState),
        }),
        {
          name: 'supplier-store',
          partialize: (state) => ({
            listings: state.listings,
            leadSources: state.leadSources,
          }),
        }
      )
    ),
    {
      name: 'supplier-store',
    }
  )
)