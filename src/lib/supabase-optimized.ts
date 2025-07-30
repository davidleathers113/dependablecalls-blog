import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.generated'

// Environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Create the client with optimized configuration
const supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false, // We'll handle refresh via server-side
    persistSession: false, // No localStorage, using httpOnly cookies
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: {
      // Custom storage that does nothing - all session handling is server-side
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {},
    },
  },
})

/**
 * Optimized Supabase exports for better tree-shaking and bundle size reduction.
 * Only exports the methods actually used in the DCE application.
 */

// Auth exports - Authentication and session management
export const auth = supabaseClient.auth

/**
 * Send a magic link to the user's email for authentication
 * Used in: LoginPage, AuthStore
 */
export const signInWithOtp = auth.signInWithOtp.bind(auth)

/**
 * Create a new user account with email and password
 * Used in: RegisterPage, AuthStore
 */
export const signUp = auth.signUp.bind(auth)

/**
 * Sign in with email and password (fallback method)
 * Used in: AuthStore (server-side auth flow)
 */
export const signInWithPassword = auth.signInWithPassword.bind(auth)

/**
 * Get the current user session
 * Used in: All stores, middleware, auth guards
 */
export const getSession = auth.getSession.bind(auth)

/**
 * Get the current user object
 * Used in: AuthStore, user profile components
 */
export const getUser = auth.getUser.bind(auth)

/**
 * Listen for authentication state changes
 * Used in: App.tsx, AuthLayout
 */
export const onAuthStateChange = auth.onAuthStateChange.bind(auth)

/**
 * Sign out the current user (client-side only)
 * Note: DCE uses server-side logout via Netlify functions for httpOnly cookies
 */
export const signOut = auth.signOut.bind(auth)

// Database exports - CRUD operations and queries
/**
 * Access database tables with full TypeScript support
 * Used in: All stores, API routes, data fetching hooks
 * @example
 * const { data } = await from('campaigns').select('*').eq('buyer_id', userId)
 */
export const from = <T extends keyof Database['public']['Tables']>(
  table: T
) => supabaseClient.from(table)

/**
 * Access database views with full TypeScript support
 * Used in: Dashboard components, analytics, reporting
 * @example
 * const { data } = await fromView('supplier_stats_view').select('*').eq('supplier_id', supplierId)
 */
export const fromView = <T extends keyof Database['public']['Views']>(
  view: T
) => supabaseClient.from(view)

/**
 * Call stored procedures/functions in the database
 * Used in: Analytics, batch operations, complex queries
 * @example
 * const { data } = await rpc('get_call_stats', { start_date: '2024-01-01' })
 */
export const rpc = <T extends keyof Database['public']['Functions']>(
  fn: T,
  args?: Database['public']['Functions'][T]['Args']
) => supabaseClient.rpc(fn, args)

// Realtime exports - Live data subscriptions
/**
 * Create a realtime channel for live updates
 * Used in: Dashboard components, call tracking, live stats
 * @example
 * const callUpdates = channel('call-updates')
 *   .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls' }, callback)
 *   .subscribe()
 */
export const channel = (name: string) => supabaseClient.channel(name)

/**
 * Remove and cleanup a realtime channel
 * Used in: Component cleanup, subscription management
 */
export const removeChannel = (channel: any) => supabaseClient.removeChannel(channel)

// Export the full client for cases where it's still needed
// This should be used sparingly to maintain tree-shaking benefits
export const supabase = supabaseClient

// Type exports for better developer experience
export type { SupabaseClient, Database }