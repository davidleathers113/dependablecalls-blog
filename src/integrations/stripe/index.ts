export * from './client'
export * from './types'
export * from './customers'
export * from './connected-accounts'
export * from './payments'
export * from './subscriptions'
export * from './billing'
export {
  toCents,
  toDollars,
  isValidCents,
  createCents,
  createTransfer as createPayoutTransfer,
  reverseTransfer,
  getTransfer,
  updateTransfer,
  getPayout,
  listAccountPayouts,
  createBulkPayout,
  calculatePayoutSummary,
  scheduleWeeklyPayouts,
} from './payouts'
export * from './webhooks'

// Re-export commonly used functions
export { stripeServerClient, getStripeClient, isStripeConfigured } from './client'

export { createStripeCustomer } from './customers'

export { createConnectedAccount, createTransfer } from './connected-accounts'

export { createPaymentIntent } from './payments'

export { createSubscription } from './subscriptions'

export { createInvoice } from './billing'

export { handleStripeWebhook } from './webhooks'

// Helper to check if all required Stripe environment variables are set
export const validateStripeEnvironment = (): { isValid: boolean; missing: string[] } => {
  const required = [
    'VITE_STRIPE_SECRET_KEY',
    'VITE_STRIPE_PUBLISHABLE_KEY',
    'VITE_STRIPE_WEBHOOK_SECRET',
  ]

  const missing = required.filter((key) => !import.meta.env[key])

  return {
    isValid: missing.length === 0,
    missing,
  }
}
