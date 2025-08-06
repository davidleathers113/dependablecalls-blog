/**
 * Universal environment variable access
 * Works in both browser (Vite) and Node.js (Netlify Functions) environments
 * 
 * IMPORTANT: Environment variables must be set in Netlify's dashboard or CLI
 * DO NOT hardcode any keys or secrets in this file
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
 * Works in browser, SSR, and serverless environments
 */
function getEnvVar(key: keyof EnvironmentVariables): string | undefined {
  // Browser environment - use Vite's import.meta.env
  if (typeof window !== 'undefined') {
    // Access Vite environment variables (injected at build time)
    // These MUST be defined in Netlify's environment variables
    try {
      // import.meta.env is available in Vite builds
      if (import.meta && import.meta.env && import.meta.env[key]) {
        return import.meta.env[key]
      }
    } catch (e) {
      // import.meta not available, try fallback
    }
    
    // Fallback: Check if variables were injected via define in vite.config
    // @ts-expect-error - These are injected at build time
    if (typeof __VITE_SUPABASE_URL__ !== 'undefined' && key === 'VITE_SUPABASE_URL') {
      // @ts-expect-error
      return __VITE_SUPABASE_URL__
    }
    // @ts-expect-error
    if (typeof __VITE_SUPABASE_ANON_KEY__ !== 'undefined' && key === 'VITE_SUPABASE_ANON_KEY') {
      // @ts-expect-error
      return __VITE_SUPABASE_ANON_KEY__
    }
    
    return undefined
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
    const errorMsg = [
      'Missing Supabase credentials.',
      '',
      '🚨 DEPLOYMENT FIX:',
      '1. Go to Netlify Dashboard > Site Settings > Environment Variables',
      '2. Add these variables:',
      '   - VITE_SUPABASE_URL (your Supabase project URL)',
      '   - VITE_SUPABASE_ANON_KEY (your Supabase anon/public key)',
      '3. Redeploy the site',
      '',
      '🔧 LOCAL DEVELOPMENT:',
      'Create a .env.local file with the same variables'
    ].join('\n')
    
    console.error(errorMsg)
    throw new Error('Supabase credentials not configured. Check console for setup instructions.')
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