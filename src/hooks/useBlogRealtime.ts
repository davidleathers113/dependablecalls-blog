import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRealtimeSubscription } from './useRealtimeSubscription'
import { blogQueryKeys } from './useBlog'
import type { BlogPost, BlogComment, BlogAuthor } from '../types/blog'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { Database } from '../types/database'

type Tables = Database['public']['Tables']

/**
 * Hook to subscribe to new blog posts in real-time
 */
export function useNewBlogPosts(options?: {
  authorId?: string
  categoryId?: string
  enabled?: boolean
  onNewPost?: (post: BlogPost) => void
}) {
  const queryClient = useQueryClient()
  const { authorId, enabled = true, onNewPost } = options || {}

  // Build filter string
  const filters: string[] = ['status=eq.published']
  if (authorId) filters.push(`author_id=eq.${authorId}`)
  
  const handleInsert = useCallback(
    (payload: RealtimePostgresChangesPayload<BlogPost>) => {
      if (payload.new) {
        // Call custom handler if provided
        onNewPost?.(payload.new as BlogPost)

        // Invalidate posts list to show new post
        queryClient.invalidateQueries({ 
          queryKey: blogQueryKeys.posts.lists() 
        })
      }
    },
    [queryClient, onNewPost]
  )

  return useRealtimeSubscription({
    table: 'blog_posts',
    filter: filters.join(' AND '),
    event: 'INSERT',
    enabled,
    onInsert: handleInsert,
  })
}

/**
 * Hook to subscribe to updates for a specific blog post
 */
export function useBlogPostUpdates(postId: string, options?: {
  enabled?: boolean
  onUpdate?: (post: BlogPost) => void
}) {
  const queryClient = useQueryClient()
  const { enabled = true, onUpdate } = options || {}

  const handleUpdate = useCallback(
    (payload: RealtimePostgresChangesPayload<BlogPost>) => {
      if (payload.new) {
        const updatedPost = payload.new as BlogPost
        
        // Call custom handler if provided
        onUpdate?.(updatedPost)

        // Update the specific post in cache
        queryClient.setQueryData(
          blogQueryKeys.posts.detail(updatedPost.slug),
          updatedPost
        )

        // Invalidate posts list
        queryClient.invalidateQueries({ 
          queryKey: blogQueryKeys.posts.lists() 
        })
      }
    },
    [queryClient, onUpdate]
  )

  return useRealtimeSubscription({
    table: 'blog_posts',
    filter: `id=eq.${postId}`,
    event: 'UPDATE',
    enabled: enabled && !!postId,
    onUpdate: handleUpdate,
  })
}

/**
 * Hook to subscribe to new comments on a blog post
 */
export function useBlogComments(postId: string, options?: {
  enabled?: boolean
  onNewComment?: (comment: BlogComment) => void
  onCommentUpdate?: (comment: BlogComment) => void
  onCommentDelete?: (comment: BlogComment) => void
}) {
  const queryClient = useQueryClient()
  const { 
    enabled = true, 
    onNewComment, 
    onCommentUpdate, 
    onCommentDelete 
  } = options || {}

  const handleInsert = useCallback(
    (payload: RealtimePostgresChangesPayload<BlogComment>) => {
      if (payload.new) {
        const newComment = payload.new as BlogComment
        
        // Call custom handler if provided
        onNewComment?.(newComment)

        // Invalidate comments for this post
        queryClient.invalidateQueries({ 
          queryKey: blogQueryKeys.comments.list({ postId }) 
        })

        // Update post comment count if needed
        queryClient.invalidateQueries({ 
          queryKey: blogQueryKeys.posts.detail(postId) 
        })
      }
    },
    [queryClient, postId, onNewComment]
  )

  const handleUpdate = useCallback(
    (payload: RealtimePostgresChangesPayload<BlogComment>) => {
      if (payload.new) {
        const updatedComment = payload.new as BlogComment
        
        // Call custom handler if provided
        onCommentUpdate?.(updatedComment)

        // Invalidate comments for this post
        queryClient.invalidateQueries({ 
          queryKey: blogQueryKeys.comments.list({ postId }) 
        })
      }
    },
    [queryClient, postId, onCommentUpdate]
  )

  const handleDelete = useCallback(
    (payload: RealtimePostgresChangesPayload<BlogComment>) => {
      if (payload.old) {
        const deletedComment = payload.old as BlogComment
        
        // Call custom handler if provided
        onCommentDelete?.(deletedComment)

        // Invalidate comments for this post
        queryClient.invalidateQueries({ 
          queryKey: blogQueryKeys.comments.list({ postId }) 
        })

        // Update post comment count
        queryClient.invalidateQueries({ 
          queryKey: blogQueryKeys.posts.detail(postId) 
        })
      }
    },
    [queryClient, postId, onCommentDelete]
  )

  return useRealtimeSubscription({
    table: 'blog_comments',
    filter: `post_id=eq.${postId}`,
    enabled: enabled && !!postId,
    onInsert: handleInsert,
    onUpdate: handleUpdate,
    onDelete: handleDelete,
  })
}

