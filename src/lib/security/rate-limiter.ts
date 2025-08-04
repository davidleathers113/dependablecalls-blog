/**
 * Basic rate limiter stub for Netlify functions
 * TODO: Implement proper rate limiting with Redis or similar
 */

export interface UserContext {
  userId?: string
  ipAddress: string
  userAgent?: string
}

export interface RateLimitResult {
  allowed: boolean
  remainingRequests: number
  resetTime: number
  reason?: string
}

export class RateLimiter {
  async checkLimit(_context: UserContext): Promise<RateLimitResult> {
    // Basic stub implementation - always allow
    return {
      allowed: true,
      remainingRequests: 100,
      resetTime: Date.now() + 3600000, // 1 hour from now
    }
  }
}

export const rateLimiter = new RateLimiter()