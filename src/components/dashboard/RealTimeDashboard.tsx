import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { RealtimeErrorBoundary } from '../realtime/RealtimeErrorBoundary'
import { ActiveCampaignsTable } from './supplier/ActiveCampaignsTable'
import { CallVolumeChart } from './supplier/CallVolumeChart'
import { RecentCallsList } from './supplier/RecentCallsList'
import { QuickStatsBar } from './supplier/QuickStatsBar'
import { logger } from '@/lib/logger'

interface RealTimeDashboardProps {
  userId: string
  userType: 'supplier' | 'buyer'
}

// Inner component that handles real-time data
function RealTimeDashboardInner({ userId, userType }: RealTimeDashboardProps) {
  const [callData, setCallData] = useState<
    Array<{ id: string; created_at: string; payout_amount: number; [key: string]: unknown }>
  >([])
  const [stats, setStats] = useState({
    totalCalls: 0,
    activeCampaigns: 0,
    revenue: 0,
    conversion: 0,
  })
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>(
    'connected'
  )

  const loadInitialData = useCallback(async () => {
    try {
      // Load recent calls
      const { data: calls, error: callsError } = await supabase
        .from('calls')
        .select('*')
        .eq(userType === 'supplier' ? 'supplier_id' : 'buyer_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (callsError) throw callsError
      setCallData(calls || [])

      // Load stats
      const { data: statsData, error: statsError } = await supabase.rpc('get_user_stats', {
        user_id: userId,
        user_type: userType,
      })

      if (statsError) throw statsError
      if (statsData) {
        setStats({
          totalCalls: statsData.total_calls || 0,
          activeCampaigns: statsData.active_campaigns || 0,
          revenue: statsData.revenue || 0,
          conversion: statsData.conversion_rate || 0,
        })
      }
    } catch (error) {
      logger.error('Error loading initial dashboard data', error)
      throw error
    }
  }, [userId, userType])

  const updateStats = (newCall: { payout_amount?: number }) => {
    // Update stats based on new call data
    setStats((prev) => ({
      ...prev,
      totalCalls: prev.totalCalls + 1,
      revenue: prev.revenue + (newCall.payout_amount || 0),
    }))
  }

  useEffect(() => {
    // Subscribe to real-time call updates
    const callChannel = supabase
      .channel(`calls-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
          filter: userType === 'supplier' ? `supplier_id=eq.${userId}` : `buyer_id=eq.${userId}`,
        },
        (payload) => {
          logger.info('Real-time call update received', payload)

          if (payload.eventType === 'INSERT') {
            setCallData((prev) => [payload.new, ...prev].slice(0, 50)) // Keep last 50 calls
            updateStats(payload.new)
          } else if (payload.eventType === 'UPDATE') {
            setCallData((prev) =>
              prev.map((call) => (call.id === payload.new.id ? payload.new : call))
            )
            updateStats(payload.new)
          }
        }
      )
      .subscribe((status) => {
        setConnectionStatus(status === 'SUBSCRIBED' ? 'connected' : 'disconnected')
      })

    // Subscribe to campaign updates
    const campaignChannel = supabase
      .channel(`campaigns-${userId}`)
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
        (payload) => {
          logger.info('Real-time campaign update received', payload)
          // Update campaign-related stats
        }
      )
      .subscribe()

    // Load initial data
    loadInitialData()

    return () => {
      supabase.removeChannel(callChannel)
      supabase.removeChannel(campaignChannel)
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
      <QuickStatsBar
        totalCalls={stats.totalCalls}
        activeCampaigns={stats.activeCampaigns}
        revenue={stats.revenue}
        conversionRate={stats.conversion}
        period="today"
      />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Call Volume Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Call Volume</h2>
          <CallVolumeChart data={callData} />
        </div>

        {/* Recent Calls */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Calls</h2>
          <RecentCallsList calls={callData.slice(0, 10)} />
        </div>
      </div>

      {/* Active Campaigns Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Active Campaigns</h2>
        </div>
        <ActiveCampaignsTable userId={userId} userType={userType} />
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
