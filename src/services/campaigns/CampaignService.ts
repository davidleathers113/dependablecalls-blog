/**
 * Campaign Service
 * 
 * Concrete example of service layer implementation showing:
 * - Thin wrapper pattern for gradual migration from store methods
 * - Integration with BaseService for standardized error handling
 * - Business logic encapsulation with validation
 * - Store proxy methods for backward compatibility
 * - Structured error handling with service-specific codes
 * 
 * This service initially proxies to existing store methods while providing
 * a migration path to move business logic out of stores.
 */

import { BaseService } from '../base/BaseService'
import { createStoreError } from '../../lib/errors/StoreError'
import { createServiceAction, type AsyncActionExecutionContext } from '../../store/utils/withAsyncAction'

// Campaign Types
// ==============

export interface Campaign {
  id: string
  name: string
  description?: string
  status: CampaignStatus
  budget: number
  dailyBudget?: number
  budgetSpent: number
  bidPrice: number
  targeting: CampaignTargeting
  schedule?: CampaignSchedule
  supplierId: string
  buyerId: string
  callTrackingNumber?: string
  qualityScore?: number
  conversionRate?: number
  createdAt: string
  updatedAt: string
}

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'cancelled'

export interface CampaignTargeting {
  geolocations: string[]
  demographics?: {
    ageRange?: [number, number]
    gender?: 'male' | 'female' | 'all'
    income?: 'low' | 'medium' | 'high' | 'all'
  }
  keywords?: string[]
  excludedKeywords?: string[]
  timeZones?: string[]
  dayParting?: {
    days: number[] // 0-6, Sunday-Saturday
    hours: [number, number] // 24-hour format
  }
}

export interface CampaignSchedule {
  startDate: string
  endDate?: string
  timezone: string
}

export interface CreateCampaignRequest {
  name: string
  description?: string
  budget: number
  dailyBudget?: number
  bidPrice: number
  targeting: CampaignTargeting
  schedule?: CampaignSchedule
  buyerId: string
}

export interface UpdateCampaignRequest {
  id: string
  name?: string
  description?: string
  budget?: number
  dailyBudget?: number
  bidPrice?: number
  targeting?: Partial<CampaignTargeting>
  schedule?: CampaignSchedule
  status?: CampaignStatus
}

export interface CampaignFilters {
  status?: CampaignStatus[]
  buyerId?: string
  supplierId?: string
  minBudget?: number
  maxBudget?: number
  dateRange?: {
    start: string
    end: string
  }
}

export interface CampaignMetrics {
  totalCalls: number
  qualifiedCalls: number
  totalCost: number
  averageCost: number
  conversionRate: number
  qualityScore: number
  dailyStats: Array<{
    date: string
    calls: number
    cost: number
    conversions: number
  }>
}

// Campaign Service Implementation
// ===============================

export class CampaignService extends BaseService {
  private static instance: CampaignService | null = null

  constructor() {
    super({
      name: 'campaign',
      enableCaching: true,
      cacheTtl: 2 * 60 * 1000, // 2 minutes for campaign data
      maxRetries: 3,
      baseRetryDelay: 1000,
      enableMonitoring: true,
      enableDebugLogging: process.env.NODE_ENV === 'development',
    })
  }

  static getInstance(): CampaignService {
    if (!CampaignService.instance) {
      CampaignService.instance = new CampaignService()
    }
    return CampaignService.instance
  }

  // Core Campaign Operations
  // ========================

