/**
 * Main Supabase client module
 * Uses singleton pattern to prevent multiple GoTrueClient instances
 */
import { getSupabaseClient, type SupabaseClientType } from './supabase-singleton'

// Lazy initialization to use singleton pattern
let _supabaseClient: SupabaseClientType | null = null

/**
 * Get the Supabase client instance
 * This ensures we only ever have one client instance in the browser
 */
function getClient(): SupabaseClientType | null {
  if (_supabaseClient === null) {
    try {
      _supabaseClient = getSupabaseClient()
    } catch (error) {
      // Return null if configuration is missing (placeholder values)
      if (import.meta.env.MODE === 'development') {
        console.warn('[Supabase] Client initialization failed:', error)
      }
      return null
    }
  }
  return _supabaseClient
}

/**
 * Export the supabase client
 * For backward compatibility, we export it as a direct reference
 * But internally it uses the singleton pattern
 */
export const supabase = getClient()