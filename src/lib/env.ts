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

// Type for window/globalThis environment injection
interface WindowWithEnv extends Window {
  __ENV__?: Record<string, string>
  __VITE_ENV__?: Record<string, string>
}

interface GlobalThisWithEnv {
  __ENV__?: Record<string, string>
  __VITE_ENV__?: Record<string, string>
}

// Type for import.meta access
interface GlobalWithImportMeta {
  import?: {
    meta?: {
      env?: Record<string, string>
    }
  }
}

/**
 * Get environment variable with proper fallbacks for different runtimes
 * Handles different naming conventions between client and server
 */
function getEnvVar(key: keyof EnvironmentVariables): string | undefined {
  // Node.js environment (serverless functions)
  if (typeof process !== 'undefined' && process.env) {
    // Try VITE_ prefixed version first (if set in Netlify)
    const viteValue = process.env[key]
    if (viteValue) return viteValue
    
    // Fall back to server-side naming convention (without VITE_ prefix)
    const serverKey = key.replace('VITE_', '') as string
    return process.env[serverKey]
  }
  
  // Browser environment - use window check to be sure
  if (typeof window !== 'undefined') {
    // In browser builds, Vite typically replaces import.meta.env.* at build time
    // For runtime access, we check if values were injected globally
    const windowWithEnv = window as WindowWithEnv
    const globalWithEnv = globalThis as unknown as GlobalThisWithEnv
    const envGlobal = windowWithEnv.__ENV__ || globalWithEnv.__VITE_ENV__
    if (envGlobal && envGlobal[key]) {
      return envGlobal[key]
    }
    
    // Fallback: try dynamic property access to avoid static bundler analysis
    try {
      const globalWithImport = globalThis as unknown as GlobalWithImportMeta
      const importObj = globalWithImport.import
      if (importObj?.meta?.env?.[key]) {
        return importObj.meta.env[key]
      }
    } catch {
      // import.meta not available in this context
    }
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
      'Missing required environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'
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