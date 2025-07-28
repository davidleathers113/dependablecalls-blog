// MIGRATION PLAN: This file already uses optimized imports from lib/supabase-optimized
// Status: MIGRATION COMPLETE ✅ - only has type imports from @supabase/supabase-js
import { useState, useEffect } from 'react'
import { channel, removeChannel, from } from '../lib/supabase-optimized'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

interface RealTimeStats {
  totalCalls?: number
  revenue?: number
  conversionRate?: number
  qualityScore?: number
}

interface CallUpdate {
  id: string
  supplier_id: string
  status: 'initiated' | 'ringing' | 'connected' | 'completed' | 'failed' | 'rejected'
  duration?: number
  revenue?: number
  created_at: string
}

export function useRealTimeStats(supplierId: string) {
  const [liveStats, setLiveStats] = useState<RealTimeStats | null>(null)

  useEffect(() => {
    if (!supplierId) return

    // Subscribe to call updates for this supplier
    const callsChannel = channel(`supplier-calls-${supplierId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
          filter: `supplier_id=eq.${supplierId}`,
        },
        (payload: RealtimePostgresChangesPayload<CallUpdate>) => {
          handleCallUpdate(payload)
        }
      )
      .subscribe()

    // Subscribe to supplier stats updates
    const statsChannel = channel(`supplier-stats-${supplierId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'supplier_stats',
          filter: `supplier_id=eq.${supplierId}`,
        },
        (payload: RealtimePostgresChangesPayload<RealTimeStats>) => {
          if (payload.new) {
            setLiveStats((prev) => ({
              ...prev,
              ...payload.new,
            }))
          }
        }
      )
      .subscribe()

    return () => {
      removeChannel(callsChannel)
      removeChannel(statsChannel)
    }
  }, [supplierId])

  const handleCallUpdate = (payload: RealtimePostgresChangesPayload<CallUpdate>) => {
    const { eventType, new: newCall, old: oldCall } = payload

    switch (eventType) {
      case 'INSERT':
        // New call started
        if (newCall?.status === 'connected') {
          setLiveStats((prev) => ({
            ...prev,
            totalCalls: (prev?.totalCalls || 0) + 1,
          }))
        }
        break

      case 'UPDATE':
        // Call status or data updated
        if (newCall?.status === 'completed' && oldCall?.status === 'connected') {
          // Call completed - update revenue and conversion stats
          setLiveStats((prev) => ({
            ...prev,
            revenue: (prev?.revenue || 0) + (newCall.revenue || 0),
          }))
        }
        break

      case 'DELETE':
        // Call removed (rare, but handle gracefully)
        if (oldCall) {
          setLiveStats((prev) => ({
            ...prev,
            totalCalls: Math.max((prev?.totalCalls || 0) - 1, 0),
          }))
        }
        break
    }
  }

  return liveStats
}

// Hook for real-time call count
export function useRealTimeCallCount(supplierId: string) {
  const [activeCallCount, setActiveCallCount] = useState(0)

  useEffect(() => {
    if (!supplierId) return

    // Initial fetch of active calls
    const fetchActiveCallCount = async () => {
      const { count } = await from('calls')
        .select('*', { count: 'exact', head: true })
        .eq('supplier_id', supplierId)
        .eq('status', 'connected')

      setActiveCallCount(count || 0)
    }

    fetchActiveCallCount()

    // Subscribe to real-time updates
    const activeCallsChannel = channel(`active-calls-${supplierId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
          filter: `supplier_id=eq.${supplierId}`,
        },
        (payload: RealtimePostgresChangesPayload<CallUpdate>) => {
          const { eventType, new: newCall, old: oldCall } = payload

          if (eventType === 'INSERT' && newCall?.status === 'connected') {
            setActiveCallCount((prev) => prev + 1)
          } else if (eventType === 'UPDATE') {
            if (oldCall?.status === 'connected' && newCall?.status !== 'connected') {
              setActiveCallCount((prev) => Math.max(prev - 1, 0))
            } else if (oldCall?.status !== 'connected' && newCall?.status === 'connected') {
              setActiveCallCount((prev) => prev + 1)
            }
          } else if (eventType === 'DELETE' && oldCall?.status === 'connected') {
            setActiveCallCount((prev) => Math.max(prev - 1, 0))
          }
        }
      )
      .subscribe()

    return () => {
      removeChannel(activeCallsChannel)
    }
  }, [supplierId])

  return activeCallCount
}
