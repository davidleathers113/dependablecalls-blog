import React, { useState, useCallback } from 'react'
import { loadStripe, type StripeElementsOptions } from '@stripe/stripe-js'
import { Elements, useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js'
import {
  CreditCardIcon,
  LockClosedIcon,
  CheckCircleIcon,
  BoltIcon,
} from '@heroicons/react/24/outline'
import { createPaymentIntent } from '@/integrations/stripe/payments'
import { useAuth } from '@/hooks/useAuth'
import type { CreatePaymentIntentParams } from '@/integrations/stripe/types'
import { PaymentErrorBoundary } from './PaymentErrorBoundary'
import { useBuyerStore } from '@/store/buyerStore'
import { formatCurrency } from '@/utils/format'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '')

interface QuickTopUpFormProps {
  onSuccess?: (paymentIntentId: string, amount: number) => void
  onCancel?: () => void
  defaultAmount?: number
}

const QUICK_AMOUNTS = [100, 250, 500, 1000] // Amounts in dollars

interface QuickTopUpInnerProps extends QuickTopUpFormProps {
  clientSecret?: string
}

const QuickTopUpInner: React.FC<QuickTopUpInnerProps> = ({
  onSuccess,
  onCancel,
  defaultAmount = 250,
  clientSecret,
}) => {
  const stripe = useStripe()
  const elements = useElements()
  const { updateBalance } = useBuyerStore()

  const [selectedAmount, setSelectedAmount] = useState(defaultAmount)
  const [customAmount, setCustomAmount] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<
    'idle' | 'processing' | 'succeeded' | 'failed'
  >('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const getAmount = useCallback(() => {
    if (isCustom && customAmount) {
      const parsed = parseFloat(customAmount)
      return isNaN(parsed) ? 0 : parsed
    }
    return selectedAmount
  }, [isCustom, customAmount, selectedAmount])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!stripe || !elements || !clientSecret) {
      return
    }

    const amount = getAmount()
    if (amount < 10) {
      setErrorMessage('Minimum top-up amount is $10')
      return
    }

    if (amount > 10000) {
      setErrorMessage('Maximum top-up amount is $10,000')
      return
    }

    setIsProcessing(true)
    setErrorMessage('')
    setPaymentStatus('processing')

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/app/buyer/payments/return`,
        },
        redirect: 'if_required',
      })

      if (error) {
        setErrorMessage(error.message || 'Payment failed')
        setPaymentStatus('failed')
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        setPaymentStatus('succeeded')
        // Update local balance immediately
        updateBalance(currentBalance + amount)
        onSuccess?.(paymentIntent.id, amount)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment processing failed'
      setErrorMessage(message)
      setPaymentStatus('failed')
    } finally {
      setIsProcessing(false)
    }
  }

  if (paymentStatus === 'succeeded') {
    return (
      <div className="text-center py-8">
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircleIcon className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Top-Up Successful!</h3>
        <p className="text-gray-600 mb-4">
          ${getAmount().toFixed(2)} has been added to your account balance.
        </p>
        <p className="text-sm text-gray-500">New balance: {formatCurrency(currentBalance)}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          <BoltIcon className="w-5 h-5 inline mr-2 text-blue-600" />
          Quick Top-Up
        </h3>

        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">Current Balance</div>
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(currentBalance)}</div>
        </div>

        <label className="block text-sm font-medium text-gray-700 mb-3">Select Amount</label>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {QUICK_AMOUNTS.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => {
                setSelectedAmount(amount)
                setIsCustom(false)
                setCustomAmount('')
              }}
              className={`p-3 rounded-lg border-2 transition-colors ${
                !isCustom && selectedAmount === amount
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              ${amount}
            </button>
          ))}
        </div>

        <div className="relative">
          <input
            type="text"
            inputMode="decimal"
            placeholder="Enter custom amount"
            value={customAmount}
            onChange={(e) => {
              const value = e.target.value
              // Allow only numbers and decimal point
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setCustomAmount(value)
                setIsCustom(true)
              }
            }}
            onFocus={() => setIsCustom(true)}
            className={`w-full px-4 py-3 rounded-lg border-2 transition-colors ${
              isCustom ? 'border-blue-600 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
            $
          </span>
        </div>
      </div>

      {clientSecret && (
        <>
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">Payment Method</label>
            <div className="border border-gray-300 rounded-lg p-4">
              <PaymentElement
                options={{
                  layout: 'tabs',
                  paymentMethodOrder: ['card', 'us_bank_account'],
                }}
              />
            </div>
          </div>

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-600">{errorMessage}</p>
            </div>
          )}

          <div className="flex items-center text-sm text-gray-500">
            <LockClosedIcon className="w-4 h-4 mr-2" />
            <span>Your payment information is secure and encrypted</span>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 px-4 rounded-lg font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
              disabled={isProcessing}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!stripe || isProcessing || !getAmount()}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                isProcessing ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              } text-white`}
            >
              {isProcessing ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Processing...
                </div>
              ) : (
                <>
                  <CreditCardIcon className="w-5 h-5 inline mr-2" />
                  Add ${getAmount().toFixed(2)}
                </>
              )}
            </button>
          </div>
        </>
      )}
    </form>
  )
}

