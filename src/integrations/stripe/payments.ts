import { stripeServerClient } from './client';
import type { CreatePaymentIntentParams, PaymentStatus } from './types';
import type Stripe from 'stripe';

export const createPaymentIntent = async (
  params: CreatePaymentIntentParams
): Promise<Stripe.PaymentIntent> => {
  try {
    const paymentIntent = await stripeServerClient.paymentIntents.create({
      amount: params.amount,
      currency: params.currency,
      customer: params.customerId,
      payment_method_types: params.paymentMethodTypes || ['card', 'us_bank_account'],
      metadata: {
        ...params.metadata,
        platform: 'dependablecalls',
      },
      setup_future_usage: 'off_session',
      automatic_payment_methods: {
        enabled: false,
      },
    });
    
    return paymentIntent;
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw new Error(`Failed to create payment intent: ${error.message}`);
  }
};

export const confirmPaymentIntent = async (
  paymentIntentId: string,
  paymentMethodId: string
): Promise<Stripe.PaymentIntent> => {
  try {
    const paymentIntent = await stripeServerClient.paymentIntents.confirm(
      paymentIntentId,
      {
        payment_method: paymentMethodId,
      }
    );
    
    return paymentIntent;
  } catch (error) {
    console.error('Error confirming payment intent:', error);
    throw new Error(`Failed to confirm payment intent: ${error.message}`);
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
        cancellation_reason: reason as any || 'requested_by_customer',
      }
    );
    
    return paymentIntent;
  } catch (error) {
    console.error('Error canceling payment intent:', error);
    throw new Error(`Failed to cancel payment intent: ${error.message}`);
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
  } catch (error) {
    if (error.code === 'resource_missing') {
      return null;
    }
    console.error('Error retrieving payment intent:', error);
    throw new Error(`Failed to retrieve payment intent: ${error.message}`);
  }
};

export const updatePaymentIntent = async (
  paymentIntentId: string,
  updates: Stripe.PaymentIntentUpdateParams
): Promise<Stripe.PaymentIntent> => {
  try {
    const paymentIntent = await stripeServerClient.paymentIntents.update(
      paymentIntentId,
      updates
    );
    
    return paymentIntent;
  } catch (error) {
    console.error('Error updating payment intent:', error);
    throw new Error(`Failed to update payment intent: ${error.message}`);
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
    });
    
    return refund;
  } catch (error) {
    console.error('Error creating refund:', error);
    throw new Error(`Failed to create refund: ${error.message}`);
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

export const listCustomerPayments = async (
  customerId: string,
  limit: number = 100
): Promise<Stripe.PaymentIntent[]> => {
  try {
    const paymentIntents = await stripeServerClient.paymentIntents.list({
      customer: customerId,
      limit,
    });
    
    return paymentIntents.data;
  } catch (error) {
    console.error('Error listing customer payments:', error);
    throw new Error(`Failed to list payments: ${error.message}`);
  }
};

export const createCharge = async (
  amount: number,
  currency: string,
  source: string,
  metadata: Record<string, string>
): Promise<Stripe.Charge> => {
  try {
    const charge = await stripeServerClient.charges.create({
      amount,
      currency,
      source,
      metadata: {
        ...metadata,
        platform: 'dependablecalls',
      },
    });
    
    return charge;
  } catch (error) {
    console.error('Error creating charge:', error);
    throw new Error(`Failed to create charge: ${error.message}`);
  }
};