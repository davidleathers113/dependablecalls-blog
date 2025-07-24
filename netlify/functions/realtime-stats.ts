import type { Handler } from '@netlify/functions'
import { withAuth, ApiError } from '../../src/lib/auth-middleware'
import { z } from 'zod'

const statsSubscriptionSchema = z.object({
  action: z.enum(['subscribe', 'unsubscribe']),
  statsType: z.enum(['campaign', 'supplier', 'buyer', 'platform']),
  entityId: z.string().uuid('Invalid entity ID').optional(),
  metrics: z
    .array(
      z.enum([
        'calls_count',
        'active_calls',
        'total_duration',
        'total_revenue',
        'conversion_rate',
        'quality_score_avg',
        'fraud_detection_alerts',
      ])
    )
    .optional(),
  interval: z.enum(['realtime', '1min', '5min', '15min']).default('realtime'),
})

type StatsSubscriptionRequest = z.infer<typeof statsSubscriptionSchema>

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

    const requestData: StatsSubscriptionRequest = statsSubscriptionSchema.parse(
      JSON.parse(request.body)
    )

    // Verify access based on stats type and user role
    let channelName = ''
    const subscriptions: Array<{
      channel: string
      table: string
      filter?: string
    }> = []

    switch (requestData.statsType) {
      case 'campaign': {
        if (!requestData.entityId) {
          throw new ApiError('Campaign ID is required', 400, 'MISSING_CAMPAIGN_ID')
        }

        // Verify access to campaign
        const { data: campaign } = await context.supabase
          .from('campaigns')
          .select('id, supplier_id')
          .eq('id', requestData.entityId)
          .single()

        if (!campaign) {
          throw new ApiError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND')
        }

        // Check access for suppliers
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

        channelName = `stats:campaign:${requestData.entityId}`

        // Subscribe to campaign stats updates
        subscriptions.push({
          channel: channelName,
          table: 'campaign_stats',
          filter: `campaign_id=eq.${requestData.entityId}`,
        })

        // Also subscribe to live call updates for this campaign
        subscriptions.push({
          channel: `${channelName}:calls`,
          table: 'calls',
          filter: `campaign_id=eq.${requestData.entityId}`,
        })

        break
      }

      case 'supplier': {
        // Suppliers can only see their own stats
        if (context.user?.role !== 'supplier' && context.user?.role !== 'admin') {
          throw new ApiError('Access denied', 403, 'ACCESS_DENIED')
        }

        const { data: supplierData } = await context.supabase
          .from('suppliers')
          .select('id')
          .eq('user_id', context.user.id)
          .single()

        if (!supplierData) {
          throw new ApiError('Supplier not found', 404, 'SUPPLIER_NOT_FOUND')
        }

        const supplierId = requestData.entityId || supplierData.id

        // Verify access to requested supplier stats
        if (context.user?.role === 'supplier' && supplierId !== supplierData.id) {
          throw new ApiError('Access denied', 403, 'ACCESS_DENIED')
        }

        channelName = `stats:supplier:${supplierId}`

        // Subscribe to supplier stats view
        subscriptions.push({
          channel: channelName,
          table: 'supplier_stats_view',
          filter: `supplier_id=eq.${supplierId}`,
        })

        // Subscribe to campaigns for this supplier
        subscriptions.push({
          channel: `${channelName}:campaigns`,
          table: 'campaigns',
          filter: `supplier_id=eq.${supplierId}`,
        })

        break
      }

      case 'buyer': {
        // Buyers can only see their own stats
        if (context.user?.role !== 'buyer' && context.user?.role !== 'admin') {
          throw new ApiError('Access denied', 403, 'ACCESS_DENIED')
        }

        const { data: buyerData } = await context.supabase
          .from('buyers')
          .select('id')
          .eq('user_id', context.user.id)
          .single()

        if (!buyerData) {
          throw new ApiError('Buyer not found', 404, 'BUYER_NOT_FOUND')
        }

        const buyerId = requestData.entityId || buyerData.id

        // Verify access to requested buyer stats
        if (context.user?.role === 'buyer' && buyerId !== buyerData.id) {
          throw new ApiError('Access denied', 403, 'ACCESS_DENIED')
        }

        channelName = `stats:buyer:${buyerId}`

        // Subscribe to buyer stats view
        subscriptions.push({
          channel: channelName,
          table: 'buyer_stats_view',
          filter: `buyer_id=eq.${buyerId}`,
        })

        // Subscribe to buyer campaigns
        subscriptions.push({
          channel: `${channelName}:campaigns`,
          table: 'buyer_campaigns',
          filter: `buyer_id=eq.${buyerId}`,
        })

        break
      }

      case 'platform': {
        // Only admins can see platform-wide stats
        if (context.user?.role !== 'admin') {
          throw new ApiError('Admin access required', 403, 'ADMIN_ONLY')
        }

        channelName = 'stats:platform'

        // Subscribe to platform-wide metrics
        subscriptions.push({
          channel: channelName,
          table: 'platform_stats',
        })

        // Subscribe to fraud detection alerts
        if (requestData.metrics?.includes('fraud_detection_alerts')) {
          subscriptions.push({
            channel: `${channelName}:fraud`,
            table: 'fraud_alerts',
            filter: 'resolved=eq.false',
          })
        }

        break
      }
    }

    // Generate JWT token for real-time subscription
    const realtimeToken = await context.supabase.auth.getSession()

    if (!realtimeToken.data.session) {
      throw new ApiError('Failed to generate realtime token', 500, 'TOKEN_GENERATION_FAILED')
    }

    // Create aggregation configuration based on interval
    const aggregationConfig = {
      realtime: {
        enabled: true,
        window: 0, // No aggregation
      },
      '1min': {
        enabled: true,
        window: 60000, // 1 minute in milliseconds
      },
      '5min': {
        enabled: true,
        window: 300000, // 5 minutes
      },
      '15min': {
        enabled: true,
        window: 900000, // 15 minutes
      },
    }[requestData.interval]

    return {
      success: true,
      action: requestData.action,
      subscription: {
        channels: subscriptions.map((sub) => sub.channel),
        configs: subscriptions,
        aggregation: aggregationConfig,
        token: realtimeToken.data.session.access_token,
        url: process.env.VITE_SUPABASE_URL || '',
        anonKey: process.env.VITE_SUPABASE_ANON_KEY || '',
      },
      instructions: {
        subscribe: `Subscribe to stats channels for ${requestData.statsType}`,
        metrics: requestData.metrics || 'all',
        example: `
          // Create multiple subscriptions for comprehensive stats
          const statsChannel = supabase
            .channel('${channelName}')
            ${subscriptions
              .map(
                (sub) => `
            .on('postgres_changes', {
              event: '*',
              schema: 'public',
              table: '${sub.table}'${sub.filter ? `,\n              filter: '${sub.filter}'` : ''}
            }, (payload) => {
              // Update stats based on change
              updateStats(payload)
            })`
              )
              .join('')}
            .subscribe()

          // Aggregation function for interval-based updates
          ${
            requestData.interval !== 'realtime'
              ? `
          const aggregateStats = debounce(() => {
            // Aggregate accumulated changes
            processAggregatedStats()
          }, ${aggregationConfig?.window})`
              : ''
          }
        `,
      },
    }
  })
}