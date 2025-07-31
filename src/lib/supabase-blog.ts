import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database-extended'

// Environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Check if we're using placeholder/mock configuration
const isPlaceholderConfig = !supabaseUrl || 
  !supabaseAnonKey ||
  supabaseUrl.includes('your-project.supabase.co') ||
  supabaseUrl === 'your_supabase_url' ||
  supabaseAnonKey === 'your_supabase_anon_key'

/**
 * Blog-specific Supabase client optimized for client-side public operations
 * 
 * This client is separate from the main auth client and is configured to:
 * - Disable auth to prevent multiple GoTrueClient instances
 * - Enable public data access for blog posts, categories, tags
 * - Use anon key for public operations only
 */
const blogClient = isPlaceholderConfig ? null : createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,     // Disable auth - use main client for auth
    persistSession: false,       // No session management in blog client
    detectSessionInUrl: false,   // Don't handle auth redirects
    storage: {
      // Disable auth storage to prevent conflicts
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {},
    },
  },
  db: {
    schema: 'public'             // Explicitly use public schema
  },
  global: {
    headers: {
      'X-Client-Info': 'dce-blog-client'  // Identify requests from blog client
    }
  }
})

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
 */
export const isUsingBlogPlaceholder = isPlaceholderConfig

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