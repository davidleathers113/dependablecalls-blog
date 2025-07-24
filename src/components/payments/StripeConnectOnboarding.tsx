import React, { useState, useEffect, useCallback } from 'react'
import { CheckCircleIcon, ExclamationTriangleIcon, ClockIcon } from '@heroicons/react/24/outline'
import { useAuth } from '@/hooks/useAuth'
import {
  createConnectedAccount,
  createAccountLink,
  getConnectedAccount,
} from '@/integrations/stripe/connected-accounts'
import type { ConnectedAccountStatus } from '@/integrations/stripe/types'

interface StripeConnectOnboardingProps {
  onComplete?: (accountId: string) => void
  onError?: (error: string) => void
}

export const StripeConnectOnboarding: React.FC<StripeConnectOnboardingProps> = ({
  onComplete,
  onError,
}) => {
  const { user } = useAuth()
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'creating' | 'onboarding' | 'complete' | 'error'
  >('idle')
  const [error, setError] = useState<string>('')
  const [accountData, setAccountData] = useState<ConnectedAccountStatus | null>(null)

  const checkExistingAccount = useCallback(async () => {
    if (!user?.stripe_account_id) return

    try {
      setStatus('loading')
      const account = await getConnectedAccount(user.stripe_account_id)

      if (account) {
        const accountStatus: ConnectedAccountStatus = {
          id: account.id,
          chargesEnabled: account.charges_enabled || false,
          payoutsEnabled: account.payouts_enabled || false,
          detailsSubmitted: account.details_submitted || false,
          requirementsCurrentlyDue: account.requirements?.currently_due || [],
        }
        setAccountData(accountStatus)

        if (accountStatus.chargesEnabled && accountStatus.payoutsEnabled) {
          setStatus('complete')
          onComplete?.(accountStatus.id)
        } else {
          setStatus('onboarding')
        }
      } else {
        setStatus('idle')
      }
    } catch (err) {
      console.error('Error checking existing account:', err)
      setStatus('idle')
    }
  }, [user, onComplete])

  useEffect(() => {
    checkExistingAccount()
  }, [checkExistingAccount])

  const startOnboarding = async () => {
    if (!user || !user.email) {
      setError('User not authenticated or email missing')
      setStatus('error')
      return
    }

    try {
      setStatus('creating')
      setError('')

      // Create connected account if doesn't exist
      let accountId = user.stripe_account_id
      if (!accountId) {
        const account = await createConnectedAccount({
          email: user.email,
          country: 'US',
          businessType: 'company',
          metadata: {
            supplierId: user.id,
            companyName: user.company_name || undefined,
          },
        })
        accountId = account.id
      }

      // Create account link for onboarding
      const refreshUrl = `${window.location.origin}/suppliers/onboarding/refresh`
      const returnUrl = `${window.location.origin}/suppliers/onboarding/return`

      const accountLink = await createAccountLink(accountId, refreshUrl, returnUrl)

      setStatus('onboarding')

      // Redirect to Stripe onboarding
      window.location.href = accountLink.url
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start onboarding'
      setError(errorMessage)
      setStatus('error')
      onError?.(errorMessage)
    }
  }

  const refreshOnboarding = async () => {
    if (!user?.stripe_account_id) return

    try {
      setStatus('creating')
      const refreshUrl = `${window.location.origin}/suppliers/onboarding/refresh`
      const returnUrl = `${window.location.origin}/suppliers/onboarding/return`

      const accountLink = await createAccountLink(user.stripe_account_id, refreshUrl, returnUrl)
      window.location.href = accountLink.url
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh onboarding'
      setError(errorMessage)
      setStatus('error')
    }
  }

  const renderStatus = () => {
    switch (status) {
      case 'idle':
        return (
          <div className="text-center">
            <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <ClockIcon className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Set Up Payouts</h3>
            <p className="text-gray-600 mb-6">
              Connect your bank account with Stripe to receive payments from calls.
            </p>
            <button
              onClick={startOnboarding}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start Setup
            </button>
          </div>
        )

      case 'loading':
      case 'creating':
        return (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">
              {status === 'loading' ? 'Checking account status...' : 'Setting up your account...'}
            </p>
          </div>
        )

      case 'onboarding':
        return (
          <div className="text-center">
            <div className="mx-auto w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
              <ClockIcon className="w-6 h-6 text-yellow-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Complete Account Setup</h3>
            <p className="text-gray-600 mb-4">
              Your Stripe account is partially set up. Complete the remaining steps to start
              receiving payouts.
            </p>
            {accountData && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 text-left">
                <h4 className="font-medium text-yellow-800 mb-2">Remaining Requirements:</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  {accountData.requirementsCurrentlyDue.map(
                    (requirement: string, index: number) => (
                      <li key={index} className="flex items-start">
                        <span className="w-1.5 h-1.5 bg-yellow-600 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                        {formatRequirement(requirement)}
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}
            <button
              onClick={refreshOnboarding}
              className="bg-yellow-600 text-white px-6 py-2 rounded-lg hover:bg-yellow-700 transition-colors"
            >
              Continue Setup
            </button>
          </div>
        )

      case 'complete':
        return (
          <div className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircleIcon className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Payouts Enabled</h3>
            <p className="text-gray-600 mb-4">
              Your account is fully set up and ready to receive payments.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-green-800 font-medium">Charges:</span>
                  <span className="text-green-700 ml-2">
                    {accountData?.chargesEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div>
                  <span className="text-green-800 font-medium">Payouts:</span>
                  <span className="text-green-700 ml-2">
                    {accountData?.payoutsEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )

      case 'error':
        return (
          <div className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Setup Error</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => setStatus('idle')}
              className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-lg border border-gray-200 p-6">{renderStatus()}</div>
    </div>
  )
}

const formatRequirement = (requirement: string): string => {
  const requirements: Record<string, string> = {
    external_account: 'Bank account information',
    'business_profile.url': 'Business website',
    'business_profile.mcc': 'Business category',
    business_type: 'Business type',
    'company.address.city': 'Business address - city',
    'company.address.line1': 'Business address - street',
    'company.address.postal_code': 'Business address - postal code',
    'company.address.state': 'Business address - state',
    'company.name': 'Business name',
    'company.phone': 'Business phone number',
    'company.tax_id': 'Business tax ID',
    'individual.address.city': 'Personal address - city',
    'individual.address.line1': 'Personal address - street',
    'individual.address.postal_code': 'Personal address - postal code',
    'individual.address.state': 'Personal address - state',
    'individual.dob.day': 'Date of birth - day',
    'individual.dob.month': 'Date of birth - month',
    'individual.dob.year': 'Date of birth - year',
    'individual.email': 'Email address',
    'individual.first_name': 'First name',
    'individual.last_name': 'Last name',
    'individual.phone': 'Phone number',
    'individual.ssn_last_4': 'Last 4 digits of SSN',
    'tos_acceptance.date': 'Terms of service acceptance',
    'tos_acceptance.ip': 'IP address for terms acceptance',
  }

  return (
    requirements[requirement] ||
    requirement.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  )
}

export default StripeConnectOnboarding
