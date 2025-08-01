import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database-extended'
import { SupabaseDebugger } from './supabase-debug'

// Global instance to survive HMR and module re-evaluation
declare global {
  var __supabaseClient: SupabaseClient<Database> | undefined
  var __supabaseInstanceCount: number | undefined
}

/**
 * Production-ready singleton implementation for Supabase client
 * Uses global scope to prevent multiple instances across HMR/bundles
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  // Return existing global instance
  if (globalThis.__supabaseClient) {
    return globalThis.__supabaseClient
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  // Check for placeholder values
  const isPlaceholderConfig = 
    !supabaseUrl || 
    !supabaseAnonKey || 
    supabaseUrl === 'your_supabase_url' ||
    supabaseAnonKey === 'your_supabase_anon_key'

  if (isPlaceholderConfig) {
    throw new Error(
      'Supabase configuration missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.'
    )
  }

  // Initialize counter
  if (globalThis.__supabaseInstanceCount === undefined) {
    globalThis.__supabaseInstanceCount = 0
  }
  
  globalThis.__supabaseInstanceCount++

  // Create the client instance with security-hardened settings
  const client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false, // Prevent background refresh timers
      persistSession: false, // No client-side persistence
      detectSessionInUrl: false, // Prevent token exposure in URL
      flowType: 'pkce', // Secure auth flow
      // No storage adapter - all auth handled server-side
    },
    global: {
      headers: {
        'x-client-version': import.meta.env.VITE_APP_VERSION || '1.0.0',
      }
    }
  })

  // Store in global scope
  globalThis.__supabaseClient = client

  // Development logging (minimal to avoid console spam)
  if (import.meta.env.MODE === 'development') {
    SupabaseDebugger.logInstance(supabaseUrl)
  }

  return client
}

/**
 * Development-only utilities for debugging
 * Tree-shaken in production builds
 */
/* #__PURE__ */
if (import.meta.env.MODE === 'development' && typeof window !== 'undefined') {
  interface WindowWithSupabaseDebug extends Window {
    __supabaseDebug: {
      reset: () => Promise<void>
      getInstanceCount: () => number
      hasInstance: () => boolean
    }
  }

  (window as unknown as WindowWithSupabaseDebug).__supabaseDebug = {
    reset: async () => {
      if (globalThis.__supabaseClient) {
        // Stop auto-refresh to prevent memory leaks
        globalThis.__supabaseClient.auth.stopAutoRefresh()
        
        // Await cleanup of all channels
        await globalThis.__supabaseClient.removeAllChannels()
        
        // Clear global references
        globalThis.__supabaseClient = undefined
        globalThis.__supabaseInstanceCount = 0
        
        console.info('[SupabaseDebug] Client reset complete')
      }
    },
    getInstanceCount: () => globalThis.__supabaseInstanceCount || 0,
    hasInstance: () => globalThis.__supabaseClient !== undefined,
  }
}

/**
 * Export type for the Supabase client
 */
export type SupabaseClientType = SupabaseClient<Database>