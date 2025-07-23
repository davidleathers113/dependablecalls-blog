import { truecallerClient } from './truecaller'
import { ipQualityClient } from './ipquality'
import { fraudLabsClient } from './fraudlabs'
import { siftClient } from './sift'
import { maxMindClient } from './maxmind'
import { getFraudDecision } from './config'
import type {
  FraudCheckRequest,
  UnifiedFraudScore,
  PhoneVerificationResult,
  IPReputationResult,
  TransactionScreeningResult,
  SiftFraudResult,
  MaxMindGeoResult,
} from './types'

export class FraudScoringService {
  async performComprehensiveCheck(request: FraudCheckRequest): Promise<UnifiedFraudScore> {
    const timestamp = new Date()
    const results = await Promise.allSettled([
      request.phone ? truecallerClient.verifyPhone(request.phone) : Promise.resolve(null),
      request.ip ? ipQualityClient.checkIPReputation(request.ip) : Promise.resolve(null),
      fraudLabsClient.screenTransaction(request),
      siftClient.screenTransaction(request),
      request.ip ? maxMindClient.checkIPLocation(request.ip) : Promise.resolve(null),
    ])

    // Extract results
    const phoneResult =
      results[0].status === 'fulfilled'
        ? (results[0].value as PhoneVerificationResult | null)
        : null
    const ipResult =
      results[1].status === 'fulfilled' ? (results[1].value as IPReputationResult | null) : null
    const transactionResult =
      results[2].status === 'fulfilled' ? (results[2].value as TransactionScreeningResult) : null
    const siftResult =
      results[3].status === 'fulfilled' ? (results[3].value as SiftFraudResult) : null
    const maxMindResult =
      results[4].status === 'fulfilled' ? (results[4].value as MaxMindGeoResult | null) : null

    // Calculate individual scores
    const phoneScore = this.calculatePhoneScore(phoneResult)
    const ipScore = ipResult?.fraudScore || 0
    const transactionScore = transactionResult?.fraudScore || 0
    const siftScore = siftResult?.fraudScore || 0
    const maxmindScore = maxMindResult?.fraudScore || 0

    // Calculate weighted overall score
    const overallScore = this.calculateOverallScore({
      phoneScore,
      ipScore,
      transactionScore,
      siftScore,
      maxmindScore,
    })

    // Collect reasons for the score
    const reasons = this.collectReasons({
      phoneResult,
      ipResult,
      transactionResult,
      siftResult,
      maxMindResult,
    })

    // Make final decision
    const decision = getFraudDecision(overallScore)

    return {
      overallScore,
      phoneScore,
      ipScore,
      transactionScore,
      siftScore,
      maxmindScore,
      decision,
      reasons,
      timestamp,
    }
  }

  private calculatePhoneScore(result: PhoneVerificationResult | null): number {
    if (!result) return 0

    let score = 0

    // Invalid phone number
    if (!result.valid) {
      score += 40
    }

    // High spam score
    if ((result.spamScore || 0) > 50) {
      score += 30
    }

    // VOIP numbers are higher risk
    if (result.lineType === 'voip') {
      score += 20
    }

    // Inactive numbers
    if (result.valid && !result.isActive) {
      score += 25
    }

    return Math.min(100, score)
  }

  private calculateOverallScore(scores: {
    phoneScore: number
    ipScore: number
    transactionScore: number
    siftScore: number
    maxmindScore: number
  }): number {
    // Weighted average with Sift and transaction screening having the highest weights
    const weights = {
      phone: 0.15,
      ip: 0.2,
      transaction: 0.25,
      sift: 0.25,
      maxmind: 0.15,
    }

    const weightedScore =
      scores.phoneScore * weights.phone +
      scores.ipScore * weights.ip +
      scores.transactionScore * weights.transaction +
      scores.siftScore * weights.sift +
      scores.maxmindScore * weights.maxmind

    return Math.round(weightedScore)
  }

  private collectReasons(data: {
    phoneResult: PhoneVerificationResult | null
    ipResult: IPReputationResult | null
    transactionResult: TransactionScreeningResult | null
    siftResult: SiftFraudResult | null
    maxMindResult: MaxMindGeoResult | null
  }): string[] {
    const reasons: string[] = []

    // Phone-related reasons
    if (data.phoneResult) {
      if (!data.phoneResult.valid) {
        reasons.push('Invalid phone number')
      }
      if ((data.phoneResult.spamScore || 0) > 50) {
        reasons.push('High spam score on phone number')
      }
      if (data.phoneResult.lineType === 'voip') {
        reasons.push('VOIP phone number detected')
      }
      if (data.phoneResult.valid && !data.phoneResult.isActive) {
        reasons.push('Inactive phone number')
      }
    }

    // IP-related reasons
    if (data.ipResult) {
      if (data.ipResult.proxy) {
        reasons.push('Proxy IP detected')
      }
      if (data.ipResult.vpn) {
        reasons.push('VPN connection detected')
      }
      if (data.ipResult.tor) {
        reasons.push('TOR network detected')
      }
      if (data.ipResult.recentAbuse) {
        reasons.push('Recent abuse from IP address')
      }
      if (data.ipResult.botStatus) {
        reasons.push('Bot activity detected')
      }
    }

    // Transaction-related reasons
    if (data.transactionResult) {
      reasons.push(...data.transactionResult.rules)
    }

    // Sift-related reasons
    if (data.siftResult) {
      reasons.push(...data.siftResult.reasons)
      if (data.siftResult.status === 'reject') {
        reasons.push('Sift AI flagged as high-risk transaction')
      }
    }

    // MaxMind-related reasons
    if (data.maxMindResult) {
      if (data.maxMindResult.isVpn) {
        reasons.push('VPN detected by MaxMind')
      }
      if (data.maxMindResult.isProxy) {
        reasons.push('Proxy detected by MaxMind')
      }
      if (data.maxMindResult.riskLevel === 'high') {
        reasons.push('High-risk location detected')
      }
    }

    return [...new Set(reasons)] // Remove duplicates
  }

  // Quick check methods for specific scenarios
  async quickPhoneCheck(phone: string): Promise<number> {
    const result = await truecallerClient.verifyPhone(phone)
    return this.calculatePhoneScore(result)
  }

  async quickIPCheck(ip: string): Promise<number> {
    const result = await ipQualityClient.checkIPReputation(ip)
    return result.fraudScore
  }

  async checkCallFraud(phone: string, ip: string, campaignId: string): Promise<UnifiedFraudScore> {
    return this.performComprehensiveCheck({
      phone,
      ip,
      campaignId,
      metadata: { checkType: 'incoming_call' },
    })
  }

  async checkRegistrationFraud(
    email: string,
    ip: string,
    phone?: string
  ): Promise<UnifiedFraudScore> {
    return this.performComprehensiveCheck({
      email,
      ip,
      phone,
      metadata: { checkType: 'user_registration' },
    })
  }

  async checkPaymentFraud(
    amount: number,
    currency: string,
    email: string,
    ip: string
  ): Promise<UnifiedFraudScore> {
    return this.performComprehensiveCheck({
      amount,
      currency,
      email,
      ip,
      metadata: { checkType: 'payment_transaction' },
    })
  }
}

// Export singleton instance
export const fraudScoringService = new FraudScoringService()
