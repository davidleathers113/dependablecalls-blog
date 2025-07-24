import { useEffect, useState, useCallback, useRef } from 'react'
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
  const [state, setState] = useState<RealtimeState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    lastEvent: null,
  })

  const handleRealtimeEvent = useCallback(
    (payload: RealtimePostgresChangesPayload<Tables[T]['Row']>) => {
      setState((prev) => ({ ...prev, lastEvent: new Date() }))

      // Call specific event handlers
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

      // Call general change handler
      onChange?.(payload)
    },
    [onInsert, onUpdate, onDelete, onChange]
  )

  const subscribe = useCallback(async () => {
    if (!enabled || channelRef.current) return

    setState((prev) => ({ ...prev, isConnecting: true, error: null }))

    try {
      // Generate unique channel name
      const channelName = `realtime:${table}:${filter || 'all'}:${Date.now()}`

      // Create subscription configuration
      const config = {
        event,
        schema: 'public',
        table,
        filter,
      }

      // Create and subscribe to channel
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes' as const,
          config,
          (payload: RealtimePostgresChangesPayload<Tables[T]['Row']>) => {
            handleRealtimeEvent(payload)
          }
        )
        .subscribe((status, error) => {
          if (status === 'SUBSCRIBED') {
            setState((prev) => ({
              ...prev,
              isConnected: true,
              isConnecting: false,
            }))
          } else if (status === 'CHANNEL_ERROR') {
            setState((prev) => ({
              ...prev,
              isConnected: false,
              isConnecting: false,
              error: error || new Error('Failed to subscribe to channel'),
            }))
          } else if (status === 'TIMED_OUT') {
            setState((prev) => ({
              ...prev,
              isConnected: false,
              isConnecting: false,
              error: new Error('Subscription timed out'),
            }))
          }
        })

      channelRef.current = channel
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      }))
    }
  }, [enabled, table, filter, event, supabase, handleRealtimeEvent])

  const unsubscribe = useCallback(async () => {
    if (!channelRef.current) return

    try {
      await supabase.removeChannel(channelRef.current)
      channelRef.current = null
      setState((prev) => ({
        ...prev,
        isConnected: false,
        error: null,
      }))
    } catch (error) {
      console.error('Error unsubscribing:', error)
    }
  }, [supabase])

  // Auto-subscribe on mount and config changes
  useEffect(() => {
    subscribe()

    return () => {
      unsubscribe()
    }
  }, [subscribe, unsubscribe])

  // Reconnect on connection loss
  useEffect(() => {
    const checkConnection = setInterval(() => {
      if (channelRef.current && !state.isConnected && !state.isConnecting) {
        console.log('Attempting to reconnect...')
        unsubscribe().then(subscribe)
      }
    }, 5000) // Check every 5 seconds

    return () => clearInterval(checkConnection)
  }, [state.isConnected, state.isConnecting, subscribe, unsubscribe])

  return {
    ...state,
    subscribe,
    unsubscribe,
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
    const statusFilter = filters.status.map((s) => `status=eq.${s}`).join(',')
    filterStrings.push(`(${statusFilter})`)
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
  const aggregationTimer = useRef<NodeJS.Timeout | undefined>()

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
      }
    }
  }, [])

  return {
    stats,
    ...subscription,
  }
}