  /**
   * Get campaigns with filtering and pagination
   * Initially proxies to store method, can be enhanced with business logic
   */
  async getCampaigns(params: {
    filters?: CampaignFilters
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  } = {}): Promise<{
    campaigns: Campaign[]
    total: number
    page: number
    limit: number
  }> {
    return this.executeOperation<{
      campaigns: Campaign[]
      total: number
      page: number
      limit: number
    }>({
      name: 'getCampaigns',
      cacheKey: `campaigns:${JSON.stringify(params)}`,
      execute: async () => {
        // MIGRATION PHASE 1: Proxy to existing store/database logic
        // In future phases, this will contain business logic
        
        const { page = 1, limit = 20, filters = {}, sortBy = 'created_at', sortOrder = 'desc' } = params
        
        // Build Supabase query
        let query = this.supabase
          .from('campaigns')
          .select(`
            *,
            buyer:buyers(id, name, email),
            supplier:suppliers(id, name, email)
          `, { count: 'exact' })

        // Apply filters
        if (filters.status && filters.status.length > 0) {
          query = query.in('status', filters.status)
        }

        if (filters.buyerId) {
          query = query.eq('buyer_id', filters.buyerId)
        }

        if (filters.supplierId) {
          query = query.eq('supplier_id', filters.supplierId)
        }

        if (filters.minBudget) {
          query = query.gte('budget', filters.minBudget)
        }

        if (filters.maxBudget) {
          query = query.lte('budget', filters.maxBudget)
        }

        if (filters.dateRange) {
          query = query
            .gte('created_at', filters.dateRange.start)
            .lte('created_at', filters.dateRange.end)
        }

        // Apply sorting and pagination
        query = query
          .order(sortBy, { ascending: sortOrder === 'asc' })
          .range((page - 1) * limit, page * limit - 1)

        const { data, error, count } = await query

        if (error) {
          throw createStoreError.fetchFailed('campaigns', error.message, 'campaign')
        }

        if (!data) {
          return {
            campaigns: [],
            total: 0,
            page,
            limit,
          }
        }

        // Transform database rows to Campaign objects
        const campaigns = data.map(this.transformDbRowToCampaign)

        return {
          campaigns,
          total: count || 0,
          page,
          limit,
        }
      },
    })
  }

  /**
   * Get single campaign by ID
   */
  async getCampaign(id: string): Promise<Campaign | null> {
    return this.executeOperation<Campaign | null>({
      name: 'getCampaign',
      cacheKey: `campaign:${id}`,
      execute: async () => {
        const { data, error } = await this.supabase
          .from('campaigns')
          .select(`
            *,
            buyer:buyers(id, name, email),
            supplier:suppliers(id, name, email)
          `)
          .eq('id', id)
          .single()

        if (error) {
          if (error.code === 'PGRST116') {
            return null // Not found
          }
          throw createStoreError.fetchFailed('campaign', error.message, 'campaign')
        }

        return this.transformDbRowToCampaign(data)
      },
    })
  }

