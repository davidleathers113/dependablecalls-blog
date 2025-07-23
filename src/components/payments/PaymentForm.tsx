import React, { useState, useEffect, useCallback } from 'react'
import { loadStripe, type StripeElementsOptions } from '@stripe/stripe-js'
import { Elements, useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js'
import { CreditCardIcon, LockClosedIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { createPaymentIntent } from '@/integrations/stripe/payments'
import { useAuth } from '@/hooks/useAuth'
import type { CreatePaymentIntentParams } from '@/integrations/stripe/types'
import { PaymentErrorBoundary } from './PaymentErrorBoundary'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '')

interface PaymentFormProps {
  amount: number
  currency?: string
  description: string
  metadata: {
    invoiceId: string
    buyerId: string
    billingPeriod: string
  }
  onSuccess?: (paymentIntentId: string) => void
  onError?: (error: string) => void
  paymentMethods?: ('card' | 'us_bank_account')[]
}

interface PaymentFormInnerProps extends PaymentFormProps {
  clientSecret: string
}

const PaymentFormInner: React.FC<PaymentFormInnerProps> = ({
  amount,
  currency = 'usd',
  description,
  onSuccess,
  onError,
  paymentMethods = ['card'],
}) => {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<
    'idle' | 'processing' | 'succeeded' | 'failed'
  >('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)
    setErrorMessage('')
    setPaymentStatus('processing')

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payments/return`,
        },
        redirect: 'if_required',
      })

      if (error) {
        setErrorMessage(error.message || 'Payment failed')
        setPaymentStatus('failed')
        onError?.(error.message || 'Payment failed')
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        setPaymentStatus('succeeded')
        onSuccess?.(paymentIntent.id)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment processing failed'
      setErrorMessage(message)
      setPaymentStatus('failed')
      onError?.(message)
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
        <h3 className="text-lg font-medium text-gray-900 mb-2">Payment Successful</h3>
        <p className="text-gray-600">
          Your payment of ${(amount / 100).toFixed(2)} has been processed successfully.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Amount</span>
          <span className="text-lg font-bold text-gray-900">
            ${(amount / 100).toFixed(2)} {currency.toUpperCase()}
          </span>
        </div>
        <p className="text-sm text-gray-600">{description}</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
          <div className="border border-gray-300 rounded-lg p-4">
            <PaymentElement
              options={{
                layout: 'tabs',
                paymentMethodOrder: paymentMethods,
              }}
            />
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600">{errorMessage}</p>
        </div>
      )}

      <div className="flex items-center text-sm text-gray-500 mb-4">
        <LockClosedIcon className="w-4 h-4 mr-2" />
        <span>Your payment information is secure and encrypted</span>
      </div>

      <button
        type="submit"
        disabled={!stripe || isProcessing || paymentStatus === 'processing'}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
          isProcessing || paymentStatus === 'processing'
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700'
        } text-white`}
      >
        {isProcessing || paymentStatus === 'processing' ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            Processing Payment...
          </div>
        ) : (
          <>
            <CreditCardIcon className="w-5 h-5 inline mr-2" />
            Pay ${(amount / 100).toFixed(2)}
          </>
        )}
      </button>

      <div className="text-xs text-gray-500 text-center">
        Powered by <span className="font-medium">Stripe</span> • Your card details are never stored
        on our servers
      </div>
    </form>
  )
}

// Wrapped version with error boundary
export const PaymentFormWithErrorBoundary: React.FC<PaymentFormProps> = (props) => {
  const [retryKey, setRetryKey] = useState(0)

  const handleRetry = () => {
    // Force re-render by changing key
    setRetryKey((prev) => prev + 1)
  }

  const handleUpdatePaymentMethod = () => {
    // Navigate to payment methods page
    window.location.href = '/app/settings/payment-methods'
  }

  const handleContactSupport = () => {
    // Navigate to support with payment context
    window.location.href = '/support?type=payment-error'
  }

  return (
    <PaymentErrorBoundary
      onRetry={handleRetry}
      onUpdatePaymentMethod={handleUpdatePaymentMethod}
      onContactSupport={handleContactSupport}
      preserveFormData={true}
    >
      <PaymentFormInner key={retryKey} {...props} />
    </PaymentErrorBoundary>
  )
}

// Inner form component (original PaymentForm)
const PaymentFormInner: React.FC<PaymentFormProps> = (props) => {
  const { user } = useAuth()
  const [clientSecret, setClientSecret] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')

  // Destructure props for useCallback dependencies
  const { amount, currency, metadata, paymentMethods, onError } = props

  const createPaymentIntentForForm = useCallback(async () => {
    if (!user) {
      setError('User not authenticated')
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError('')

      const params: CreatePaymentIntentParams = {
        amount: amount,
        currency: currency || 'usd',
        customerId: user.stripe_customer_id || '',
        metadata: metadata,
        paymentMethodTypes: paymentMethods,
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
      onError?.(message)
    } finally {
      setIsLoading(false)
    }
  }, [amount, currency, metadata, paymentMethods, onError, user])

  useEffect(() => {
    createPaymentIntentForForm()
  }, [createPaymentIntentForForm])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Preparing payment form...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
        <button
          onClick={createPaymentIntentForForm}
          className="mt-2 text-red-700 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    )
  }

  if (!clientSecret) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-600">Payment form is not ready</p>
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

  return (
    <div className="max-w-md mx-auto">
      <Elements stripe={stripePromise} options={elementsOptions}>
        <PaymentFormInner {...props} clientSecret={clientSecret} />
      </Elements>
    </div>
  )
}

// Export both versions
export const PaymentForm = PaymentFormInner
export default PaymentFormWithErrorBoundary
