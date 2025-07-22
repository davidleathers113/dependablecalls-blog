export interface PhoneVerificationResult {
  valid: boolean
  carrier?: string
  country?: string
  lineType?: 'mobile' | 'landline' | 'voip' | 'unknown'
  name?: string
  spamScore?: number
  isActive?: boolean
  error?: string
}

export interface IPReputationResult {
  fraudScore: number
  countryCode?: string
  region?: string
  city?: string
  isp?: string
  proxy?: boolean
  vpn?: boolean
  tor?: boolean
  recentAbuse?: boolean
  botStatus?: boolean
  error?: string
}

export interface TransactionScreeningResult {
  fraudScore: number
  status: 'approve' | 'review' | 'reject'
  rules: string[]
  riskFactors: {
    ip?: string
    email?: string
    phone?: string
    billing?: string
    shipping?: string
  }
  error?: string
}

export interface UnifiedFraudScore {
  overallScore: number
  phoneScore?: number
  ipScore?: number
  transactionScore?: number
  decision: 'approve' | 'review' | 'reject'
  reasons: string[]
  timestamp: Date
}

export interface FraudCheckRequest {
  phone?: string
  ip?: string
  email?: string
  amount?: number
  currency?: string
  userId?: string
  campaignId?: string
  metadata?: Record<string, unknown>
}

export interface BlockingRule {
  id: string
  type: 'phone' | 'ip' | 'email' | 'pattern'
  value: string
  reason: string
  createdAt: Date
  expiresAt?: Date
  autoBlocked: boolean
}

export interface FraudConfig {
  truecaller: {
    apiKey: string
    baseUrl: string
    timeout: number
  }
  ipquality: {
    apiKey: string
    baseUrl: string
    timeout: number
  }
  fraudlabs: {
    apiKey: string
    baseUrl: string
    timeout: number
  }
  thresholds: {
    autoReject: number
    manualReview: number
    autoApprove: number
  }
}
