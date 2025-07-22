import axios from 'axios'
import { fraudConfig } from './config'
import type { IPReputationResult } from './types'

export class IPQualityClient {
  private client = axios.create({
    baseURL: fraudConfig.ipquality.baseUrl,
    timeout: fraudConfig.ipquality.timeout,
  })

  async checkIPReputation(ipAddress: string): Promise<IPReputationResult> {
    try {
      const response = await this.client.get(`/ip/${fraudConfig.ipquality.apiKey}/${ipAddress}`, {
        params: {
          strictness: 1, // Medium strictness level
          user_agent: '', // Optional user agent
          user_language: 'en-US', // Optional language
          fast: false, // Perform full check
          mobile: true, // Check mobile networks
          allow_public_access_points: false,
          lighter_penalties: false,
        },
      })

      const data = response.data

      // Calculate fraud score based on multiple factors
      const fraudScore = this.calculateFraudScore(data)

      return {
        fraudScore,
        countryCode: data.country_code,
        region: data.region,
        city: data.city,
        isp: data.ISP,
        proxy: data.proxy || false,
        vpn: data.vpn || false,
        tor: data.tor || false,
        recentAbuse: data.recent_abuse || false,
        botStatus: data.bot_status || false,
      }
    } catch (error) {
      console.error('IPQuality check error:', error)

      if (axios.isAxiosError(error)) {
        return {
          fraudScore: 0,
          error: `IP reputation check failed: ${error.response?.data?.message || error.message}`,
        }
      }

      return {
        fraudScore: 0,
        error: 'IP reputation service unavailable',
      }
    }
  }

  private calculateFraudScore(data: Record<string, unknown>): number {
    let score = Number(data.fraud_score) || 0

    // Additional factors that increase fraud risk
    const riskFactors = [
      { condition: data.proxy === true, penalty: 20 },
      { condition: data.vpn === true, penalty: 15 },
      { condition: data.tor === true, penalty: 30 },
      { condition: data.recent_abuse === true, penalty: 25 },
      { condition: data.bot_status === true, penalty: 20 },
      { condition: data.active_vpn === true, penalty: 15 },
      { condition: data.active_tor === true, penalty: 30 },
      { condition: data.mobile === true && data.connection_type === 'Premium', penalty: 10 },
    ]

    // Apply penalties
    for (const factor of riskFactors) {
      if (factor.condition) {
        score = Math.min(100, score + factor.penalty)
      }
    }

    // Reduce score for positive indicators
    const positiveFactors = [
      { condition: data.success === true, bonus: -5 },
      { condition: data.timezone && data.timezone === 'America/New_York', bonus: -5 },
      { condition: Number(data.abuse_velocity) < 1, bonus: -10 },
    ]

    // Apply bonuses
    for (const factor of positiveFactors) {
      if (factor.condition) {
        score = Math.max(0, score + factor.bonus)
      }
    }

    return Math.round(score)
  }

  // Utility methods
  async isHighRiskIP(ipAddress: string): Promise<boolean> {
    const result = await this.checkIPReputation(ipAddress)
    return result.fraudScore >= 75
  }

  async isProxyOrVPN(ipAddress: string): Promise<boolean> {
    const result = await this.checkIPReputation(ipAddress)
    return !!(result.proxy || result.vpn || result.tor)
  }

  async getIPLocation(ipAddress: string): Promise<{
    country?: string
    region?: string
    city?: string
  }> {
    const result = await this.checkIPReputation(ipAddress)
    return {
      country: result.countryCode,
      region: result.region,
      city: result.city,
    }
  }
}

// Export singleton instance
export const ipQualityClient = new IPQualityClient()
