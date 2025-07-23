import axios from 'axios'
import { fraudConfig } from './config'
import type { MaxMindGeoResult } from './types'

export class MaxMindClient {
  private client = axios.create({
    baseURL: fraudConfig.maxmind.baseUrl,
    timeout: fraudConfig.maxmind.timeout,
    auth: {
      username: fraudConfig.maxmind.apiKey,
      password: '', // MaxMind uses account ID as username and license key as password
    },
    headers: {
      Accept: 'application/json',
    },
  })

  async checkIPLocation(ipAddress: string): Promise<MaxMindGeoResult> {
    try {
      // Get both insights and country data
      const [insightsResponse, countryResponse] = await Promise.allSettled([
        this.getInsights(ipAddress),
        this.getCountry(ipAddress),
      ])

      let insightsData: Record<string, unknown> = {}
      let countryData: Record<string, unknown> = {}

      if (insightsResponse.status === 'fulfilled') {
        insightsData = insightsResponse.value.data as Record<string, unknown>
      }

      if (countryResponse.status === 'fulfilled') {
        countryData = countryResponse.value.data as Record<string, unknown>
      }

      return this.processGeoData(insightsData, countryData)
    } catch (error) {
      console.error('MaxMind GeoIP check error:', error)

      if (axios.isAxiosError(error)) {
        return {
          fraudScore: 0,
          riskLevel: 'low',
          error: `MaxMind check failed: ${error.response?.data?.error || error.message}`,
        }
      }

      return {
        fraudScore: 0,
        riskLevel: 'low',
        error: 'MaxMind GeoIP service unavailable',
      }
    }
  }

  private async getInsights(ip: string): Promise<{ data: unknown }> {
    return this.client.get(`/insights/${ip}`)
  }

  private async getCountry(ip: string): Promise<{ data: unknown }> {
    return this.client.get(`/country/${ip}`)
  }

  private processGeoData(
    insights: Record<string, unknown>,
    country: Record<string, unknown>
  ): MaxMindGeoResult {
    // Extract location data
    const countryInfo = (insights.country || country.country || {}) as Record<string, unknown>
    const city = (insights.city as Record<string, unknown>) || {}
    const location = (insights.location as Record<string, unknown>) || {}
    const traits = (insights.traits as Record<string, unknown>) || {}

    const countryCode = countryInfo.iso_code as string
    const region = (city.names as Record<string, unknown>)?.en as string
    const cityName = (city.names as Record<string, unknown>)?.en as string

    // Extract risk indicators
    const riskScore = Number(traits.risk_score) || 0
    const isAnonymousProxy = Boolean(traits.is_anonymous_proxy)
    const isSatelliteProvider = Boolean(traits.is_satellite_provider)
    const userType = traits.user_type as string

    // Calculate fraud score based on various factors
    let fraudScore = riskScore * 10 // MaxMind risk score is 0-10, convert to 0-100

    // Apply additional risk factors
    const riskFactors = [
      { condition: isAnonymousProxy, penalty: 30 },
      { condition: isSatelliteProvider, penalty: 15 },
      { condition: userType === 'hosting', penalty: 20 },
      { condition: userType === 'cellular', penalty: 5 },
      { condition: this.isHighRiskCountry(countryCode), penalty: 25 },
      { condition: Number(location.accuracy_radius) > 1000, penalty: 10 },
    ]

    for (const factor of riskFactors) {
      if (factor.condition) {
        fraudScore = Math.min(100, fraudScore + factor.penalty)
      }
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low'
    if (fraudScore >= 70) {
      riskLevel = 'high'
    } else if (fraudScore >= 40) {
      riskLevel = 'medium'
    }

    return {
      fraudScore: Math.round(fraudScore),
      countryCode,
      region,
      city: cityName,
      riskLevel,
      isVpn: userType === 'hosting' || isAnonymousProxy,
      isProxy: isAnonymousProxy,
      isp: traits.isp as string,
      accuracyRadius: Number(location.accuracy_radius),
    }
  }

  private isHighRiskCountry(countryCode?: string): boolean {
    // List of countries commonly associated with higher fraud risk
    const highRiskCountries = [
      'CN',
      'RU',
      'NG',
      'PK',
      'BD',
      'ID',
      'VN',
      'IN',
      'MY',
      'TH',
      'PH',
      'EG',
      'MA',
      'RO',
      'BG',
      'UA',
    ]

    return countryCode ? highRiskCountries.includes(countryCode) : false
  }

  // Utility methods
  async isVpnOrProxy(ipAddress: string): Promise<boolean> {
    const result = await this.checkIPLocation(ipAddress)
    return !!(result.isVpn || result.isProxy)
  }

  async getCountryRisk(ipAddress: string): Promise<{
    country?: string
    riskLevel: 'low' | 'medium' | 'high'
  }> {
    const result = await this.checkIPLocation(ipAddress)
    return {
      country: result.countryCode,
      riskLevel: result.riskLevel,
    }
  }

  async validateIPLocation(
    ipAddress: string,
    expectedCountry: string
  ): Promise<{
    matches: boolean
    actualCountry?: string
    distance?: number
  }> {
    const result = await this.checkIPLocation(ipAddress)

    const matches = result.countryCode === expectedCountry.toUpperCase()

    return {
      matches,
      actualCountry: result.countryCode,
      distance: result.accuracyRadius,
    }
  }

  async detectAnomalousLocation(
    ipAddress: string,
    previousLocations: Array<{ country: string; timestamp: Date }>
  ): Promise<{
    isAnomalous: boolean
    reason?: string
    newLocation?: string
  }> {
    const result = await this.checkIPLocation(ipAddress)

    if (result.error || !result.countryCode) {
      return { isAnomalous: false }
    }

    // Check for rapid location changes
    const recentLocations = previousLocations.filter(
      (loc) => Date.now() - loc.timestamp.getTime() < 24 * 60 * 60 * 1000 // Last 24 hours
    )

    const uniqueCountries = new Set(recentLocations.map((loc) => loc.country))

    if (uniqueCountries.size > 3 && !uniqueCountries.has(result.countryCode)) {
      return {
        isAnomalous: true,
        reason: 'Multiple countries accessed within 24 hours',
        newLocation: result.countryCode,
      }
    }

    // Check for impossible travel
    const lastLocation = recentLocations[recentLocations.length - 1]
    if (lastLocation && lastLocation.country !== result.countryCode) {
      const timeDiff = Date.now() - lastLocation.timestamp.getTime()
      const hoursDiff = timeDiff / (1000 * 60 * 60)

      // If location changed in less than 2 hours, flag as suspicious
      if (hoursDiff < 2) {
        return {
          isAnomalous: true,
          reason: 'Impossible travel time between locations',
          newLocation: result.countryCode,
        }
      }
    }

    return { isAnomalous: false, newLocation: result.countryCode }
  }
}

// Export singleton instance
export const maxMindClient = new MaxMindClient()
