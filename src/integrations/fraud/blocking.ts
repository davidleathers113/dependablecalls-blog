import { supabase } from '../../lib/supabase'
import type { BlockingRule, UnifiedFraudScore } from './types'

export class AutoBlockingService {
  private blockingThreshold = 85 // Auto-block threshold
  private temporaryBlockDuration = 24 * 60 * 60 * 1000 // 24 hours in ms

  async checkBlocked(type: 'phone' | 'ip' | 'email', value: string): Promise<BlockingRule | null> {
    try {
      const { data, error } = await supabase
        .from('blocking_rules')
        .select('*')
        .eq('type', type)
        .eq('value', value)
        .or('expires_at.is.null,expires_at.gt.now()')
        .single()

      if (error && error.code !== 'PGRST116') {
        // Not found error
        console.error('Error checking blocking rule:', error)
        return null
      }

      if (data) {
        return {
          id: data.id,
          type: data.type,
          value: data.value,
          reason: data.reason,
          createdAt: new Date(data.created_at),
          expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
          autoBlocked: data.auto_blocked,
        }
      }

      return null
    } catch (error) {
      console.error('Error in checkBlocked:', error)
      return null
    }
  }

  async createBlockingRule(
    type: 'phone' | 'ip' | 'email' | 'pattern',
    value: string,
    reason: string,
    temporary: boolean = false,
    autoBlocked: boolean = true
  ): Promise<BlockingRule | null> {
    try {
      const expiresAt = temporary ? new Date(Date.now() + this.temporaryBlockDuration) : null

      const { data, error } = await supabase
        .from('blocking_rules')
        .insert({
          type,
          value,
          reason,
          expires_at: expiresAt,
          auto_blocked: autoBlocked,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating blocking rule:', error)
        return null
      }

      return {
        id: data.id,
        type: data.type,
        value: data.value,
        reason: data.reason,
        createdAt: new Date(data.created_at),
        expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
        autoBlocked: data.auto_blocked,
      }
    } catch (error) {
      console.error('Error in createBlockingRule:', error)
      return null
    }
  }

  async removeBlockingRule(id: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('blocking_rules').delete().eq('id', id)

      if (error) {
        console.error('Error removing blocking rule:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in removeBlockingRule:', error)
      return false
    }
  }

  async processAutoBlocking(
    fraudScore: UnifiedFraudScore,
    request: {
      phone?: string
      ip?: string
      email?: string
    }
  ): Promise<void> {
    // Only auto-block if score exceeds threshold
    if (fraudScore.overallScore < this.blockingThreshold) {
      return
    }

    const blockingPromises: Promise<BlockingRule | null>[] = []

    // Block phone if it contributed significantly to high score
    if (request.phone && fraudScore.phoneScore && fraudScore.phoneScore >= 70) {
      const reason =
        fraudScore.reasons.filter((r) => r.toLowerCase().includes('phone')).join(', ') ||
        'High fraud score on phone verification'

      blockingPromises.push(this.createBlockingRule('phone', request.phone, reason, true))
    }

    // Block IP if it's high risk
    if (request.ip && fraudScore.ipScore && fraudScore.ipScore >= 80) {
      const reason =
        fraudScore.reasons
          .filter(
            (r) =>
              r.toLowerCase().includes('ip') ||
              r.toLowerCase().includes('proxy') ||
              r.toLowerCase().includes('vpn') ||
              r.toLowerCase().includes('tor')
          )
          .join(', ') || 'High risk IP address'

      blockingPromises.push(this.createBlockingRule('ip', request.ip, reason, true))
    }

    // Block email if flagged
    if (
      request.email &&
      fraudScore.reasons.some(
        (r) =>
          r.toLowerCase().includes('email') ||
          r.toLowerCase().includes('disposable') ||
          r.toLowerCase().includes('blacklisted')
      )
    ) {
      const reason =
        fraudScore.reasons.filter((r) => r.toLowerCase().includes('email')).join(', ') ||
        'Suspicious email address'

      blockingPromises.push(this.createBlockingRule('email', request.email, reason, false))
    }

    // Execute all blocking operations
    await Promise.allSettled(blockingPromises)
  }

  async listActiveBlocks(type?: 'phone' | 'ip' | 'email' | 'pattern'): Promise<BlockingRule[]> {
    try {
      let query = supabase
        .from('blocking_rules')
        .select('*')
        .or('expires_at.is.null,expires_at.gt.now()')
        .order('created_at', { ascending: false })

      if (type) {
        query = query.eq('type', type)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error listing blocking rules:', error)
        return []
      }

      return data.map((rule) => ({
        id: rule.id,
        type: rule.type,
        value: rule.value,
        reason: rule.reason,
        createdAt: new Date(rule.created_at),
        expiresAt: rule.expires_at ? new Date(rule.expires_at) : undefined,
        autoBlocked: rule.auto_blocked,
      }))
    } catch (error) {
      console.error('Error in listActiveBlocks:', error)
      return []
    }
  }

  async cleanupExpiredRules(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('blocking_rules')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select()

      if (error) {
        console.error('Error cleaning up expired rules:', error)
        return 0
      }

      return data?.length || 0
    } catch (error) {
      console.error('Error in cleanupExpiredRules:', error)
      return 0
    }
  }

  // Pattern matching for advanced blocking
  async checkPatternBlock(value: string, type: 'phone' | 'ip' | 'email'): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('blocking_rules')
        .select('value')
        .eq('type', 'pattern')
        .or('expires_at.is.null,expires_at.gt.now()')

      if (error || !data) {
        return false
      }

      // Check if value matches any patterns
      for (const rule of data) {
        if (this.matchesPattern(value, rule.value, type)) {
          return true
        }
      }

      return false
    } catch (error) {
      console.error('Error in checkPatternBlock:', error)
      return false
    }
  }

  private matchesPattern(value: string, pattern: string, type: string): boolean {
    // Simple pattern matching without regex
    switch (type) {
      case 'phone':
        // Check for area code patterns (e.g., "+1555*")
        if (pattern.endsWith('*')) {
          const prefix = pattern.slice(0, -1)
          return value.startsWith(prefix)
        }
        break

      case 'ip':
        // Check for IP range patterns (e.g., "192.168.*")
        if (pattern.includes('*')) {
          const parts = pattern.split('.')
          const valueParts = value.split('.')

          for (let i = 0; i < parts.length; i++) {
            if (parts[i] !== '*' && parts[i] !== valueParts[i]) {
              return false
            }
          }
          return true
        }
        break

      case 'email':
        // Check for domain patterns (e.g., "*@spam.com")
        if (pattern.startsWith('*@')) {
          const domain = pattern.slice(2)
          return value.endsWith(`@${domain}`)
        }
        break
    }

    return value === pattern
  }
}

// Export singleton instance
export const autoBlockingService = new AutoBlockingService()