  /**
   * Create new campaign with validation and business rules
   */
  async createCampaign(request: CreateCampaignRequest, userId: string): Promise<Campaign> {
    return this.executeOperation<Campaign>({
      name: 'createCampaign',
      skipCache: true,
      execute: async () => {
        // Business Logic: Validate campaign data
        this.validateCampaignRequest(request)

        // Business Logic: Check budget constraints
        await this.validateBudgetConstraints(request.buyerId, request.budget)

        // Business Logic: Validate targeting parameters
        this.validateTargeting(request.targeting)

        // Create campaign record
        const campaignData = {
          name: request.name,
          description: request.description,
          budget: request.budget,
          daily_budget: request.dailyBudget,
          bid_price: request.bidPrice,
          targeting: request.targeting,
          schedule: request.schedule,
          buyer_id: request.buyerId,
          supplier_id: userId, // Assuming current user is supplier
          status: 'draft' as const,
          budget_spent: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        const { data, error } = await this.supabase
          .from('campaigns')
          .insert(campaignData)
          .select(`
            *,
            buyer:buyers(id, name, email),
            supplier:suppliers(id, name, email)
          `)
          .single()

        if (error) {
          throw createStoreError.saveFailed('campaign', error.message, 'campaign')
        }

        const campaign = this.transformDbRowToCampaign(data)

        // Business Logic: Initialize call tracking
        try {
          await this.initializeCallTracking(campaign.id)
        } catch (error) {
          this.log('Failed to initialize call tracking', { campaignId: campaign.id, error })
          // Don't fail the entire operation, but log the error
        }

        return campaign
      },
    })
  }

  /**
   * Update existing campaign with business rule validation
   */
  async updateCampaign(request: UpdateCampaignRequest, _userId: string): Promise<Campaign> {
    return this.executeOperation<Campaign>({
      name: 'updateCampaign',
      skipCache: true,
      execute: async () => {
        // Get existing campaign for validation
        const existingCampaign = await this.getCampaign(request.id)
        if (!existingCampaign) {
          throw createStoreError.notFound('campaign', request.id, 'campaign')
        }

        // Business Logic: Validate status transitions
        if (request.status) {
          this.validateStatusTransition(existingCampaign.status, request.status)
        }

        // Business Logic: Validate budget changes
        if (request.budget !== undefined) {
          await this.validateBudgetUpdate(existingCampaign, request.budget)
        }

        // Business Logic: Validate targeting changes
        if (request.targeting) {
          this.validateTargeting({ ...existingCampaign.targeting, ...request.targeting })
        }

        // Build update data
        const updateData: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        }

        if (request.name !== undefined) updateData.name = request.name
        if (request.description !== undefined) updateData.description = request.description
        if (request.budget !== undefined) updateData.budget = request.budget
        if (request.dailyBudget !== undefined) updateData.daily_budget = request.dailyBudget
        if (request.bidPrice !== undefined) updateData.bid_price = request.bidPrice
        if (request.targeting !== undefined) {
          updateData.targeting = { ...existingCampaign.targeting, ...request.targeting }
        }
        if (request.schedule !== undefined) updateData.schedule = request.schedule
        if (request.status !== undefined) updateData.status = request.status

        const { data, error } = await this.supabase
          .from('campaigns')
          .update(updateData)
          .eq('id', request.id)
          .select(`
            *,
            buyer:buyers(id, name, email),
            supplier:suppliers(id, name, email)
          `)
          .single()

        if (error) {
          throw createStoreError.saveFailed('campaign', error.message, 'campaign')
        }

        const updatedCampaign = this.transformDbRowToCampaign(data)

        // Business Logic: Handle status change side effects
        if (request.status && request.status !== existingCampaign.status) {
          await this.handleStatusChangeEffects(updatedCampaign, existingCampaign.status)
        }

        return updatedCampaign
      },
    })
  }

  /**
   * Delete campaign with validation
   */
  async deleteCampaign(id: string, _userId: string): Promise<void> {
    return this.executeOperation<void>({
      name: 'deleteCampaign',
      skipCache: true,
      execute: async () => {
        const campaign = await this.getCampaign(id)
        if (!campaign) {
          throw createStoreError.notFound('campaign', id, 'campaign')
        }

        // Business Logic: Validate deletion constraints
        if (campaign.status === 'active' && campaign.budgetSpent > 0) {
          throw createStoreError.campaignInvalidStatus(
            id,
            campaign.status,
            'deleted'
          )
        }

        const { error } = await this.supabase
          .from('campaigns')
          .delete()
          .eq('id', id)

        if (error) {
          throw createStoreError.saveFailed('campaign deletion', error.message, 'campaign')
        }

        // Business Logic: Cleanup related resources
        try {
          await this.cleanupCampaignResources(id)
        } catch (error) {
          this.log('Failed to cleanup campaign resources', { campaignId: id, error })
          // Log but don't fail the deletion
        }
      },
    })
  }

