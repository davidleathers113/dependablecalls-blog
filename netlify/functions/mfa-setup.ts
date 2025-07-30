import type { Handler } from '@netlify/functions'
import { withAuth } from '../../src/lib/auth-middleware'
import { mfaService } from '../../src/lib/mfa/mfa-service'

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: '',
    }
  }

  if (event.httpMethod === 'GET') {
    // Get MFA status
    return withAuth(event, async (context) => {
      if (!context.user) {
        throw new Error('User not found')
      }

      const status = await mfaService.getMFAStatus(context.user.id)
      return { status }
    })
  }

  if (event.httpMethod === 'POST') {
    return withAuth(event, async (context, request) => {
      if (!context.user || !request.body) {
        throw new Error('Invalid request')
      }

      const body = JSON.parse(request.body)
      const { action, ...params } = body

      switch (action) {
        case 'setup_totp': {
          const setupData = await mfaService.setupTOTP(context.user.id, context.user.email)
          return { setupData }
        }

        case 'verify_totp_setup': {
          const { code } = params
          const result = await mfaService.verifyTOTPSetup(context.user.id, code)
          return { result }
        }

        case 'setup_sms': {
          const { phoneNumber } = params
          const smsResult = await mfaService.setupSMSBackup(
            context.user.id,
            phoneNumber,
            request.headers['user-agent'] || '',
            request.headers['x-forwarded-for'] || '127.0.0.1'
          )
          return { result: smsResult }
        }

        default:
          throw new Error('Invalid action')
      }
    })
  }

  return {
    statusCode: 405,
    body: JSON.stringify({ error: 'Method not allowed' }),
  }
}