import { supabase } from './supabase'
import type { Database } from '../types/database-extended'

/**
 * Blog-specific Supabase client that reuses the main Supabase client instance
 * 
 * This approach prevents multiple Supabase client instances while maintaining:
 * - Blog-specific error handling and mock data fallback
 * - Public data access for blog posts, categories, tags
 * - Separation of concerns between auth and blog operations
 * 
 * Note: The main client's auth configuration is preserved, but blog operations
 * are designed to work with public/anon access patterns only.
 */
const blogClient = supabase

/**
 * Blog-specific database query helpers
 * Optimized for public blog operations with proper error handling
 */

/**
 * Access blog database tables with full TypeScript support
 * Used exclusively for blog-related queries (posts, categories, tags, comments)
 */
export const fromBlog = <T extends keyof Database['public']['Tables']>(
  table: T
) => {
  if (!blogClient) {
    throw new Error('Blog database not available - using mock data mode')
  }
  return blogClient.from(table)
}

/**
 * Call blog-related stored procedures/functions
 * Used for complex blog queries, search, and analytics
 */
export const rpcBlog = <T extends keyof Database['public']['Functions']>(
  fn: T,
  args?: Database['public']['Functions'][T]['Args']
) => {
  if (!blogClient) {
    throw new Error('Blog database not available - using mock data mode')
  }
  return blogClient.rpc(fn, args)
}

/**
 * Create realtime channels for blog updates
 * Used for live comment updates, post view counts, etc.
 */
export const channelBlog = (name: string) => {
  if (!blogClient) {
    throw new Error('Blog database not available - using mock data mode')
  }
  return blogClient.channel(name)
}

/**
 * Remove realtime channels
 */
export const removeChannelBlog = (channel: Parameters<NonNullable<typeof blogClient>['removeChannel']>[0]) => {
  if (!blogClient) {
    throw new Error('Blog database not available - using mock data mode')
  }
  return blogClient.removeChannel(channel)
}

/**
 * Get current session info (mainly for debugging)
 * Blog client should always use anon session
 */
export const getBlogSession = () => {
  if (!blogClient) {
    throw new Error('Blog database not available - using mock data mode')
  }
  return blogClient.auth.getSession()
}

/**
 * Export the blog client for cases where direct access is needed
 * Use sparingly to maintain abstraction benefits
 */
export const supabaseBlog = blogClient

/**
 * Check if we're using placeholder configuration
 * Uses the same logic as the main Supabase client
 */
export const isUsingBlogPlaceholder = !supabase

/**
 * Helper that throws at call-site rather than on import
 * This prevents module-load crashes when env vars are missing
 */
export function assertBlogClient() {
  if (!supabaseBlog) {
    throw new Error(
      'Supabase blog client not initialized - check env variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY'
    )
  }
  return supabaseBlog
}

// Type exports
export type { Database }