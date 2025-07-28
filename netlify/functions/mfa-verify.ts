import type { Handler } from '@netlify/functions'
import { withAuth } from '../../src/lib/auth-middleware'
import { mfaService } from '../../src/lib/mfa/mfa-service'
import { MFAVerificationRequest } from '../../src/types/mfa'
import { createDeviceTrustCookie, generateDeviceName } from '../../src/lib/mfa/device-trust'

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: '',
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  return withAuth(event, async (context, request) => {
    if (!context.user || !request.body) {
      throw new Error('Invalid request')
    }

    const body = JSON.parse(request.body)
    const { method, code, trustDevice = false } = body

    if (!method || !code) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Method and code are required' }),
      }
    }

    const verificationRequest: MFAVerificationRequest = {
      method,
      code,
      trustDevice
    }

    try {
      const result = await mfaService.verifyMFA(
        context.user.id,
        verificationRequest,
        request.headers['user-agent'] || '',
        request.headers['x-forwarded-for'] || '127.0.0.1'
      )

      const responseHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
      }

      // If verification succeeded and device should be trusted, set device trust cookie
      if (result.success && result.deviceTrusted) {
        const deviceName = generateDeviceName(request.headers['user-agent'] || '')
        const fingerprint = 'device-fingerprint-placeholder' // Would be generated client-side
        
        const deviceCookie = await import('../../src/lib/mfa/device-trust').then(module => 
          module.createTrustedDevice(
            context.user!.id,
            deviceName,
            fingerprint,
            request.headers['x-forwarded-for'] || '127.0.0.1',
            request.headers['user-agent'] || ''
          )
        )

        responseHeaders['Set-Cookie'] = createDeviceTrustCookie(deviceCookie)
      }

      return {
        statusCode: result.success ? 200 : 400,
        headers: responseHeaders,
        body: JSON.stringify({
          success: result.success,
          deviceTrusted: result.deviceTrusted,
          backupCodesRemaining: result.backupCodesRemaining,
          error: result.error
        }),
      }
    } catch (error) {
      console.error('MFA verification error:', error)
      
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
        body: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Verification failed'
        }),
      }
    }
  })
}