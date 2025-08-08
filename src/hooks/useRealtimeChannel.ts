/**
 * React hook for Supabase realtime channels with automatic cleanup
 * Prevents memory leaks by ensuring channels are always removed on unmount
 * Optimized for React 19.1 with performance tracking and throttling
 */

import { useEffect, useRef, useCallback, useMemo, startTransition } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { channelBlog, removeChannelBlog, isUsingBlogPlaceholder } from '../lib/supabase-blog'
import { performanceMonitor } from '../lib/performance-monitor'

interface UseRealtimeChannelOptions {
  enabled?: boolean
  onError?: (error: Error) => void
  throttleMs?: number
  priority?: 'high' | 'normal' | 'low'
  enablePerformanceTracking?: boolean
}

/**
 * Hook that manages realtime channel lifecycle with automatic cleanup
 * 
 * @param channelName - Unique name for the channel
 * @param setupChannel - Function that configures the channel (add event listeners, etc)
 * @param options - Configuration options
 * @returns The active channel or null if disabled/using placeholders
 * 
 * @example
 * ```tsx
 * const channel = useRealtimeChannel(
 *   `comments:${postId}`,
 *   (channel) => {
 *     channel
 *       .on('postgres_changes', { 
 *         event: '*', 
 *         schema: 'public', 
 *         table: 'comments', 
 *         filter: `post_id=eq.${postId}` 
 *       }, handleNewComment)
 *       .subscribe()
 *   },
 *   { enabled: !!postId }
 * )
 * ```
 */
export function useRealtimeChannel(
  channelName: string,
  setupChannel: (channel: RealtimeChannel) => void,
  options: UseRealtimeChannelOptions = {}
): RealtimeChannel | null {
  const { 
    enabled = true, 
    onError, 
    throttleMs = 100,
    priority = 'normal',
    enablePerformanceTracking = process.env.NODE_ENV === 'development'
  } = options
  const channelRef = useRef<RealtimeChannel | null>(null)
  const setupStartTime = useRef<number>(0)
  const throttleTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const pendingUpdates = useRef<unknown[]>([])

  // Memoized throttled update handler
  const throttledHandler = useCallback((handler: (payload: unknown) => void) => {
    return (payload: unknown) => {
      if (priority === 'high') {
        handler(payload)
        return
      }
      
      pendingUpdates.current.push(payload)
      
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current)
      }
      
      throttleTimeoutRef.current = setTimeout(() => {
        const updates = pendingUpdates.current.splice(0)
        
        if (priority === 'low') {
          startTransition(() => {
            updates.forEach(handler)
          })
        } else {
          updates.forEach(handler)
        }
      }, throttleMs)
    }
  }, [throttleMs, priority])
  
  // Memoized setup function to prevent unnecessary re-subscriptions
  const memoizedSetupChannel = useMemo(() => setupChannel, [setupChannel])

  useEffect(() => {
    // Skip if disabled or using placeholder config
    if (!enabled || isUsingBlogPlaceholder) {
      return
    }

    if (enablePerformanceTracking) {
      setupStartTime.current = performance.now()
    }

    try {
      // Create and setup channel
      const channel = channelBlog(channelName)
      channelRef.current = channel
      
      // Wrap the original setup with performance tracking
      if (enablePerformanceTracking) {
        const originalSetup = memoizedSetupChannel
        const wrappedSetup = (ch: RealtimeChannel) => {
          const start = performance.now()
          originalSetup(ch)
          const duration = performance.now() - start
          performanceMonitor.trackComponentRender(`RealtimeChannel-${channelName}`, duration)
        }
        wrappedSetup(channel)
      } else {
        memoizedSetupChannel(channel)
      }

      if (enablePerformanceTracking) {
        const totalSetupTime = performance.now() - setupStartTime.current
        console.log(`[Realtime] Channel ${channelName} setup in ${totalSetupTime.toFixed(2)}ms`)
      }

      // Cleanup function
      return () => {
        // Clear any pending throttled updates
        if (throttleTimeoutRef.current) {
          clearTimeout(throttleTimeoutRef.current)
        }
        pendingUpdates.current = []
        
        if (channelRef.current) {
          if (enablePerformanceTracking) {
            console.log(`[Realtime] Cleaning up channel: ${channelName}`)
          }
          removeChannelBlog(channelRef.current)
          channelRef.current = null
        }
      }
    } catch (error) {
      console.error(`Failed to setup realtime channel ${channelName}:`, error)
      onError?.(error as Error)
    }
  }, [channelName, enabled, memoizedSetupChannel, onError, enablePerformanceTracking, throttledHandler]) // Include all dependencies

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current)
      }
    }
  }, [])

  return channelRef.current
}

/**
 * Typed hook for blog post comment updates
 */
export function usePostCommentsChannel(
  postId: string,
  onNewComment: (payload: unknown) => void,
  options?: UseRealtimeChannelOptions
) {
  // Memoize the callback to prevent unnecessary re-subscriptions
  const memoizedCallback = useCallback(onNewComment, [onNewComment])
  
  const setupChannel = useCallback((channel: RealtimeChannel) => {
    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'blog_comments',
          filter: `post_id=eq.${postId}`,
        },
        memoizedCallback
      )
      .subscribe()
  }, [postId, memoizedCallback])
  
  return useRealtimeChannel(
    `comments:${postId}`,
    setupChannel,
    {
      priority: 'normal',
      throttleMs: 200,
      ...options
    }
  )
}

/**
 * Typed hook for blog post view count updates
 */
export function usePostViewsChannel(
  postId: string,
  onViewUpdate: (payload: unknown) => void,
  options?: UseRealtimeChannelOptions
) {
  // Memoize the callback to prevent unnecessary re-subscriptions
  const memoizedCallback = useCallback(onViewUpdate, [onViewUpdate])
  
  const setupChannel = useCallback((channel: RealtimeChannel) => {
    channel
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'blog_posts',
          filter: `id=eq.${postId}`,
        },
        memoizedCallback
      )
      .subscribe()
  }, [postId, memoizedCallback])
  
  return useRealtimeChannel(
    `views:${postId}`,
    setupChannel,
    {
      priority: 'low', // Views are less critical
      throttleMs: 1000, // Throttle view updates more aggressively
      ...options
    }
  )
}

/**
 * Hook for call tracking updates with high priority
 */
export function useCallTrackingChannel(
  campaignId: string,
  onCallUpdate: (payload: unknown) => void,
  options?: UseRealtimeChannelOptions
) {
  const memoizedCallback = useCallback(onCallUpdate, [onCallUpdate])
  
  const setupChannel = useCallback((channel: RealtimeChannel) => {
    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public', 
          table: 'calls',
          filter: `campaign_id=eq.${campaignId}`,
        },
        memoizedCallback
      )
      .subscribe()
  }, [campaignId, memoizedCallback])
  
  return useRealtimeChannel(
    `calls:${campaignId}`,
    setupChannel,
    {
      priority: 'high', // Call tracking is critical
      throttleMs: 50, // Very responsive for calls
      enablePerformanceTracking: true,
      ...options
    }
  )
}

/**
 * Cleanup utility for development
 */
export function useRealtimeDebugger() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const logActiveChannels = () => {
        console.log('[Realtime] Active channels:', performanceMonitor.getComponentStats('RealtimeChannel'))
      }
      
      const interval = setInterval(logActiveChannels, 30000) // Log every 30s
      return () => clearInterval(interval)
    }
  }, [])
}