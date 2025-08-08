/**
 * Basic geo IP analyzer stub for Netlify functions
 * TODO: Implement proper geo-IP analysis
 */

export interface GeoLocation {
  country?: string
  city?: string
  region?: string
  isBlocked: boolean
  threatLevel?: 'low' | 'medium' | 'high' | 'critical'
}

export interface GeoBlockResult {
  blocked: boolean
  reason?: string
  rule?: string
}

export class GeoIPAnalyzer {
  async analyze(_ipAddress: string): Promise<GeoLocation> {
    // Basic stub implementation - never block
    return {
      country: 'US',
      city: 'Unknown',
      region: 'Unknown',
      isBlocked: false,
      threatLevel: 'low'
    }
  }

  async analyzeIP(ipAddress: string): Promise<GeoLocation> {
    return this.analyze(ipAddress)
  }

  async shouldBlockIP(_ipAddress: string): Promise<GeoBlockResult> {
    // Basic stub implementation - never block
    return {
      blocked: false,
      reason: undefined,
      rule: undefined
    }
  }

  async updateLastSeen(_ipAddress: string): Promise<void> {
    // Stub implementation - log IP activity
    console.debug(`IP last seen updated: ${_ipAddress}`)
  }
}

export const geoIPAnalyzer = new GeoIPAnalyzer()