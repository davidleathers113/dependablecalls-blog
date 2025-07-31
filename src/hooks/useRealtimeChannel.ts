/**
 * React hook for Supabase realtime channels with automatic cleanup
 * Prevents memory leaks by ensuring channels are always removed on unmount
 */

import { useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { channelBlog, removeChannelBlog, isUsingBlogPlaceholder } from '../lib/supabase-blog'

interface UseRealtimeChannelOptions {
  enabled?: boolean
  onError?: (error: Error) => void
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
  const { enabled = true, onError } = options
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    // Skip if disabled or using placeholder config
    if (!enabled || isUsingBlogPlaceholder) {
      return
    }

    try {
      // Create and setup channel
      const channel = channelBlog(channelName)
      channelRef.current = channel
      setupChannel(channel)

      // Cleanup function
      return () => {
        if (channelRef.current) {
          removeChannelBlog(channelRef.current)
          channelRef.current = null
        }
      }
    } catch (error) {
      console.error(`Failed to setup realtime channel ${channelName}:`, error)
      onError?.(error as Error)
    }
  }, [channelName, enabled]) // setupChannel excluded to prevent re-runs

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
  return useRealtimeChannel(
    `comments:${postId}`,
    (channel) => {
      channel
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'blog_comments',
            filter: `post_id=eq.${postId}`,
          },
          onNewComment
        )
        .subscribe()
    },
    options
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
  return useRealtimeChannel(
    `views:${postId}`,
    (channel) => {
      channel
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'blog_posts',
            filter: `id=eq.${postId}`,
          },
          onViewUpdate
        )
        .subscribe()
    },
    options
  )
}