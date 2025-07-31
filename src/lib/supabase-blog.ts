import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database-extended'

// Environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

/**
 * Blog-specific Supabase client optimized for client-side public operations
 * 
 * This client is separate from the main auth client and is configured to:
 * - Disable auth to prevent multiple GoTrueClient instances
 * - Enable public data access for blog posts, categories, tags
 * - Use anon key for public operations only
 */
const blogClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
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
) => blogClient.from(table)

/**
 * Call blog-related stored procedures/functions
 * Used for complex blog queries, search, and analytics
 */
export const rpcBlog = <T extends keyof Database['public']['Functions']>(
  fn: T,
  args?: Database['public']['Functions'][T]['Args']
) => blogClient.rpc(fn, args)

/**
 * Create realtime channels for blog updates
 * Used for live comment updates, post view counts, etc.
 */
export const channelBlog = (name: string) => blogClient.channel(name)

/**
 * Remove realtime channels
 */
export const removeChannelBlog = (channel: ReturnType<typeof blogClient.channel>) => blogClient.removeChannel(channel)

/**
 * Get current session info (mainly for debugging)
 * Blog client should always use anon session
 */
export const getBlogSession = () => blogClient.auth.getSession()

/**
 * Export the blog client for cases where direct access is needed
 * Use sparingly to maintain abstraction benefits
 */
export const supabaseBlog = blogClient

// Type exports
export type { Database }