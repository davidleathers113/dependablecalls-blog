import type { Handler } from '@netlify/functions'
import { requireRole, ApiError } from '../../src/lib/auth-middleware'
import { z } from 'zod'

const createCampaignSchema = z.object({
  name: z
    .string()
    .min(1, 'Campaign name is required')
    .max(100, 'Name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  category: z.string().min(1, 'Category is required'),
  vertical: z.string().min(1, 'Vertical is required'),
  bidFloor: z.number().min(0, 'Bid floor must be positive').max(1000, 'Bid floor too high'),
  maxConcurrentCalls: z
    .number()
    .int()
    .min(1, 'Must allow at least 1 concurrent call')
    .max(50, 'Too many concurrent calls'),
  qualityThreshold: z
    .number()
    .int()
    .min(1, 'Quality threshold too low')
    .max(100, 'Quality threshold too high'),
  recordingEnabled: z.boolean().default(true),
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

type CreateCampaignRequest = z.infer<typeof createCampaignSchema>

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  return requireRole(['supplier'])(event, async (context) => {
    if (!event.body) {
      throw new ApiError('Request body is required', 400)
    }

    const requestData: CreateCampaignRequest = createCampaignSchema.parse(JSON.parse(event.body))

    // Get supplier ID
    const { data: supplierData, error: supplierError } = await context.supabase
      .from('suppliers')
      .select('id, status, credit_balance')
      .eq('user_id', context.user!.id)
      .single()

    if (supplierError || !supplierData) {
      throw new ApiError('Supplier profile not found', 404, 'SUPPLIER_NOT_FOUND')
    }

    if (supplierData.status !== 'active') {
      throw new ApiError('Supplier account is not active', 403, 'SUPPLIER_INACTIVE')
    }

    // Check if supplier has sufficient balance for minimum bid
    const minimumBalance = requestData.bidFloor * 10 // Require 10x bid floor as minimum balance
    if (supplierData.credit_balance < minimumBalance) {
      throw new ApiError(
        `Insufficient balance. Minimum ${minimumBalance.toFixed(2)} required for this bid floor.`,
        400,
        'INSUFFICIENT_BALANCE'
      )
    }

    // Create campaign
    const { data: campaign, error: campaignError } = await context.supabase
      .from('campaigns')
      .insert({
        supplier_id: supplierData.id,
        name: requestData.name,
        description: requestData.description || null,
        category: requestData.category,
        vertical: requestData.vertical,
        bid_floor: requestData.bidFloor,
        max_concurrent_calls: requestData.maxConcurrentCalls,
        quality_threshold: requestData.qualityThreshold,
        recording_enabled: requestData.recordingEnabled,
        targeting: requestData.targeting || {},
        status: 'draft',
      })
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

    if (campaignError) {
      console.error('Error creating campaign:', campaignError)
      throw new ApiError('Failed to create campaign', 500, 'CREATION_FAILED')
    }

    return {
      success: true,
      message: 'Campaign created successfully',
      data: campaign,
    }
  })
}