// Main component that creates payment intent
export const QuickTopUpForm: React.FC<QuickTopUpFormProps> = (props) => {
  const { user } = useAuth()
  const [clientSecret, setClientSecret] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [selectedAmount] = useState(props.defaultAmount || 250)

  const createPaymentIntentForAmount = useCallback(
    async (amount: number) => {
      if (!user) {
        setError('User not authenticated')
        return
      }

      try {
        setIsLoading(true)
        setError('')

        const params: CreatePaymentIntentParams = {
          amount: Math.round(amount * 100), // Convert to cents
          currency: 'usd',
          customerId: user.stripe_customer_id || '',
          metadata: {
            invoiceId: `topup-${Date.now()}`,
            buyerId: user.id,
            billingPeriod: 'immediate',
          },
          paymentMethodTypes: ['card', 'us_bank_account'],
        }

        const paymentIntent = await createPaymentIntent(params)

        if (paymentIntent.client_secret) {
          setClientSecret(paymentIntent.client_secret)
        } else {
          throw new Error('Failed to create payment intent')
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to initialize payment'
        setError(message)
      } finally {
        setIsLoading(false)
      }
    },
    [user]
  )

  // Create initial payment intent
  React.useEffect(() => {
    createPaymentIntentForAmount(selectedAmount)
  }, [selectedAmount, createPaymentIntentForAmount])

  if (isLoading && !clientSecret) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Setting up payment...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => createPaymentIntentForAmount(selectedAmount)}
          className="mt-2 text-red-700 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    )
  }

  const elementsOptions: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#2563eb',
        colorBackground: '#ffffff',
        colorText: '#374151',
        colorDanger: '#ef4444',
        fontFamily: 'system-ui, sans-serif',
        spacingUnit: '4px',
        borderRadius: '8px',
      },
    },
  }

  return clientSecret ? (
    <Elements stripe={stripePromise} options={elementsOptions}>
      <QuickTopUpInner {...props} clientSecret={clientSecret} />
    </Elements>
  ) : null
}

// Export with error boundary
export default function QuickTopUpWithErrorBoundary(props: QuickTopUpFormProps) {
  const [retryKey, setRetryKey] = useState(0)

  return (
    <PaymentErrorBoundary
      onRetry={() => setRetryKey((prev) => prev + 1)}
      onUpdatePaymentMethod={() => (window.location.href = '/app/settings/payment-methods')}
      onContactSupport={() => (window.location.href = '/support?type=payment-error')}
      preserveFormData={true}
    >
      <QuickTopUpForm key={retryKey} {...props} />
    </PaymentErrorBoundary>
  )
}
