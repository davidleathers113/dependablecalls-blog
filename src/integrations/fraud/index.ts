export * from './types'
export * from './config'
export { truecallerClient } from './truecaller'
export { ipQualityClient } from './ipquality'
export { fraudLabsClient } from './fraudlabs'
export { siftClient } from './sift'
export { maxMindClient } from './maxmind'
export { fraudScoringService } from './scoring'
export { autoBlockingService } from './blocking'

// Main fraud detection API
import { fraudScoringService } from './scoring'
import { autoBlockingService } from './blocking'
import type { FraudCheckRequest, UnifiedFraudScore } from './types'

export async function checkFraud(request: FraudCheckRequest): Promise<UnifiedFraudScore> {
  // Check if any values are already blocked
  const blockChecks = await Promise.all([
    request.phone ? autoBlockingService.checkBlocked('phone', request.phone) : null,
    request.ip ? autoBlockingService.checkBlocked('ip', request.ip) : null,
    request.email ? autoBlockingService.checkBlocked('email', request.email) : null,
  ])

  // If any value is blocked, return immediate rejection
  const blockedRule = blockChecks.find((rule) => rule !== null)
  if (blockedRule) {
    return {
      overallScore: 100,
      decision: 'reject',
      reasons: [`Blocked: ${blockedRule.reason}`],
      timestamp: new Date(),
    }
  }

  // Perform comprehensive fraud check
  const fraudScore = await fraudScoringService.performComprehensiveCheck(request)

  // Process auto-blocking if needed
  await autoBlockingService.processAutoBlocking(fraudScore, request)

  return fraudScore
}

// Utility function for call validation
export async function validateIncomingCall(
  phoneNumber: string,
  ipAddress: string,
  campaignId: string
): Promise<{ allowed: boolean; score: UnifiedFraudScore }> {
  const score = await checkFraud({
    phone: phoneNumber,
    ip: ipAddress,
    campaignId,
    metadata: { type: 'incoming_call' },
  })

  return {
    allowed: score.decision === 'approve',
    score,
  }
}

// Utility function for user registration validation
export async function validateRegistration(
  email: string,
  ipAddress: string,
  phone?: string
): Promise<{ allowed: boolean; score: UnifiedFraudScore }> {
  const score = await checkFraud({
    email,
    ip: ipAddress,
    phone,
    metadata: { type: 'user_registration' },
  })

  return {
    allowed: score.decision !== 'reject',
    score,
  }
}

// Cleanup function to be called periodically
export async function cleanupFraudData(): Promise<void> {
  const cleaned = await autoBlockingService.cleanupExpiredRules()
  console.log(`Cleaned up ${cleaned} expired blocking rules`)
}