/**
 * Hook to subscribe to author profile updates
 */
export function useAuthorUpdates(authorId: string, options?: {
  enabled?: boolean
  onUpdate?: (author: BlogAuthor) => void
}) {
  const queryClient = useQueryClient()
  const { enabled = true, onUpdate } = options || {}

  const handleUpdate = useCallback(
    (payload: unknown) => {
      const typedPayload = payload as RealtimePostgresChangesPayload<Tables['blog_authors']['Row']>
      if (typedPayload.new) {
        // Map database row to BlogAuthor type
        const author = typedPayload.new as unknown as BlogAuthor
        
        // Call custom handler if provided
        onUpdate?.(author)

        // Invalidate author profile
        queryClient.invalidateQueries({ 
          queryKey: blogQueryKeys.authors.profile(authorId) 
        })

        // Invalidate posts by this author
        queryClient.invalidateQueries({ 
          queryKey: blogQueryKeys.posts.lists() 
        })
      }
    },
    [queryClient, authorId, onUpdate]
  )

  return useRealtimeSubscription({
    table: 'blog_authors',
    filter: `id=eq.${authorId}`,
    event: 'UPDATE',
    enabled: enabled && !!authorId,
    onUpdate: handleUpdate,
  })
}

/**
 * Hook to subscribe to blog statistics updates
 */
export function useBlogStatsRealtime(options?: {
  authorId?: string
  enabled?: boolean
  aggregationWindow?: number
}) {
  const queryClient = useQueryClient()
  const { authorId, enabled = true, aggregationWindow = 5000 } = options || {}

  // For global stats, we'll need to listen to multiple tables
  const postsSubscription = useRealtimeSubscription({
    table: 'blog_posts',
    filter: authorId ? `author_id=eq.${authorId}` : undefined,
    enabled,
    onChange: () => {
      // Debounce stats invalidation
      setTimeout(() => {
        queryClient.invalidateQueries({ 
          queryKey: authorId 
            ? blogQueryKeys.statistics.author(authorId)
            : blogQueryKeys.statistics.global()
        })
      }, aggregationWindow)
    },
  })

  const commentsSubscription = useRealtimeSubscription({
    table: 'blog_comments',
    enabled: enabled && !authorId, // Only for global stats
    onChange: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ 
          queryKey: blogQueryKeys.statistics.global()
        })
      }, aggregationWindow)
    },
  })

  return {
    postsSubscription,
    commentsSubscription,
    isConnected: postsSubscription.isConnected && (!authorId || commentsSubscription.isConnected),
    error: postsSubscription.error || commentsSubscription.error,
  }
}

/**
 * Hook to subscribe to all blog-related real-time updates for a dashboard
 */
export function useBlogDashboardRealtime(options?: {
  authorId?: string
  enabled?: boolean
}) {
  const { authorId, enabled = true } = options || {}

  // Subscribe to new posts
  const newPosts = useNewBlogPosts({
    authorId,
    enabled,
  })

  // Subscribe to stats updates
  const stats = useBlogStatsRealtime({
    authorId,
    enabled,
    aggregationWindow: 10000, // 10 seconds for dashboard
  })

  // Subscribe to new comments on author's posts if authorId is provided
  const comments = useRealtimeSubscription({
    table: 'blog_comments',
    enabled: enabled && !!authorId,
    onInsert: (payload) => {
      // Could show a notification here
      console.log('New comment on your post:', payload.new)
    },
  })

  return {
    newPosts,
    stats,
    comments,
    isConnected: newPosts.isConnected && stats.isConnected && comments.isConnected,
    error: newPosts.error || stats.error || comments.error,
  }
}