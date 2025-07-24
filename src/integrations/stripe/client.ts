import Stripe from 'stripe'

const STRIPE_API_VERSION = '2025-06-30.basil' as const

export const stripeServerClient = new Stripe(import.meta.env.VITE_STRIPE_SECRET_KEY || '', {
  apiVersion: STRIPE_API_VERSION,
  typescript: true,
})

let stripePromise: Promise<import('@stripe/stripe-js').Stripe | null> | null = null

export const getStripeClient = async () => {
  if (!stripePromise) {
    const { loadStripe } = await import('@stripe/stripe-js')
    stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '')
  }
  return stripePromise
}

export const stripeConfig = {
  webhookSecret: import.meta.env.VITE_STRIPE_WEBHOOK_SECRET || '',
  connectClientId: import.meta.env.VITE_STRIPE_CONNECT_CLIENT_ID || '',
  apiVersion: STRIPE_API_VERSION,
}

export const isStripeConfigured = () => {
  return !!(import.meta.env.VITE_STRIPE_SECRET_KEY && import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
}
