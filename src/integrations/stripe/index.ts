export * from './client';
export * from './types';
export * from './customers';
export * from './connected-accounts';
export * from './payments';
export * from './subscriptions';
export * from './billing';
export * from './payouts';
export * from './webhooks';

// Re-export commonly used functions
export {
  stripeServerClient,
  getStripeClient,
  isStripeConfigured,
} from './client';

export {
  createStripeCustomer,
  createConnectedAccount,
  createPaymentIntent,
  createSubscription,
  createInvoice,
  createTransfer,
  handleStripeWebhook,
} from './customers';

// Helper to check if all required Stripe environment variables are set
export const validateStripeEnvironment = (): { isValid: boolean; missing: string[] } => {
  const required = [
    'VITE_STRIPE_SECRET_KEY',
    'VITE_STRIPE_PUBLISHABLE_KEY',
    'VITE_STRIPE_WEBHOOK_SECRET',
  ];
  
  const missing = required.filter(key => !import.meta.env[key]);
  
  return {
    isValid: missing.length === 0,
    missing,
  };
};