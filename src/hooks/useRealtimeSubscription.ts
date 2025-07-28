// MIGRATION PLAN: This file only imports types from @supabase/supabase-js
// Status: NO MIGRATION NEEDED - type imports don't affect bundle size
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { throttleAdvanced } from '@/utils/throttle'
import { useSupabase } from './useSupabase'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Tables = Database['public']['Tables']
type TableName = keyof Tables

interface UseRealtimeSubscriptionOptions<T extends TableName> {
  table: T
  filter?: string
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  enabled?: boolean
  onInsert?: (payload: RealtimePostgresChangesPayload<Tables[T]['Row']>) => void
  onUpdate?: (payload: RealtimePostgresChangesPayload<Tables[T]['Row']>) => void
  onDelete?: (payload: RealtimePostgresChangesPayload<Tables[T]['Row']>) => void
  onChange?: (payload: RealtimePostgresChangesPayload<Tables[T]['Row']>) => void
}

interface RealtimeState {
  isConnected: boolean
  isConnecting: boolean
  error: Error | null
  lastEvent: Date | null
}

/**
 * useRealtimeSubscription – safe & resilient (Supabase v2.42+)
 */
export function useRealtimeSubscription<T extends TableName>({
  table,
  filter,
  event = '*',
  enabled = true,
  onInsert,
  onUpdate,
  onDelete,
  onChange,
}: UseRealtimeSubscriptionOptions<T>) {
  const supabase = useSupabase()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [state, setState] = useState<RealtimeState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    lastEvent: null,
  })

  /** 1️⃣ Single throttled state update to avoid render-storm */
  const commitLastEvent = useCallback(() => {
    setState((p) => ({ ...p, lastEvent: new Date() }))
  }, [])

  const throttledLastEvent = useMemo(
    () => throttleAdvanced(commitLastEvent, 100, { leading: true, trailing: true }),
    [commitLastEvent]
  )

  /** 2️⃣ Unified event router */
  const routeEvent = useCallback(
    (payload: RealtimePostgresChangesPayload<Tables[T]['Row']>) => {
      throttledLastEvent()
      switch (payload.eventType) {
        case 'INSERT':
          onInsert?.(payload)
          break
        case 'UPDATE':
          onUpdate?.(payload)
          break
        case 'DELETE':
          onDelete?.(payload)
          break
      }
      onChange?.(payload)
    },
    [onInsert, onUpdate, onDelete, onChange, throttledLastEvent]
  )

  /** 3️⃣ (Async) subscribe with guaranteed cleanup */
  const openChannel = useCallback(async () => {
    if (!enabled || channelRef.current) return

    setState((p) => ({ ...p, isConnecting: true, error: null }))

    // Sanitize filter to prevent log injection
    const sanitizedFilter = filter?.replace(/[^\w.=(),]/g, '')
    const name = `rt:${table}:${sanitizedFilter ?? 'all'}:${Date.now()}`

    const config = {
      event,
      schema: 'public',
      table,
      ...(sanitizedFilter && { filter: sanitizedFilter }),
    }

    channelRef.current = supabase
      .channel(name)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any, config, routeEvent)

    channelRef.current.subscribe((status) => {
      switch (status) {
        case 'SUBSCRIBED':
          setState((p) => ({ ...p, isConnected: true, isConnecting: false }))
          break
        case 'CHANNEL_ERROR':
        case 'TIMED_OUT':
        case 'CLOSED':
          setState((p) => ({
            ...p,
            isConnected: false,
            isConnecting: false,
            error: new Error(`Channel ${status}`),
          }))
          break
      }
    })
  }, [enabled, table, filter, event, routeEvent, supabase])

  /** 4️⃣ Reliable unsubscribe */
  const closeChannel = useCallback(async () => {
    if (!channelRef.current) return
    await supabase.removeChannel(channelRef.current) // await avoids race
    channelRef.current = null
  }, [supabase])

  /** 5️⃣ Lifecycle */
  useEffect(() => {
    openChannel()
    return () => {
      closeChannel()
    }
  }, [openChannel, closeChannel])

  /** 6️⃣ Exponential back-off reconnect */
  const backoff = useRef(1000)

  useEffect(() => {
    if (state.isConnected) {
      backoff.current = 1000
      return
    }
    if (state.isConnecting) return

    reconnectRef.current = setTimeout(async () => {
      await closeChannel()
      await openChannel()
      backoff.current = Math.min(backoff.current * 2, 30_000) // cap 30s
    }, backoff.current)

    return () => clearTimeout(reconnectRef.current)
  }, [state.isConnected, state.isConnecting, openChannel, closeChannel])

  return {
    ...state,
    subscribe: openChannel,
    unsubscribe: closeChannel,
    channel: channelRef.current,
  }
}

// Specialized hook for campaign subscriptions
export function useCampaignSubscription(
  campaignId?: string,
  options?: Partial<UseRealtimeSubscriptionOptions<'campaigns'>>
) {
  return useRealtimeSubscription({
    table: 'campaigns',
    filter: campaignId ? `id=eq.${campaignId}` : undefined,
    ...options,
  })
}

// Specialized hook for call subscriptions
export function useCallSubscription(
  filters?: {
    campaignId?: string
    status?: string[]
  },
  options?: Partial<UseRealtimeSubscriptionOptions<'calls'>>
) {
  const filterStrings: string[] = []

  if (filters?.campaignId) {
    filterStrings.push(`campaign_id=eq.${filters.campaignId}`)
  }

  if (filters?.status && filters.status.length > 0) {
    // Fix: Use proper IN syntax for multiple values
    const statusFilter = `status=in.(${filters.status.join(',')})`
    filterStrings.push(statusFilter)
  }

  return useRealtimeSubscription({
    table: 'calls',
    filter: filterStrings.length > 0 ? filterStrings.join(' AND ') : undefined,
    ...options,
  })
}

// Hook for aggregated stats subscriptions
export function useStatsSubscription<T extends TableName>(
  table: T,
  entityId: string,
  aggregationWindow?: number
) {
  const [stats, setStats] = useState<Tables[T]['Row'] | null>(null)
  const aggregationBuffer = useRef<Array<RealtimePostgresChangesPayload<Tables[T]['Row']>>>([])
  const aggregationTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const processAggregation = useCallback(() => {
    if (aggregationBuffer.current.length === 0) return

    // Process buffered events
    const latestEvent = aggregationBuffer.current[aggregationBuffer.current.length - 1]
    if (latestEvent.new) {
      setStats(latestEvent.new as Tables[T]['Row'])
    }

    // Clear buffer
    aggregationBuffer.current = []
  }, [])

  const handleStatsChange = useCallback(
    (payload: RealtimePostgresChangesPayload<Tables[T]['Row']>) => {
      if (aggregationWindow && aggregationWindow > 0) {
        // Buffer events for aggregation
        aggregationBuffer.current.push(payload)

        // Reset timer
        if (aggregationTimer.current) {
          clearTimeout(aggregationTimer.current)
          aggregationTimer.current = undefined
        }

        // Set new timer
        aggregationTimer.current = setTimeout(processAggregation, aggregationWindow)
      } else {
        // Immediate update
        if (payload.new) {
          setStats(payload.new as Tables[T]['Row'])
        }
      }
    },
    [aggregationWindow, processAggregation]
  )

  const subscription = useRealtimeSubscription({
    table,
    filter: `id=eq.${entityId}`,
    onChange: handleStatsChange,
  })

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (aggregationTimer.current) {
        clearTimeout(aggregationTimer.current)
        aggregationTimer.current = undefined
      }
    }
  }, [])

  return {
    stats,
    ...subscription,
  }
}
