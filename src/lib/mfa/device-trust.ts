/**
 * Device trust management for MFA
 */

export interface DeviceTrustToken {
  deviceId: string
  userId: string
  createdAt: number
  expiresAt: number
}

/**
 * Create a device trust cookie for trusted devices
 */
export function createDeviceTrustCookie(deviceId: string, userId: string): string {
  const token: DeviceTrustToken = {
    deviceId,
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  }
  
  return `device-trust=${JSON.stringify(token)}; HttpOnly; Secure; SameSite=Strict; Max-Age=${30 * 24 * 60 * 60}`
}

/**
 * Generate a device name from user agent
 */
export function generateDeviceName(userAgent?: string): string {
  if (!userAgent) return 'Unknown Device'
  
  // Basic device name extraction
  if (userAgent.includes('Chrome')) return 'Chrome Browser'
  if (userAgent.includes('Firefox')) return 'Firefox Browser'
  if (userAgent.includes('Safari')) return 'Safari Browser'
  if (userAgent.includes('Edge')) return 'Edge Browser'
  
  return 'Unknown Browser'
}