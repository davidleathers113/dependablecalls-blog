import type { Handler } from '@netlify/functions'
import { withAuth, ApiError } from '../../src/lib/auth-middleware'
import { z } from 'zod'

const subscriptionSchema = z.object({
  action: z.enum(['subscribe', 'unsubscribe']),
  campaignId: z.string().uuid('Invalid campaign ID').optional(),
  filters: z
    .object({
      status: z.array(z.enum(['draft', 'active', 'paused', 'completed'])).optional(),
      vertical: z.array(z.string()).optional(),
      ownCampaignsOnly: z.boolean().optional(),
    })
    .optional(),
})

type SubscriptionRequest = z.infer<typeof subscriptionSchema>

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

  return withAuth(event, async (context, request) => {
    if (!request.body) {
      throw new ApiError('Request body is required', 400)
    }

    const requestData: SubscriptionRequest = subscriptionSchema.parse(JSON.parse(request.body))

    // Generate channel name based on user role and filters
    let channelName = 'campaigns'
    const channelFilters: string[] = []

    // Role-based channel filtering
    if (context.user?.role === 'supplier') {
      // Get supplier ID
      const { data: supplierData } = await context.supabase
        .from('suppliers')
        .select('id')
        .eq('user_id', context.user.id)
        .single()

      if (supplierData) {
        channelFilters.push(`supplier_id=eq.${supplierData.id}`)
      }
    } else if (context.user?.role === 'buyer') {
      // Buyers see all active campaigns by default
      if (!requestData.filters?.status || requestData.filters.status.includes('active')) {
        channelFilters.push(`status=eq.active`)
      }
    }
    // Admins see all campaigns (no filtering)

    // Apply custom filters
    if (requestData.filters) {
      if (requestData.filters.status && requestData.filters.status.length > 0) {
        const statusFilter = requestData.filters.status.map((s) => `status=eq.${s}`).join(',')
        channelFilters.push(`(${statusFilter})`)
      }

      if (requestData.filters.vertical && requestData.filters.vertical.length > 0) {
        const verticalFilter = requestData.filters.vertical.map((v) => `vertical=eq.${v}`).join(',')
        channelFilters.push(`(${verticalFilter})`)
      }
    }

    // Specific campaign subscription
    if (requestData.campaignId) {
      // Verify access to the campaign
      const { data: campaign } = await context.supabase
        .from('campaigns')
        .select('id, supplier_id')
        .eq('id', requestData.campaignId)
        .single()

      if (!campaign) {
        throw new ApiError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND')
      }

      // Check access permissions
      if (context.user?.role === 'supplier') {
        const { data: supplierData } = await context.supabase
          .from('suppliers')
          .select('id')
          .eq('user_id', context.user.id)
          .single()

        if (!supplierData || campaign.supplier_id !== supplierData.id) {
          throw new ApiError('Access denied', 403, 'ACCESS_DENIED')
        }
      }

      channelName = `campaigns:id=eq.${requestData.campaignId}`
    } else if (channelFilters.length > 0) {
      // Build filter string for channel name
      channelName = `campaigns:${channelFilters.join(':')}`
    }

    // Create subscription configuration
    const subscriptionConfig = {
      event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
      schema: 'public',
      table: 'campaigns',
      filter: channelFilters.length > 0 ? channelFilters.join(' AND ') : undefined,
    }

    // Generate JWT token for real-time subscription
    // This token will be used by the client to connect to Supabase Realtime
    const realtimeToken = await context.supabase.auth.getSession()

    if (!realtimeToken.data.session) {
      throw new ApiError('Failed to generate realtime token', 500, 'TOKEN_GENERATION_FAILED')
    }

    return {
      success: true,
      action: requestData.action,
      subscription: {
        channel: channelName,
        config: subscriptionConfig,
        token: realtimeToken.data.session.access_token,
        url: process.env.VITE_SUPABASE_URL || '',
        anonKey: process.env.VITE_SUPABASE_ANON_KEY || '',
      },
      instructions: {
        subscribe: `Use the Supabase client to subscribe to channel: ${channelName}`,
        events: ['INSERT', 'UPDATE', 'DELETE'],
        example: `
          const channel = supabase
            .channel('${channelName}')
            .on('postgres_changes', ${JSON.stringify(subscriptionConfig, null, 2)}, 
              (payload) => console.log('Campaign change:', payload)
            )
            .subscribe()
        `,
      },
    }
  })
}
