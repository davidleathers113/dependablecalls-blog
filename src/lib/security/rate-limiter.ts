/**
 * Basic rate limiter stub for Netlify functions
 * TODO: Implement proper rate limiting with Redis or similar
 */

export interface UserContext {
  userId?: string
  userRole?: 'anonymous' | 'supplier' | 'buyer' | 'admin'
  isAuthenticated: boolean
  ipAddress: string
  userAgent?: string
  country?: string
  city?: string
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  totalRequests: number
  resetTime: number
  retryAfter?: number
  reason?: string
}

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}

// Mock Redis interface for stub implementation
export interface MockRedis {
  zadd(key: string, score: number, member: string): Promise<number>
  expire(key: string, seconds: number): Promise<number>
  zrange(key: string, start: number, stop: number): Promise<string[]>
  zcount(key: string, min: number, max: number): Promise<number>
  sadd(key: string, member: string): Promise<number>
  scard(key: string): Promise<number>
  sismember(key: string, member: string): Promise<boolean>
}

export class RateLimiter {
  // Mock Redis instance for testing
  public redis: MockRedis = {
    async zadd(_key: string, _score: number, _member: string): Promise<number> {
      return 1
    },
    async expire(_key: string, _seconds: number): Promise<number> {
      return 1
    },
    async zrange(_key: string, _start: number, _stop: number): Promise<string[]> {
      return []
    },
    async zcount(_key: string, _min: number, _max: number): Promise<number> {
      return 0
    },
    async sadd(_key: string, _member: string): Promise<number> {
      return 1
    },
    async scard(_key: string): Promise<number> {
      return 0
    },
    async sismember(_key: string, _member: string): Promise<boolean> {
      return false
    }
  }

  getUserRateLimit(_context: UserContext, _path?: string): RateLimitConfig {
    // Return default rate limit configuration
    return {
      maxRequests: 100,
      windowMs: 60000, // 1 minute
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    }
  }

  async checkLimit(_identifier: string, _config: RateLimitConfig, _context?: UserContext): Promise<RateLimitResult> {
    // Basic stub implementation - always allow
    return {
      allowed: true,
      remaining: 99,
      totalRequests: 1,
      resetTime: Date.now() + 3600000, // 1 hour from now
    }
  }

  async addSuspiciousIP(_ipAddress: string, _country?: string): Promise<void> {
    // Stub implementation - log suspicious IP
    console.warn(`Suspicious IP flagged: ${_ipAddress} from ${_country || 'unknown'}`)
  }
}

export const rateLimiter = new RateLimiter()