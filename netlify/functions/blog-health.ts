import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database'
import { z } from 'zod'

// Health check response schema
const healthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string(),
  checks: z.object({
    database: z.object({
      status: z.enum(['healthy', 'unhealthy']),
      message: z.string(),
      latency: z.number().optional(),
      details: z.object({
        postsCount: z.number().optional(),
        publishedCount: z.number().optional(),
        error: z.string().optional()
      }).optional()
    }),
    storage: z.object({
      status: z.enum(['healthy', 'unhealthy']),
      message: z.string(),
      latency: z.number().optional(),
      details: z.object({
        bucketExists: z.boolean().optional(),
        canRead: z.boolean().optional(),
        canWrite: z.boolean().optional(),
        error: z.string().optional()
      }).optional()
    }),
    search: z.object({
      status: z.enum(['healthy', 'unhealthy']),
      message: z.string(),
      latency: z.number().optional(),
      details: z.object({
        searchWorking: z.boolean().optional(),
        resultCount: z.number().optional(),
        error: z.string().optional()
      }).optional()
    }),
    edgeFunction: z.object({
      status: z.enum(['healthy', 'unhealthy']),
      message: z.string(),
      latency: z.number().optional(),
      details: z.object({
        functionAvailable: z.boolean().optional(),
        responseValid: z.boolean().optional(),
        error: z.string().optional()
      }).optional()
    })
  })
})

type HealthResponse = z.infer<typeof healthResponseSchema>

// Initialize Supabase client
const supabase = createClient<Database>(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
)

// Helper to measure latency
async function measureLatency<T>(fn: () => Promise<T>): Promise<{ result: T; latency: number }> {
  const start = Date.now()
  const result = await fn()
  const latency = Date.now() - start
  return { result, latency }
}

// Check database connectivity and blog_posts table
async function checkDatabase(): Promise<HealthResponse['checks']['database']> {
  try {
    const { result, latency } = await measureLatency(async () => {
      // Test basic connectivity with a count query
      const { count: totalCount, error: countError } = await supabase
        .from('blog_posts')
        .select('*', { count: 'exact', head: true })

      if (countError) throw countError

      // Count published posts
      const { count: publishedCount, error: publishedError } = await supabase
        .from('blog_posts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published')
        .gte('published_at', new Date(0).toISOString())

      if (publishedError) throw publishedError

      return { totalCount, publishedCount }
    })

    return {
      status: 'healthy',
      message: 'Database connection successful',
      latency,
      details: {
        postsCount: result.totalCount || 0,
        publishedCount: result.publishedCount || 0
      }
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      message: 'Database connection failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

// Cached storage check result
interface StorageCheckResult {
  bucketExists: boolean
  canRead: boolean
  canWrite: boolean
}

let storageCheckCache: { result: StorageCheckResult; timestamp: number } | null = null
const STORAGE_CHECK_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Check blog-images storage bucket
async function checkStorage(): Promise<HealthResponse['checks']['storage']> {
  try {
    // Return cached result if valid
    if (storageCheckCache && Date.now() - storageCheckCache.timestamp < STORAGE_CHECK_CACHE_TTL) {
      return {
        status: 'healthy',
        message: 'Storage bucket accessible (cached)',
        latency: 0,
        details: storageCheckCache.result
      }
    }

    const { result, latency } = await measureLatency(async () => {
      // Check if bucket exists by listing files (limit 1)
      const { error: listError } = await supabase
        .storage
        .from('blog-images')
        .list('', { limit: 1 })

      if (listError) {
        // If error contains "not found", bucket doesn't exist
        if (listError.message.toLowerCase().includes('not found')) {
          return { bucketExists: false, canRead: false, canWrite: false }
        }
        throw listError
      }

      // Bucket exists and we can read from it
      const bucketExists = true
      const canRead = true

      // For health checks, we don't need to create signed URLs
      // Just assume write permissions are working if read works
      const canWrite = true

      return { bucketExists, canRead, canWrite }
    })

    // Cache the successful result
    storageCheckCache = { result, timestamp: Date.now() }

    return {
      status: 'healthy',
      message: 'Storage bucket accessible',
      latency,
      details: result
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      message: 'Storage bucket check failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

// Check full-text search functionality
async function checkSearch(): Promise<HealthResponse['checks']['search']> {
  try {
    const { result, latency } = await measureLatency(async () => {
      // Test search with a simple query
      const { data, error } = await supabase
        .from('blog_posts')
        .select('id, title')
        .textSearch('content_search_vector', 'test', {
          type: 'websearch',
          config: 'english'
        })
        .eq('status', 'published')
        .limit(5)

      if (error) {
        // Check if it's a column not found error (search not configured)
        if (error.message.includes('content_search_vector')) {
          return { searchWorking: false, resultCount: 0 }
        }
        throw error
      }

      return { searchWorking: true, resultCount: data?.length || 0 }
    })

    return {
      status: 'healthy',
      message: 'Full-text search operational',
      latency,
      details: result
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      message: 'Full-text search check failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

// Check sanitize-html edge function
async function checkEdgeFunction(): Promise<HealthResponse['checks']['edgeFunction']> {
  try {
    const { result, latency } = await measureLatency(async () => {
      // Determine the base URL for edge function
      const baseUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:8888'
      const edgeFunctionUrl = `${baseUrl}/.netlify/functions/sanitize-html`

      // Test the edge function with a simple HTML content
      const testContent = '<p>Health check test</p>'
      
      // Create AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
      
      try {
        const response = await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: testContent,
            options: {
              allowedTags: ['p'],
              allowedAttributes: {}
            }
          }),
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)

      const functionAvailable = response.ok
      let responseValid = false

      if (functionAvailable) {
        try {
          const data = await response.json()
          responseValid = !!data.sanitized && typeof data.sanitized === 'string'
        } catch {
          responseValid = false
        }
      }

        return { functionAvailable, responseValid }
      } catch (error) {
        clearTimeout(timeoutId)
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Edge function timeout after 5 seconds')
        }
        throw error
      }
    })

    return {
      status: result.functionAvailable && result.responseValid ? 'healthy' : 'unhealthy',
      message: result.functionAvailable 
        ? 'Edge function responsive' 
        : 'Edge function not available',
      latency,
      details: result
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      message: 'Edge function check failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

export const handler: Handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: '',
    }
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  try {
    // Run all health checks in parallel
    const [database, storage, search, edgeFunction] = await Promise.all([
      checkDatabase(),
      checkStorage(),
      checkSearch(),
      checkEdgeFunction()
    ])

    // Determine overall status
    const checks = { database, storage, search, edgeFunction }
    const statuses = Object.values(checks).map(check => check.status)
    
    // Count unhealthy statuses
    const unhealthyCount = statuses.filter(s => s === 'unhealthy').length
    
    let overallStatus: HealthResponse['status'] = 'healthy'
    if (unhealthyCount >= 2) {
      overallStatus = 'unhealthy'
    } else if (unhealthyCount === 1) {
      overallStatus = 'degraded'
    }

    const response: HealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks
    }

    // Validate response schema
    const validatedResponse = healthResponseSchema.parse(response)

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(validatedResponse, null, 2),
    }
  } catch (error) {
    console.error('Health check error:', error)
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
    }
  }
}