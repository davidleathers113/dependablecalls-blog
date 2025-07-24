import type { Handler } from '@netlify/functions'
import { requireRole, ApiError } from '../../src/lib/auth-middleware'
import { z } from 'zod'

const updateCampaignSchema = z.object({
  name: z
    .string()
    .min(1, 'Campaign name is required')
    .max(100, 'Name must be less than 100 characters')
    .optional(),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed']).optional(),
  bidFloor: z
    .number()
    .min(0, 'Bid floor must be positive')
    .max(1000, 'Bid floor too high')
    .optional(),
  maxConcurrentCalls: z
    .number()
    .int()
    .min(1, 'Must allow at least 1 concurrent call')
    .max(50, 'Too many concurrent calls')
    .optional(),
  qualityThreshold: z
    .number()
    .int()
    .min(1, 'Quality threshold too low')
    .max(100, 'Quality threshold too high')
    .optional(),
  recordingEnabled: z.boolean().optional(),
  targeting: z
    .object({
      geographic: z
        .object({
          states: z.array(z.string()).optional(),
          cities: z.array(z.string()).optional(),
          metro_areas: z.array(z.string()).optional(),
        })
        .optional(),
      demographic: z
        .object({
          age_range: z.string().optional(),
          income_level: z.string().optional(),
        })
        .optional(),
      schedule: z
        .object({
          enabled: z.boolean().default(true),
          timezone: z.string().default('UTC'),
          hours: z
            .record(
              z.string(),
              z.object({
                start: z.number().min(0).max(23),
                end: z.number().min(0).max(23),
              })
            )
            .optional(),
        })
        .optional(),
    })
    .optional(),
})

type UpdateCampaignRequest = z.infer<typeof updateCampaignSchema>

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'PUT, OPTIONS',
      },
      body: '',
    }
  }

  if (event.httpMethod !== 'PUT') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  return requireRole(['supplier', 'admin'])(event, async (context) => {
    const campaignId = event.path.split('/').pop()

    if (!campaignId) {
      throw new ApiError('Campaign ID is required', 400, 'MISSING_CAMPAIGN_ID')
    }

    if (!event.body) {
      throw new ApiError('Request body is required', 400)
    }

    const requestData: UpdateCampaignRequest = updateCampaignSchema.parse(JSON.parse(event.body))

    // Get existing campaign
    const { data: existingCampaign, error: fetchError } = await context.supabase
      .from('campaigns')
      .select(
        `
        id,
        supplier_id,
        status,
        bid_floor,
        suppliers!campaigns_supplier_id_fkey (
          id,
          user_id,
          credit_balance
        )
      `
      )
      .eq('id', campaignId)
      .single()

    if (fetchError || !existingCampaign) {
      throw new ApiError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND')
    }

    // Check access permissions
    if (context.user?.role === 'supplier') {
      const { data: supplierData } = await context.supabase
        .from('suppliers')
        .select('id')
        .eq('user_id', context.user.id)
        .single()

      if (!supplierData || existingCampaign.supplier_id !== supplierData.id) {
        throw new ApiError('Access denied', 403, 'ACCESS_DENIED')
      }
    }

    // If updating bid floor, check supplier balance
    if (requestData.bidFloor && requestData.bidFloor !== existingCampaign.bid_floor) {
      const minimumBalance = requestData.bidFloor * 10
      if (existingCampaign.suppliers?.credit_balance < minimumBalance) {
        throw new ApiError(
          `Insufficient balance. Minimum ${minimumBalance.toFixed(2)} required for this bid floor.`,
          400,
          'INSUFFICIENT_BALANCE'
        )
      }
    }

    // Validate status transitions
    if (requestData.status && requestData.status !== existingCampaign.status) {
      const validTransitions: Record<string, string[]> = {
        draft: ['active', 'completed'],
        active: ['paused', 'completed'],
        paused: ['active', 'completed'],
        completed: [], // Cannot transition from completed
      }

      const allowedStatuses = validTransitions[existingCampaign.status] || []
      if (!allowedStatuses.includes(requestData.status)) {
        throw new ApiError(
          `Cannot transition from ${existingCampaign.status} to ${requestData.status}`,
          400,
          'INVALID_STATUS_TRANSITION'
        )
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {}

    if (requestData.name !== undefined) updateData.name = requestData.name
    if (requestData.description !== undefined) updateData.description = requestData.description
    if (requestData.status !== undefined) updateData.status = requestData.status
    if (requestData.bidFloor !== undefined) updateData.bid_floor = requestData.bidFloor
    if (requestData.maxConcurrentCalls !== undefined)
      updateData.max_concurrent_calls = requestData.maxConcurrentCalls
    if (requestData.qualityThreshold !== undefined)
      updateData.quality_threshold = requestData.qualityThreshold
    if (requestData.recordingEnabled !== undefined)
      updateData.recording_enabled = requestData.recordingEnabled
    if (requestData.targeting !== undefined) updateData.targeting = requestData.targeting

    // Update campaign
    const { data: campaign, error: updateError } = await context.supabase
      .from('campaigns')
      .update(updateData)
      .eq('id', campaignId)
      .select(
        `
        id,
        name,
        description,
        category,
        vertical,
        status,
        bid_floor,
        max_concurrent_calls,
        quality_threshold,
        recording_enabled,
        targeting,
        created_at,
        updated_at
      `
      )
      .single()

    if (updateError) {
      console.error('Error updating campaign:', updateError)
      throw new ApiError('Failed to update campaign', 500, 'UPDATE_FAILED')
    }

    return {
      success: true,
      message: 'Campaign updated successfully',
      data: campaign,
    }
  })
}
