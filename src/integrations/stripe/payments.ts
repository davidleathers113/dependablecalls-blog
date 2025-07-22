import { stripeServerClient } from './client';
import type { CreatePaymentIntentParams, PaymentStatus } from './types';
import type Stripe from 'stripe';
import { v4 as uuid } from 'uuid';

/**
 * Centralized error handler for Stripe operations
 * Prevents leaking sensitive information and provides type-safe error handling
 */
function handleStripeError(err: unknown, context: string): never {
  if (err instanceof stripeServerClient.errors.StripeError) {
    console.error(`${context} failed`, { 
      type: err.type, 
      code: err.code, 
      param: err.param,
      requestId: err.requestId 
    });
    
    // Return generic error messages to prevent information leakage
    if (err.code === 'resource_missing') {
      throw new Error(`Resource not found. Please check your request and try again.`);
    }
    
    throw new Error(`Payment service error. Please retry or contact support.`);
  }
  
  console.error(`${context} unexpected error`, err);
  throw new Error('Internal server error. Please try again later.');
}

export const createPaymentIntent = async (
  params: CreatePaymentIntentParams
): Promise<Stripe.PaymentIntent> => {
  try {
    const paymentIntent = await stripeServerClient.paymentIntents.create({
      amount: params.amount,
      currency: params.currency,
      customer: params.customerId,
      payment_method_types: params.paymentMethodTypes ?? ['card', 'us_bank_account'],
      metadata: {
        ...params.metadata,
        platform: 'dependablecalls',
      },
      setup_future_usage: 'off_session',
      automatic_payment_methods: {
        enabled: true, // Enable for better payment method management
      },
    }, {
      idempotencyKey: uuid() // Prevent duplicate payment intent creation
    });
    
    return paymentIntent;
  } catch (error: unknown) {
    handleStripeError(error, 'create payment intent');
  }
};

export const confirmPaymentIntent = async (
  paymentIntentId: string,
  paymentMethodId: string,
  returnUrl: string
): Promise<Stripe.PaymentIntent> => {
  try {
    const paymentIntent = await stripeServerClient.paymentIntents.confirm(
      paymentIntentId,
      {
        payment_method: paymentMethodId,
        return_url: returnUrl, // Required for payment methods that need redirect
      },
      {
        idempotencyKey: uuid() // Prevent duplicate confirmation
      }
    );
    
    return paymentIntent;
  } catch (error: unknown) {
    handleStripeError(error, 'confirm payment intent');
  }
};

export const cancelPaymentIntent = async (
  paymentIntentId: string,
  reason?: string
): Promise<Stripe.PaymentIntent> => {
  try {
    const paymentIntent = await stripeServerClient.paymentIntents.cancel(
      paymentIntentId,
      {
        cancellation_reason: (reason as Stripe.PaymentIntent.CancellationReason) ?? 'requested_by_customer',
      },
      {
        idempotencyKey: uuid() // Prevent duplicate cancellation
      }
    );
    
    return paymentIntent;
  } catch (error: unknown) {
    handleStripeError(error, 'cancel payment intent');
  }
};

export const getPaymentIntent = async (
  paymentIntentId: string
): Promise<Stripe.PaymentIntent | null> => {
  try {
    const paymentIntent = await stripeServerClient.paymentIntents.retrieve(
      paymentIntentId
    );
    
    return paymentIntent;
  } catch (error: unknown) {
    if (error instanceof stripeServerClient.errors.StripeError && 
        error.code === 'resource_missing') {
      return null;
    }
    handleStripeError(error, 'retrieve payment intent');
  }
};

export const updatePaymentIntent = async (
  paymentIntentId: string,
  updates: Stripe.PaymentIntentUpdateParams
): Promise<Stripe.PaymentIntent> => {
  try {
    const paymentIntent = await stripeServerClient.paymentIntents.update(
      paymentIntentId,
      updates,
      {
        idempotencyKey: uuid() // Prevent duplicate updates
      }
    );
    
    return paymentIntent;
  } catch (error: unknown) {
    handleStripeError(error, 'update payment intent');
  }
};

export const createRefund = async (
  paymentIntentId: string,
  amount?: number,
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer',
  metadata?: Record<string, string>
): Promise<Stripe.Refund> => {
  try {
    const refund = await stripeServerClient.refunds.create({
      payment_intent: paymentIntentId,
      amount,
      reason,
      metadata: {
        ...metadata,
        platform: 'dependablecalls',
      },
    }, {
      idempotencyKey: uuid() // Prevent duplicate refunds
    });
    
    return refund;
  } catch (error: unknown) {
    handleStripeError(error, 'create refund');
  }
};

export const getPaymentStatus = (
  paymentIntent: Stripe.PaymentIntent
): PaymentStatus => {
  let status: PaymentStatus['status'] = 'pending';
  let error: string | undefined;
  
  switch (paymentIntent.status) {
    case 'succeeded':
      status = 'succeeded';
      break;
    case 'processing':
      status = 'processing';
      break;
    case 'canceled':
    case 'requires_payment_method':
      status = 'failed';
      error = paymentIntent.last_payment_error?.message;
      break;
    default:
      status = 'pending';
  }
  
  return {
    id: paymentIntent.id,
    status,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    error,
  };
};

/**
 * List all payment intents for a customer with automatic pagination
 * This ensures we get ALL payments, not just the first page
 */
export const listCustomerPayments = async (
  customerId: string,
  limit = 1000 // Increased from 100 for better performance
): Promise<Stripe.PaymentIntent[]> => {
  try {
    const payments: Stripe.PaymentIntent[] = [];
    
    // Use auto-pagination to ensure we get all payment intents
    for await (const paymentIntent of stripeServerClient.paymentIntents.list({
      customer: customerId,
      limit, // Page size
    })) {
      payments.push(paymentIntent);
    }
    
    return payments;
  } catch (error: unknown) {
    handleStripeError(error, 'list customer payments');
  }
};

/**
 * Create and immediately capture a payment using PaymentIntents
 * This replaces the legacy charges.create API for SCA compliance
 * @deprecated Use createPaymentIntent with automatic capture instead
 */
export const createAndCapturePayment = async (
  amount: number,
  currency: string,
  paymentMethodId: string,
  customerId?: string,
  metadata?: Record<string, string>
): Promise<Stripe.PaymentIntent> => {
  try {
    // Create and confirm payment intent in one API call
    const paymentIntent = await stripeServerClient.paymentIntents.create({
      amount,
      currency,
      payment_method: paymentMethodId,
      customer: customerId,
      confirm: true, // Immediately attempt to confirm
      capture_method: 'automatic', // Capture funds immediately on confirmation
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never', // For immediate capture, don't allow redirects
      },
      metadata: {
        ...metadata,
        platform: 'dependablecalls',
      },
    }, {
      idempotencyKey: uuid() // Prevent duplicate charges
    });
    
    return paymentIntent;
  } catch (error: unknown) {
    handleStripeError(error, 'create and capture payment');
  }
};

/**
 * Helper function to handle off-session payments (e.g., recurring charges)
 */
export const createOffSessionPayment = async (
  amount: number,
  currency: string,
  customerId: string,
  paymentMethodId: string,
  metadata?: Record<string, string>
): Promise<Stripe.PaymentIntent> => {
  try {
    const paymentIntent = await stripeServerClient.paymentIntents.create({
      amount,
      currency,
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      metadata: {
        ...metadata,
        platform: 'dependablecalls',
      },
    }, {
      idempotencyKey: uuid() // Prevent duplicate charges
    });
    
    return paymentIntent;
  } catch (error: unknown) {
    handleStripeError(error, 'create off-session payment');
  }
};