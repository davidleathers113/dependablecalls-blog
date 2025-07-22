import { stripeServerClient } from './client';
import type Stripe from 'stripe';

export interface CreateSubscriptionParams {
  customerId: string;
  priceId: string;
  metadata: {
    buyerId: string;
    planType: 'starter' | 'professional' | 'enterprise';
  };
  trialDays?: number;
  defaultPaymentMethod?: string;
}

export interface UsageRecord {
  subscriptionItemId: string;
  quantity: number;
  timestamp?: number;
  action?: 'set' | 'increment';
}

export const createSubscription = async (
  params: CreateSubscriptionParams
): Promise<Stripe.Subscription> => {
  try {
    const subscription = await stripeServerClient.subscriptions.create({
      customer: params.customerId,
      items: [{ price: params.priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        ...params.metadata,
        platform: 'dependablecalls',
      },
      ...(params.trialDays && { trial_period_days: params.trialDays }),
      ...(params.defaultPaymentMethod && {
        default_payment_method: params.defaultPaymentMethod,
      }),
    });
    
    return subscription;
  } catch (error) {
    console.error('Error creating subscription:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to create subscription: ${errorMessage}`);
  }
};

export const updateSubscription = async (
  subscriptionId: string,
  updates: Stripe.SubscriptionUpdateParams
): Promise<Stripe.Subscription> => {
  try {
    const subscription = await stripeServerClient.subscriptions.update(
      subscriptionId,
      updates
    );
    
    return subscription;
  } catch (error) {
    console.error('Error updating subscription:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to update subscription: ${errorMessage}`);
  }
};

export const cancelSubscription = async (
  subscriptionId: string,
  immediately: boolean = false
): Promise<Stripe.Subscription> => {
  try {
    if (immediately) {
      return await stripeServerClient.subscriptions.cancel(subscriptionId);
    } else {
      return await stripeServerClient.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    }
  } catch (error) {
    console.error('Error canceling subscription:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to cancel subscription: ${errorMessage}`);
  }
};

export const reactivateSubscription = async (
  subscriptionId: string
): Promise<Stripe.Subscription> => {
  try {
    const subscription = await stripeServerClient.subscriptions.update(
      subscriptionId,
      {
        cancel_at_period_end: false,
      }
    );
    
    return subscription;
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to reactivate subscription: ${errorMessage}`);
  }
};

export const getSubscription = async (
  subscriptionId: string
): Promise<Stripe.Subscription | null> => {
  try {
    const subscription = await stripeServerClient.subscriptions.retrieve(
      subscriptionId
    );
    
    return subscription;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'resource_missing') {
      return null;
    }
    console.error('Error retrieving subscription:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to retrieve subscription: ${errorMessage}`);
  }
};

export const listCustomerSubscriptions = async (
  customerId: string,
  status?: 'active' | 'canceled' | 'past_due' | 'trialing'
): Promise<Stripe.Subscription[]> => {
  try {
    const subscriptions = await stripeServerClient.subscriptions.list({
      customer: customerId,
      status,
    });
    
    return subscriptions.data;
  } catch (error) {
    console.error('Error listing subscriptions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to list subscriptions: ${errorMessage}`);
  }
};

export const createUsageRecord = async (
  record: UsageRecord
): Promise<Stripe.UsageRecord> => {
  try {
    const usageRecord = await stripeServerClient.subscriptionItems.createUsageRecord(
      record.subscriptionItemId,
      {
        quantity: record.quantity,
        timestamp: record.timestamp || Math.floor(Date.now() / 1000),
        action: record.action || 'increment',
      }
    );
    
    return usageRecord;
  } catch (error) {
    console.error('Error creating usage record:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to create usage record: ${errorMessage}`);
  }
};

export const listUsageRecords = async (
  subscriptionItemId: string,
  limit: number = 100
): Promise<Stripe.UsageRecordSummary[]> => {
  try {
    const usageRecords = await stripeServerClient.subscriptionItems.listUsageRecordSummaries(
      subscriptionItemId,
      { limit }
    );
    
    return usageRecords.data;
  } catch (error) {
    console.error('Error listing usage records:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to list usage records: ${errorMessage}`);
  }
};

export const updateSubscriptionItem = async (
  subscriptionId: string,
  itemId: string,
  newPriceId: string
): Promise<Stripe.Subscription> => {
  try {
    const subscription = await stripeServerClient.subscriptions.update(
      subscriptionId,
      {
        items: [
          {
            id: itemId,
            price: newPriceId,
          },
        ],
        proration_behavior: 'create_prorations',
      }
    );
    
    return subscription;
  } catch (error) {
    console.error('Error updating subscription item:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to update subscription item: ${errorMessage}`);
  }
};

export const createSubscriptionSchedule = async (
  customerId: string,
  phases: Stripe.SubscriptionScheduleCreateParams.Phase[]
): Promise<Stripe.SubscriptionSchedule> => {
  try {
    const schedule = await stripeServerClient.subscriptionSchedules.create({
      customer: customerId,
      start_date: 'now',
      phases,
    });
    
    return schedule;
  } catch (error) {
    console.error('Error creating subscription schedule:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to create subscription schedule: ${errorMessage}`);
  }
};