  /**
   * Get campaign metrics and performance data
   */
  async getCampaignMetrics(id: string, dateRange?: { start: string; end: string }): Promise<CampaignMetrics> {
    return this.executeOperation<CampaignMetrics>({
      name: 'getCampaignMetrics',
      cacheKey: `metrics:${id}:${dateRange ? `${dateRange.start}-${dateRange.end}` : 'all'}`,
      execute: async () => {
        // This would integrate with call tracking and analytics systems
        const { data, error } = await this.supabase
          .from('call_logs')
          .select('*')
          .eq('campaign_id', id)
          .gte('created_at', dateRange?.start || '2020-01-01')
          .lte('created_at', dateRange?.end || new Date().toISOString())

        if (error) {
          throw createStoreError.fetchFailed('campaign metrics', error.message, 'campaign')
        }

        return this.calculateMetrics(data || [])
      },
    })
  }

  // Business Logic Methods
  // ======================

  private validateCampaignRequest(request: CreateCampaignRequest): void {
    if (!request.name || request.name.trim().length < 3) {
      throw createStoreError.validationFailed('name', 'must be at least 3 characters', request.name, 'campaign')
    }

    if (request.budget <= 0) {
      throw createStoreError.validationFailed('budget', 'must be greater than 0', request.budget, 'campaign')
    }

    if (request.dailyBudget && request.dailyBudget > request.budget) {
      throw createStoreError.validationFailed('dailyBudget', 'cannot exceed total budget', request.dailyBudget, 'campaign')
    }

    if (request.bidPrice <= 0) {
      throw createStoreError.validationFailed('bidPrice', 'must be greater than 0', request.bidPrice, 'campaign')
    }
  }

  private async validateBudgetConstraints(buyerId: string, budget: number): Promise<void> {
    // Check buyer's available balance
    const { data: buyer, error } = await this.supabase
      .from('buyers')
      .select('balance, credit_limit')
      .eq('id', buyerId)
      .single()

    if (error) {
      throw createStoreError.fetchFailed('buyer', error.message, 'campaign')
    }

    const availableBalance = buyer.balance + (buyer.credit_limit || 0)
    if (budget > availableBalance) {
      throw createStoreError.campaignBudgetExceeded(buyerId, availableBalance, budget)
    }
  }

  private validateTargeting(targeting: CampaignTargeting): void {
    if (!targeting.geolocations || targeting.geolocations.length === 0) {
      throw createStoreError.validationFailed('targeting.geolocations', 'at least one location required', targeting.geolocations, 'campaign')
    }

    if (targeting.demographics?.ageRange) {
      const [min, max] = targeting.demographics.ageRange
      if (min < 18 || max > 100 || min >= max) {
        throw createStoreError.validationFailed('targeting.demographics.ageRange', 'invalid age range', targeting.demographics.ageRange, 'campaign')
      }
    }
  }

  private validateStatusTransition(currentStatus: CampaignStatus, newStatus: CampaignStatus): void {
    const validTransitions: Record<CampaignStatus, CampaignStatus[]> = {
      draft: ['active', 'cancelled'],
      active: ['paused', 'completed', 'cancelled'],
      paused: ['active', 'cancelled'],
      completed: [], // Terminal status
      cancelled: [], // Terminal status
    }

    const allowedTransitions = validTransitions[currentStatus]
    if (!allowedTransitions.includes(newStatus)) {
      throw createStoreError.campaignInvalidStatus('unknown', currentStatus, newStatus)
    }
  }

  private async validateBudgetUpdate(existingCampaign: Campaign, newBudget: number): Promise<void> {
    if (newBudget < existingCampaign.budgetSpent) {
      throw createStoreError.validationFailed(
        'budget',
        `cannot be less than already spent amount (${existingCampaign.budgetSpent})`,
        newBudget,
        'campaign'
      )
    }
  }

  private async initializeCallTracking(campaignId: string): Promise<void> {
    // Initialize call tracking number for the campaign
    // This would integrate with call tracking service
    this.log('Initializing call tracking', { campaignId })
  }

