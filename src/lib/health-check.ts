import { logger } from './logger'

export interface HealthCheckResult extends Record<string, unknown> {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  checks: {
    [key: string]: {
      status: 'pass' | 'fail'
      message?: string
      duration?: number
      metadata?: Record<string, unknown>
    }
  }
  overall: {
    healthy: number
    failed: number
    duration: number
  }
}

export interface HealthCheckConfig {
  supabase: {
    url: string
    anonKey: string
  }
  stripe: {
    enabled: boolean
  }
  sentry: {
    enabled: boolean
  }
}

class HealthChecker {
  private config: HealthCheckConfig
  private lastCheck?: HealthCheckResult
  private checkInterval?: NodeJS.Timeout
  private isChecking = false

  constructor(config: HealthCheckConfig) {
    this.config = config
  }

  async checkSupabase(): Promise<{ status: 'pass' | 'fail'; message?: string; duration: number }> {
    const start = performance.now()

    try {
      const response = await fetch(`${this.config.supabase.url}/rest/v1/`, {
        method: 'GET',
        headers: {
          apikey: this.config.supabase.anonKey,
          Authorization: `Bearer ${this.config.supabase.anonKey}`,
        },
      })

      const duration = performance.now() - start

      if (response.ok) {
        return { status: 'pass', duration }
      } else {
        return {
          status: 'fail',
          message: `HTTP ${response.status}`,
          duration,
        }
      }
    } catch (error) {
      const duration = performance.now() - start
      return {
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration,
      }
    }
  }

  async checkStripe(): Promise<{ status: 'pass' | 'fail'; message?: string }> {
    // Stripe/billing functionality has been removed
    return { status: 'pass', message: 'Billing functionality removed' }
  }

  async checkSentry(): Promise<{ status: 'pass' | 'fail'; message?: string }> {
    if (!this.config.sentry.enabled) {
      return { status: 'pass', message: 'Sentry not configured' }
    }

    try {
      // Check if Sentry is initialized
      const Sentry = await import('@sentry/react')
      const client = Sentry.getCurrentHub().getClient()

      if (client) {
        return { status: 'pass' }
      } else {
        return { status: 'fail', message: 'Sentry not initialized' }
      }
    } catch (error) {
      return {
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async checkAPI(): Promise<{ status: 'pass' | 'fail'; message?: string; duration: number }> {
    const start = performance.now()

    try {
      const response = await fetch('/api/health', {
        method: 'GET',
      })

      const duration = performance.now() - start

      if (response.ok) {
        return { status: 'pass', duration }
      } else {
        return {
          status: 'fail',
          message: `HTTP ${response.status}`,
          duration,
        }
      }
    } catch (error) {
      const duration = performance.now() - start
      return {
        status: 'fail',
        message: error instanceof Error ? error.message : 'Network error',
        duration,
      }
    }
  }

  async performHealthCheck(): Promise<HealthCheckResult> {
    if (this.isChecking) {
      throw new Error('Health check already in progress')
    }

    this.isChecking = true
    const startTime = performance.now()
    const timestamp = new Date().toISOString()

    try {
      // Run all checks in parallel
      const [supabase, sentry, api] = await Promise.all([
        this.checkSupabase(),
        this.checkSentry(),
        this.checkAPI(),
      ])

      const checks = {
        supabase,
        sentry,
        api,
      }

      // Calculate overall status
      const failed = Object.values(checks).filter((check) => check.status === 'fail').length
      const healthy = Object.values(checks).filter((check) => check.status === 'pass').length
      const duration = performance.now() - startTime

      let status: 'healthy' | 'degraded' | 'unhealthy'
      if (failed === 0) {
        status = 'healthy'
      } else if (failed >= Object.keys(checks).length / 2) {
        status = 'unhealthy'
      } else {
        status = 'degraded'
      }

      const result: HealthCheckResult = {
        status,
        timestamp,
        checks,
        overall: {
          healthy,
          failed,
          duration,
        },
      }

      this.lastCheck = result

      // Log health status
      if (status === 'unhealthy') {
        logger.error('Health check failed', undefined, {
          component: 'health-check',
          metadata: result,
        })
      } else if (status === 'degraded') {
        logger.warn('Health check degraded', {
          component: 'health-check',
          metadata: result,
        })
      }

      return result
    } finally {
      this.isChecking = false
    }
  }

  startPeriodicCheck(intervalMs: number = 60000) {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }

    // Initial check
    this.performHealthCheck().catch((error) => {
      logger.error('Initial health check failed', error)
    })

    // Set up periodic checks
    this.checkInterval = setInterval(() => {
      this.performHealthCheck().catch((error) => {
        logger.error('Periodic health check failed', error)
      })
    }, intervalMs)
  }

  stopPeriodicCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = undefined
    }
  }

  getLastCheck(): HealthCheckResult | undefined {
    return this.lastCheck
  }

  // Create health endpoint response
  createHealthResponse(): Response {
    if (!this.lastCheck) {
      return new Response(
        JSON.stringify({
          status: 'unknown',
          message: 'No health check performed yet',
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const statusCode =
      this.lastCheck.status === 'healthy' ? 200 : this.lastCheck.status === 'degraded' ? 200 : 503

    return new Response(JSON.stringify(this.lastCheck), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// Create singleton instance
export const healthChecker = new HealthChecker({
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  },
  stripe: {
    enabled: !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
  },
  sentry: {
    enabled: !!import.meta.env.VITE_SENTRY_DSN,
  },
})

// Start periodic health checks in production
if (import.meta.env.PROD) {
  healthChecker.startPeriodicCheck(60000) // Check every minute
}

// Export for use in service workers or edge functions
export function handleHealthRequest(): Response {
  return healthChecker.createHealthResponse()
}
