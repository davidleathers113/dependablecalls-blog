import axios from 'axios'
import { fraudConfig } from './config'
import type { TransactionScreeningResult, FraudCheckRequest } from './types'

export class FraudLabsClient {
  private client = axios.create({
    baseURL: fraudConfig.fraudlabs.baseUrl,
    timeout: fraudConfig.fraudlabs.timeout,
  })

  async screenTransaction(request: FraudCheckRequest): Promise<TransactionScreeningResult> {
    try {
      const response = await this.client.post('/screen', {
        key: fraudConfig.fraudlabs.apiKey,
        format: 'json',
        ip: request.ip,
        email: request.email,
        phone: request.phone,
        amount: request.amount,
        currency: request.currency || 'USD',
        user_order_id: request.campaignId,
        user_order_memo: request.userId,
        // Additional parameters for better fraud detection
        payment_mode: 'creditcard',
        flp_checksum: '',
      })

      const data = response.data

      // Parse the fraud score
      const fraudScore = parseFloat(data.fraudlabspro_score) || 0

      // Determine status based on score and rules
      const status = this.determineStatus(fraudScore, data)

      // Extract triggered rules
      const rules = this.extractTriggeredRules(data)

      // Build risk factors
      const riskFactors = {
        ip: data.ip_address,
        email: data.email_address,
        phone: data.phone_number,
        billing: data.billing_address,
        shipping: data.shipping_address,
      }

      return {
        fraudScore,
        status,
        rules,
        riskFactors,
      }
    } catch (error) {
      console.error('FraudLabs screening error:', error)

      if (axios.isAxiosError(error)) {
        return {
          fraudScore: 0,
          status: 'review',
          rules: [],
          riskFactors: {},
          error: `Transaction screening failed: ${error.response?.data?.message || error.message}`,
        }
      }

      return {
        fraudScore: 0,
        status: 'review',
        rules: [],
        riskFactors: {},
        error: 'Transaction screening service unavailable',
      }
    }
  }

  private determineStatus(
    score: number,
    data: Record<string, unknown>
  ): 'approve' | 'review' | 'reject' {
    // Check if FraudLabs already made a decision
    const flpStatus = String(data.fraudlabspro_status || '').toLowerCase()

    if (flpStatus === 'approve') return 'approve'
    if (flpStatus === 'reject') return 'reject'
    if (flpStatus === 'review') return 'review'

    // Otherwise, use score-based decision
    if (score >= 90) return 'reject'
    if (score >= 60) return 'review'
    return 'approve'
  }

  private extractTriggeredRules(data: Record<string, unknown>): string[] {
    const rules: string[] = []

    // Check various risk indicators
    const riskIndicators = [
      { field: 'is_proxy_ip', message: 'Proxy IP detected' },
      { field: 'is_free_email', message: 'Free email provider' },
      { field: 'is_disposable_email', message: 'Disposable email detected' },
      { field: 'is_new_domain_name', message: 'Newly registered domain' },
      { field: 'is_phone_blacklisted', message: 'Phone number blacklisted' },
      { field: 'is_email_blacklisted', message: 'Email blacklisted' },
      { field: 'is_high_risk_country', message: 'High risk country' },
      { field: 'is_ip_country_mismatch', message: 'IP country mismatch' },
      { field: 'is_phone_country_mismatch', message: 'Phone country mismatch' },
    ]

    for (const indicator of riskIndicators) {
      if (data[indicator.field] === 'Y' || data[indicator.field] === true) {
        rules.push(indicator.message)
      }
    }

    // Check velocity rules
    if (Number(data.ip_velocity) > 5) {
      rules.push(`High IP velocity: ${data.ip_velocity} orders`)
    }
    if (Number(data.email_velocity) > 5) {
      rules.push(`High email velocity: ${data.email_velocity} orders`)
    }

    // Check credit usage
    if (Number(data.remaining_credits) < 100) {
      console.warn('FraudLabs Pro credits running low:', data.remaining_credits)
    }

    return rules
  }

  // Utility methods
  async quickCheck(ip: string, email: string): Promise<number> {
    const result = await this.screenTransaction({ ip, email })
    return result.fraudScore
  }

  async isBlacklisted(email?: string, phone?: string): Promise<boolean> {
    if (!email && !phone) return false

    const result = await this.screenTransaction({ email, phone })
    return result.rules.some((rule) => rule.includes('blacklisted') || rule.includes('blocked'))
  }

  async checkEmailReputation(email: string): Promise<{
    isFree: boolean
    isDisposable: boolean
    isValid: boolean
  }> {
    const result = await this.screenTransaction({ email })

    // Extract email-specific indicators from the response
    const isFree = result.rules.includes('Free email provider')
    const isDisposable = result.rules.includes('Disposable email detected')
    const isValid = !result.error && result.fraudScore < 80

    return { isFree, isDisposable, isValid }
  }
}

// Export singleton instance
export const fraudLabsClient = new FraudLabsClient()
