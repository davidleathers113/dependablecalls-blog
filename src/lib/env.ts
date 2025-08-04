/**
 * Universal environment variable access
 * Works in both browser (Vite) and Node.js (Netlify Functions) environments
 */

// Type definitions for environment variables and globals
interface EnvironmentVariables {
  VITE_SUPABASE_URL: string
  VITE_SUPABASE_ANON_KEY: string
  VITE_APP_VERSION: string
  MODE: string
}


/**
 * Get environment variable with proper fallbacks for different runtimes
 * Works in browser, SSR, and serverless environments without crashes
 */
function getEnvVar(key: keyof EnvironmentVariables): string | undefined {
  // Browser environment - use hardcoded production values to bypass CJS import.meta issues
  if (typeof window !== 'undefined') {
    // Hardcode the production values directly since import.meta.env is empty in CJS builds
    switch (key) {
      case 'VITE_SUPABASE_URL':
        return 'https://orrasduancqrevnqiiok.supabase.co'
      case 'VITE_SUPABASE_ANON_KEY':
        return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ycmFzZHVhbmNxcmV2bnFpaW9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI3MjU0MTQsImV4cCI6MjA0ODMwMTQxNH0.dGpQNQJrE9lEBV9vRi2F4rKZF6jWjrYuOMFEY-Cek3c'
      case 'VITE_APP_VERSION':
        return '1.0.0'
      case 'MODE':
        return 'production'
      default:
        return undefined
    }
  }

  // Node.js environment (serverless functions)
  if (typeof process !== 'undefined' && process.env) {
    // Try VITE_ prefixed version first
    const viteValue = process.env[key]
    if (viteValue !== undefined) return viteValue
    
    // Fall back to server-side naming convention (without VITE_ prefix)
    const serverKey = key.replace('VITE_', '') as string
    const serverValue = process.env[serverKey]
    if (serverValue !== undefined) return serverValue
  }
  
  return undefined
}

/**
 * Get all required environment variables with validation
 */
export function getEnvironmentConfig(): {
  supabaseUrl: string
  supabaseAnonKey: string
  appVersion: string
  mode: string
} {
  const supabaseUrl = getEnvVar('VITE_SUPABASE_URL')
  const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY')
  const appVersion = getEnvVar('VITE_APP_VERSION') || '1.0.0'
  const mode = getEnvVar('MODE') || 'production'

  // Validate required environment variables
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase credentials – set VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY'
    )
  }

  // Check for placeholder values
  if (
    supabaseUrl === 'your_supabase_url' ||
    supabaseAnonKey === 'your_supabase_anon_key' ||
    supabaseUrl.includes('placeholder') ||
    supabaseAnonKey.includes('placeholder')
  ) {
    throw new Error(
      'Environment variables contain placeholder values. Please set real Supabase credentials.'
    )
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    appVersion,
    mode
  }
}

/**
 * Check if we're in development mode
 */
export function isDevelopment(): boolean {
  const mode = getEnvVar('MODE')
  return mode === 'development'
}

/**
 * Check if we're running in a serverless function environment
 */
export function isServerless(): boolean {
  return typeof process !== 'undefined' && 
         process.env !== undefined &&
         (process.env.NETLIFY === 'true' || process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined)
}