  private async handleStatusChangeEffects(campaign: Campaign, previousStatus: CampaignStatus): Promise<void> {
    // Handle side effects of status changes
    if (campaign.status === 'active' && previousStatus !== 'active') {
      // Campaign activated - notify relevant parties
      this.log('Campaign activated', { campaignId: campaign.id })
      // Could trigger notifications, update external systems, etc.
    }

    if (campaign.status === 'paused' && previousStatus === 'active') {
      // Campaign paused - stop ad delivery
      this.log('Campaign paused', { campaignId: campaign.id })
    }
  }

  private async cleanupCampaignResources(campaignId: string): Promise<void> {
    // Cleanup call tracking numbers, ad placements, etc.
    this.log('Cleaning up campaign resources', { campaignId })
  }

  private calculateMetrics(_callLogs: unknown[]): CampaignMetrics {
    // Calculate campaign performance metrics from call logs
    // This is simplified - real implementation would be more complex
    const totalCalls = _callLogs.length
    const qualifiedCalls = _callLogs.filter((call: unknown) => (call as { qualified?: boolean }).qualified).length
    const totalCost = _callLogs.reduce((sum: number, call: unknown) => sum + ((call as { cost?: number }).cost || 0), 0)
    
    return {
      totalCalls,
      qualifiedCalls,
      totalCost,
      averageCost: totalCalls > 0 ? totalCost / totalCalls : 0,
      conversionRate: totalCalls > 0 ? qualifiedCalls / totalCalls : 0,
      qualityScore: 0.85, // Would be calculated based on various factors
      dailyStats: [], // Would aggregate call data by day
    }
  }

  private transformDbRowToCampaign(row: unknown): Campaign {
    const dbRow = row as {
      id: string
      name: string
      description?: string
      status: CampaignStatus
      budget: number
      daily_budget?: number
      budget_spent?: number
      bid_price: number
      targeting?: CampaignTargeting
      schedule?: CampaignSchedule
      supplier_id: string
      buyer_id: string
      call_tracking_number?: string
      quality_score?: number
      conversion_rate?: number
      created_at: string
      updated_at: string
    }

    return {
      id: dbRow.id,
      name: dbRow.name,
      description: dbRow.description,
      status: dbRow.status,
      budget: dbRow.budget,
      dailyBudget: dbRow.daily_budget,
      budgetSpent: dbRow.budget_spent || 0,
      bidPrice: dbRow.bid_price,
      targeting: dbRow.targeting || { geolocations: [] },
      schedule: dbRow.schedule,
      supplierId: dbRow.supplier_id,
      buyerId: dbRow.buyer_id,
      callTrackingNumber: dbRow.call_tracking_number,
      qualityScore: dbRow.quality_score,
      conversionRate: dbRow.conversion_rate,
      createdAt: dbRow.created_at,
      updatedAt: dbRow.updated_at,
    }
  }

  protected async performHealthCheck(): Promise<void> {
    // Check campaign service health
    const { error } = await this.supabase
      .from('campaigns')
      .select('count')
      .limit(1)

    if (error) {
      throw error
    }
  }
}

// Store Integration Helpers
// =========================

/**
 * Creates store-compatible action for campaign operations
 * This enables gradual migration from store methods to service methods
 */
export function createCampaignAction<TState, TParams = void, TResult = unknown>(
  actionName: string,
  operation: (service: CampaignService, params: TParams, context: AsyncActionExecutionContext<TState, TParams, TResult>) => Promise<TResult>
) {
  const campaignService = CampaignService.getInstance()
  
  return createServiceAction<TState, TParams, TResult>({
    actionName,
    storeName: 'campaign',
    serviceName: 'campaign',
    enableLoadingState: true,
    enableRecovery: true,
    enableTelemetry: true,
    retry: {
      enabled: actionName.includes('get') || actionName.includes('fetch'),
      maxAttempts: 3,
      baseDelay: 1000,
    },
  })(async (params: TParams, context: AsyncActionExecutionContext<TState, TParams, TResult>) => {
    return operation(campaignService, params, context)
  })
}

// Export service instance and types
export const campaignService = CampaignService.getInstance()

// Types are already exported inline above