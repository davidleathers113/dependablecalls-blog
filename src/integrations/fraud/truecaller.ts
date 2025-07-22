import axios from 'axios'
import { fraudConfig } from './config'
import type { PhoneVerificationResult } from './types'

export class TruecallerClient {
  private client = axios.create({
    baseURL: fraudConfig.truecaller.baseUrl,
    timeout: fraudConfig.truecaller.timeout,
    headers: {
      Authorization: `Bearer ${fraudConfig.truecaller.apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  async verifyPhone(phoneNumber: string): Promise<PhoneVerificationResult> {
    try {
      // Format phone number to E.164 format if needed
      const formattedPhone = this.formatPhoneNumber(phoneNumber)

      const response = await this.client.get('/search', {
        params: {
          q: formattedPhone,
          countryCode: 'US',
        },
      })

      const data = response.data?.data?.[0]

      if (!data) {
        return {
          valid: false,
          error: 'Phone number not found',
        }
      }

      return {
        valid: true,
        carrier: data.carrier,
        country: data.countryCode,
        lineType: this.mapPhoneType(data.phoneType),
        name: data.name,
        spamScore: data.spamScore || 0,
        isActive: data.isActive !== false,
      }
    } catch (error) {
      console.error('TrueCaller verification error:', error)

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          return {
            valid: false,
            error: 'Phone number not found',
          }
        }
        return {
          valid: false,
          error: `Verification failed: ${error.response?.data?.message || error.message}`,
        }
      }

      return {
        valid: false,
        error: 'Phone verification service unavailable',
      }
    }
  }

  private formatPhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '')

    // Add country code if missing (assume US)
    if (cleaned.length === 10) {
      return `+1${cleaned}`
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`
    }

    // If already has country code or different format, return as is
    return phone.startsWith('+') ? phone : `+${cleaned}`
  }

  private mapPhoneType(type?: string): 'mobile' | 'landline' | 'voip' | 'unknown' {
    switch (type?.toLowerCase()) {
      case 'mobile':
      case 'cellular':
        return 'mobile'
      case 'fixed':
      case 'landline':
        return 'landline'
      case 'voip':
      case 'virtual':
        return 'voip'
      default:
        return 'unknown'
    }
  }

  // Additional utility methods
  async checkSpamScore(phoneNumber: string): Promise<number> {
    const result = await this.verifyPhone(phoneNumber)
    return result.spamScore || 0
  }

  async isPhoneActive(phoneNumber: string): Promise<boolean> {
    const result = await this.verifyPhone(phoneNumber)
    return result.valid && (result.isActive ?? false)
  }
}

// Export singleton instance
export const truecallerClient = new TruecallerClient()
