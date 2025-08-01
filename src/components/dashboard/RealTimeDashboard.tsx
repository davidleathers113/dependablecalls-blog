import { useEffect, useState, useCallback } from 'react'
import { channel, removeChannel } from '@/lib/supabase-optimized'
import { RealtimeErrorBoundary } from '../realtime/RealtimeErrorBoundary'
import { ActiveCampaignsTable } from './supplier/ActiveCampaignsTable'
import { CallVolumeChart } from './supplier/CallVolumeChart'
import { RecentCallsList } from './supplier/RecentCallsList'
import { QuickStatsBar } from './supplier/QuickStatsBar'
import { logger } from '@/lib/logger'
import type { Database } from '@/types/database-extended'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

interface RealTimeDashboardProps {
  userId: string
  userType: 'supplier' | 'buyer'
}

// Inner component that handles real-time data
function RealTimeDashboardInner({ userId, userType }: RealTimeDashboardProps) {
  const [, setCallData] = useState<Database['public']['Tables']['calls']['Row'][]>([])
  // Note: Stats are handled by QuickStatsBar component
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>(
    'connected'
  )

  const loadInitialData = useCallback(async () => {
    try {
      // TEMPORARY: Use mock data while database tables are being set up
      // TODO: Replace with actual Supabase calls once platform tables exist
      const mockCalls: Database['public']['Tables']['calls']['Row'][] = []
      setCallData(mockCalls)

      logger.info('Dashboard loaded with mock data - platform tables not yet available')
    } catch (error) {
      logger.error('Error loading initial dashboard data', error as Error)
      throw error
    }
  }, [userId, userType])

  // Note: Stats updates are handled by QuickStatsBar component via real-time subscriptions

  useEffect(() => {
    // Subscribe to real-time call updates
    const callChannel = channel(`calls-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
          filter: userType === 'supplier' ? `supplier_id=eq.${userId}` : `buyer_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<Database['public']['Tables']['calls']['Row']>) => {
          logger.info('Real-time call update received', payload)

          if (payload.eventType === 'INSERT') {
            setCallData((prev) => [payload.new as (typeof prev)[0], ...prev].slice(0, 50)) // Keep last 50 calls
            // Stats are updated via QuickStatsBar real-time subscription
          } else if (payload.eventType === 'UPDATE') {
            setCallData((prev) =>
              prev.map((call) =>
                call.id === (payload.new as typeof call).id ? (payload.new as typeof call) : call
              )
            )
            // Stats are updated via QuickStatsBar real-time subscription
          }
        }
      )
      .subscribe((status: string) => {
        setConnectionStatus(status === 'SUBSCRIBED' ? 'connected' : 'disconnected')
      })

    // Subscribe to campaign updates
    const campaignChannel = channel(`campaigns-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaigns',
          filter:
            userType === 'buyer'
              ? `buyer_id=eq.${userId}`
              : `id=in.(select campaign_id from campaign_suppliers where supplier_id='${userId}')`,
        },
        (payload: RealtimePostgresChangesPayload<Database['public']['Tables']['campaigns']['Row']>) => {
          logger.info('Real-time campaign update received', payload)
          // Update campaign-related stats
        }
      )
      .subscribe()

    // Load initial data
    loadInitialData()

    return () => {
      removeChannel(callChannel)
      removeChannel(campaignChannel)
    }
  }, [userId, userType, loadInitialData])

  return (
    <div className="space-y-6">
      {/* Connection Status Indicator */}
      {connectionStatus === 'disconnected' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            Real-time updates are temporarily unavailable. Data shown may be delayed.
          </p>
        </div>
      )}

      {/* Quick Stats */}
      <QuickStatsBar timeRange="24h" supplierId={userType === 'supplier' ? userId : ''} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Call Volume Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Call Volume</h2>
          <CallVolumeChart timeRange="24h" supplierId={userType === 'supplier' ? userId : ''} />
        </div>

        {/* Recent Calls */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Calls</h2>
          <RecentCallsList supplierId={userType === 'supplier' ? userId : ''} />
        </div>
      </div>

      {/* Active Campaigns Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Active Campaigns</h2>
        </div>
        <ActiveCampaignsTable supplierId={userType === 'supplier' ? userId : ''} />
      </div>
    </div>
  )
}

// Export wrapped component with error boundary
export function RealTimeDashboard({ userId, userType }: RealTimeDashboardProps) {
  const [retryKey, setRetryKey] = useState(0)

  const handleReconnect = async () => {
    setRetryKey((prev) => prev + 1)
    logger.info('Reconnecting real-time dashboard')
  }

  const handleFallbackToPolling = () => {
    // In production, this would implement a polling mechanism
    logger.info('Switching to polling mode for dashboard updates')
  }

  const handleRefresh = () => {
    window.location.reload()
  }

  return (
    <RealtimeErrorBoundary
      featureName="Real-Time Dashboard"
      enableAutoReconnect={true}
      maxReconnectAttempts={5}
      reconnectDelay={1000}
      onReconnect={handleReconnect}
      onFallbackToPolling={handleFallbackToPolling}
      onRefresh={handleRefresh}
      onError={(error) => {
        logger.error('Real-time dashboard error', error)
      }}
    >
      <RealTimeDashboardInner key={retryKey} userId={userId} userType={userType} />
    </RealtimeErrorBoundary>
  )
}

export default RealTimeDashboard
