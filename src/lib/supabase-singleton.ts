import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database-extended'
import { SupabaseDebugger } from './supabase-debug'
import { getEnvironmentConfig, isDevelopment } from './env'

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

  // Get environment configuration (works in both browser and Node.js)
  const { supabaseUrl, supabaseAnonKey, appVersion } = getEnvironmentConfig()

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
        'x-client-version': appVersion,
      }
    }
  })

  // Store in global scope
  globalThis.__supabaseClient = client

  // Development logging (minimal to avoid console spam)
  if (isDevelopment()) {
    SupabaseDebugger.logInstance(supabaseUrl)
  }

  return client
}

/**
 * Development-only utilities for debugging
 * Tree-shaken in production builds
 */
/* #__PURE__ */
if (isDevelopment() && typeof window !== 'undefined') {
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