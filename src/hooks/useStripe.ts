import { useState, useEffect } from 'react'
import type { Stripe, StripeElements } from '@stripe/stripe-js'
import { getStripeClient } from '../integrations/stripe'

export const useStripe = () => {
  const [stripe, setStripe] = useState<Stripe | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initStripe = async () => {
      try {
        const stripeClient = await getStripeClient()
        setStripe(stripeClient)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize Stripe'
        setError(errorMessage)
      } finally {
        setIsLoading(false)
      }
    }

    initStripe()
  }, [])

  return { stripe, isLoading, error }
}

export const useStripeElements = () => {
  const { stripe } = useStripe()
  const [elements, setElements] = useState<StripeElements | null>(null)

  useEffect(() => {
    if (stripe) {
      setElements(stripe.elements())
    }
  }, [stripe])

  return { stripe, elements }
}
