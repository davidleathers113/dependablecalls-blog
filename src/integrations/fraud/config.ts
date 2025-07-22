import type { FraudConfig } from './types'

export const fraudConfig: FraudConfig = {
  truecaller: {
    apiKey: import.meta.env.VITE_TRUECALLER_API_KEY || '',
    baseUrl: 'https://api.truecaller.com/v2',
    timeout: 5000,
  },
  ipquality: {
    apiKey: import.meta.env.VITE_IPQUALITY_API_KEY || '',
    baseUrl: 'https://ipqualityscore.com/api/json',
    timeout: 5000,
  },
  fraudlabs: {
    apiKey: import.meta.env.VITE_FRAUDLABS_API_KEY || '',
    baseUrl: 'https://api.fraudlabspro.com/v1',
    timeout: 5000,
  },
  thresholds: {
    autoReject: 85, // Fraud score >= 85: automatic rejection
    manualReview: 50, // Fraud score 50-84: manual review required
    autoApprove: 49, // Fraud score <= 49: automatic approval
  },
}

export const isFraudDetectionConfigured = (): boolean => {
  return !!(
    fraudConfig.truecaller.apiKey &&
    fraudConfig.ipquality.apiKey &&
    fraudConfig.fraudlabs.apiKey
  )
}

export const getFraudDecision = (score: number): 'approve' | 'review' | 'reject' => {
  if (score >= fraudConfig.thresholds.autoReject) {
    return 'reject'
  } else if (score >= fraudConfig.thresholds.manualReview) {
    return 'review'
  }
  return 'approve'
}
