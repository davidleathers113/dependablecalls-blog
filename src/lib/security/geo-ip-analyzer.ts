/**
 * Basic geo IP analyzer stub for Netlify functions
 * TODO: Implement proper geo-IP analysis
 */

export interface GeoLocation {
  country?: string
  city?: string
  region?: string
  isBlocked: boolean
}

export class GeoIPAnalyzer {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async analyze(ipAddress: string): Promise<GeoLocation> {
    // Basic stub implementation - never block
    return {
      country: 'US',
      city: 'Unknown',
      region: 'Unknown',
      isBlocked: false,
    }
  }
}

export const geoIPAnalyzer = new GeoIPAnalyzer()