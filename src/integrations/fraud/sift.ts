import axios from 'axios'
import { fraudConfig } from './config'
import type { SiftFraudResult, FraudCheckRequest } from './types'

export class SiftClient {
  private client = axios.create({
    baseURL: fraudConfig.sift.baseUrl,
    timeout: fraudConfig.sift.timeout,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  async screenTransaction(request: FraudCheckRequest): Promise<SiftFraudResult> {
    try {
      // Create user if needed and send events
      if (request.userId) {
        await this.sendUserEvent(request)
      }

      // Send transaction event for payment fraud detection
      if (request.amount) {
        await this.sendTransactionEvent(request)
      }

      // Get fraud score
      const scoreResponse = await this.getScore(request.userId || 'anonymous')

      return this.processScoreResponse(scoreResponse.data as Record<string, unknown>)
    } catch (error) {
      console.error('Sift fraud check error:', error)

      if (axios.isAxiosError(error)) {
        return {
          fraudScore: 0,
          status: 'review',
          reasons: [],
          error: `Sift screening failed: ${error.response?.data?.message || error.message}`,
        }
      }

      return {
        fraudScore: 0,
        status: 'review',
        reasons: [],
        error: 'Sift fraud detection service unavailable',
      }
    }
  }

  private async sendUserEvent(request: FraudCheckRequest): Promise<void> {
    const eventData = {
      $type: '$create_account',
      $api_key: fraudConfig.sift.apiKey,
      $user_id: request.userId,
      $session_id: this.generateSessionId(),
      $ip: request.ip,
      $user_email: request.email,
      $phone: request.phone,
      $time: Math.floor(Date.now() / 1000),
      // Additional context
      $brand_name: 'DependableCalls',
      $site_country: 'US',
      $site_domain: 'dependablecalls.com',
    }

    await this.client.post('/events', eventData)
  }

  private async sendTransactionEvent(request: FraudCheckRequest): Promise<void> {
    const eventData = {
      $type: '$transaction',
      $api_key: fraudConfig.sift.apiKey,
      $user_id: request.userId || 'anonymous',
      $session_id: this.generateSessionId(),
      $ip: request.ip,
      $time: Math.floor(Date.now() / 1000),
      $amount: Math.round((request.amount || 0) * 1000000), // Convert to micros
      $currency_code: request.currency || 'USD',
      $transaction_type: '$sale',
      $transaction_status: '$pending',
      $order_id: request.campaignId,
      // Payment method details
      $payment_method: {
        $payment_type: '$credit_card',
        $payment_gateway: '$stripe',
      },
      // Additional fraud signals
      $digital_goods: false,
      $shipping_address: {
        $country: 'US', // Default for call platform
      },
      $billing_address: {
        $country: 'US',
      },
    }

    await this.client.post('/events', eventData)
  }

  private async getScore(userId: string): Promise<{ data: unknown }> {
    const params = new URLSearchParams({
      api_key: fraudConfig.sift.apiKey,
      abuse_types: 'payment_abuse,account_abuse',
    })

    const response = await this.client.get(`/score/${userId}?${params.toString()}`)
    return response
  }

  private processScoreResponse(data: Record<string, unknown>): SiftFraudResult {
    const scores = (data.scores as Record<string, unknown>) || {}
    const paymentAbuse = (scores.payment_abuse as Record<string, unknown>) || {}
    const accountAbuse = (scores.account_abuse as Record<string, unknown>) || {}

    const paymentScore = Number(paymentAbuse.score) || 0
    const accountScore = Number(accountAbuse.score) || 0

    // Take the higher of the two scores
    const fraudScore = Math.max(paymentScore, accountScore) * 100 // Convert to 0-100 scale

    const reasons: string[] = []
    const workflowStatus = (data.workflow_statuses as Record<string, unknown>) || {}

    // Extract reasons from workflow decisions
    Object.entries(workflowStatus).forEach(([key, value]) => {
      if (value && typeof value === 'object') {
        const decision = value as Record<string, unknown>
        if (decision.decision === 'block' || decision.decision === 'review') {
          reasons.push(`Sift ${key} triggered: ${decision.decision}`)
        }
      }
    })

    // Determine status based on score and workflow
    let status: 'approve' | 'review' | 'reject' = 'approve'

    if (
      Object.values(workflowStatus).some(
        (w) => w && typeof w === 'object' && (w as Record<string, unknown>).decision === 'block'
      )
    ) {
      status = 'reject'
    } else if (
      fraudScore >= 80 ||
      Object.values(workflowStatus).some(
        (w) => w && typeof w === 'object' && (w as Record<string, unknown>).decision === 'review'
      )
    ) {
      status = 'review'
    }

    return {
      fraudScore: Math.round(fraudScore),
      status,
      workflowStatus: JSON.stringify(workflowStatus),
      reasons,
      paymentAbuseScore: paymentScore * 100,
      accountAbuseScore: accountScore * 100,
    }
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Utility methods
  async reportGoodTransaction(userId: string): Promise<void> {
    const eventData = {
      $type: '$label',
      $api_key: fraudConfig.sift.apiKey,
      $is_fraud: false,
      $abuse_type: 'payment_abuse',
      $description: 'Confirmed good transaction',
      $source: 'manual_review',
      $analyst: 'system',
      $time: Math.floor(Date.now() / 1000),
    }

    await this.client.post(`/users/${userId}/labels`, eventData)
  }

  async reportFraudulentTransaction(userId: string, reason: string): Promise<void> {
    const eventData = {
      $type: '$label',
      $api_key: fraudConfig.sift.apiKey,
      $is_fraud: true,
      $abuse_type: 'payment_abuse',
      $description: `Fraudulent transaction: ${reason}`,
      $source: 'manual_review',
      $analyst: 'system',
      $time: Math.floor(Date.now() / 1000),
    }

    await this.client.post(`/users/${userId}/labels`, eventData)
  }

  async sendCallEvent(phoneNumber: string, campaignId: string, ip: string): Promise<void> {
    const eventData = {
      $type: '$create_content',
      $api_key: fraudConfig.sift.apiKey,
      $user_id: `phone_${phoneNumber}`,
      $session_id: this.generateSessionId(),
      $ip: ip,
      $time: Math.floor(Date.now() / 1000),
      $content_id: campaignId,
      $contact_phone: phoneNumber,
      // Custom properties for call fraud detection
      $custom: {
        event_type: 'incoming_call',
        campaign_id: campaignId,
        call_source: 'external',
      },
    }

    await this.client.post('/events', eventData)
  }
}

// Export singleton instance
export const siftClient = new SiftClient()
