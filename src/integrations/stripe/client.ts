import Stripe from 'stripe';
import { loadStripe } from '@stripe/stripe-js';

const STRIPE_API_VERSION = '2023-10-16' as const;

export const stripeServerClient = new Stripe(
  import.meta.env.VITE_STRIPE_SECRET_KEY || '',
  {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
  }
);

let stripePromise: Promise<any> | null = null;

export const getStripeClient = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');
  }
  return stripePromise;
};

export const stripeConfig = {
  webhookSecret: import.meta.env.VITE_STRIPE_WEBHOOK_SECRET || '',
  connectClientId: import.meta.env.VITE_STRIPE_CONNECT_CLIENT_ID || '',
  apiVersion: STRIPE_API_VERSION,
};

export const isStripeConfigured = () => {
  return !!(
    import.meta.env.VITE_STRIPE_SECRET_KEY &&
    import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  );
};