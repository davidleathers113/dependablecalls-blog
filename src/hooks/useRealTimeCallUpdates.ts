// MIGRATION PLAN: This file already uses optimized imports from lib/supabase-optimized
// Status: MIGRATION COMPLETE ✅ - only has type imports from @supabase/supabase-js
import { useState, useEffect } from 'react'
import { channel, removeChannel } from '../lib/supabase-optimized'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

interface CallRecord {
  id: string
  created_at: string
  caller_number: string
  duration: number
  status: 'active' | 'completed' | 'failed'
  buyer_name: string
  campaign_name: string
  payout: number
  quality_score?: number
}

export function useRealTimeCallUpdates(supplierId: string) {
  const [calls, setCalls] = useState<CallRecord[]>([])

  useEffect(() => {
    if (!supplierId) return

    // Subscribe to real-time call updates for this supplier
    const callChannel = channel(`supplier-call-updates-${supplierId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
          filter: `supplier_id=eq.${supplierId}`,
        },
        (payload: RealtimePostgresChangesPayload<CallRecord>) => {
          handleCallUpdate(payload)
        }
      )
      .subscribe()

    return () => {
      removeChannel(callChannel)
    }
  }, [supplierId])

  const handleCallUpdate = (payload: RealtimePostgresChangesPayload<CallRecord>) => {
    const { eventType, new: newCall, old: oldCall } = payload

    setCalls((currentCalls) => {
      switch (eventType) {
        case 'INSERT':
          // Add new call to the beginning of the list
          if (newCall) {
            return [newCall, ...currentCalls.slice(0, 9)] // Keep only 10 most recent
          }
          return currentCalls

        case 'UPDATE':
          // Update existing call
          if (newCall) {
            return currentCalls.map((call) => (call.id === newCall.id ? newCall : call))
          }
          return currentCalls

        case 'DELETE':
          // Remove deleted call
          if (oldCall) {
            return currentCalls.filter((call) => call.id !== oldCall.id)
          }
          return currentCalls

        default:
          return currentCalls
      }
    })
  }

  return calls
}
