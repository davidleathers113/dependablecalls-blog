import { stripeServerClient } from './client';
import type { CreateConnectedAccountParams, ConnectedAccountStatus, PayoutSchedule } from './types';
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
    
    throw new Error(`Stripe ${context} failed. Please retry or contact support.`);
  }
  
  console.error(`${context} unexpected error`, err);
  throw new Error('Internal server error. Please try again later.');
}

export const createConnectedAccount = async (
  params: CreateConnectedAccountParams
): Promise<Stripe.Account> => {
  try {
    const account = await stripeServerClient.accounts.create({
      type: 'express',
      email: params.email,
      country: params.country ?? 'US',
      business_type: params.businessType ?? 'individual',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      settings: {
        payouts: {
          schedule: {
            delay_days: 7,
            interval: 'weekly',
            weekly_anchor: 'friday',
          },
        },
      },
      metadata: {
        ...params.metadata,
        platform: 'dependablecalls',
      },
    }, {
      idempotencyKey: uuid() // Prevent duplicate account creation
    });
    
    return account;
  } catch (error: unknown) {
    handleStripeError(error, 'create connected account');
  }
};

export const createAccountLink = async (
  accountId: string,
  refreshUrl: string,
  returnUrl: string,
  type: 'account_onboarding' | 'account_update' = 'account_onboarding'
): Promise<Stripe.AccountLink> => {
  try {
    const accountLink = await stripeServerClient.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type,
    }, {
      idempotencyKey: uuid() // Prevent duplicate link creation
    });
    
    return accountLink;
  } catch (error: unknown) {
    handleStripeError(error, 'create account link');
  }
};

export const getConnectedAccount = async (
  accountId: string
): Promise<Stripe.Account | null> => {
  try {
    const account = await stripeServerClient.accounts.retrieve(accountId);
    return account;
  } catch (error: unknown) {
    if (error instanceof stripeServerClient.errors.StripeError && 
        error.code === 'resource_missing') {
      return null;
    }
    handleStripeError(error, 'retrieve connected account');
  }
};

export const updateConnectedAccount = async (
  accountId: string,
  updates: Stripe.AccountUpdateParams
): Promise<Stripe.Account> => {
  try {
    const account = await stripeServerClient.accounts.update(
      accountId,
      updates
    );
    
    return account;
  } catch (error: unknown) {
    handleStripeError(error, 'update connected account');
  }
};

export const deleteConnectedAccount = async (
  accountId: string
): Promise<boolean> => {
  try {
    const result = await stripeServerClient.accounts.del(accountId);
    return result.deleted;
  } catch (error: unknown) {
    handleStripeError(error, 'delete connected account');
  }
};

export const getAccountStatus = async (
  accountId: string
): Promise<ConnectedAccountStatus> => {
  try {
    const account = await stripeServerClient.accounts.retrieve(accountId);
    
    return {
      id: account.id,
      chargesEnabled: account.charges_enabled ?? false,
      payoutsEnabled: account.payouts_enabled ?? false,
      detailsSubmitted: account.details_submitted ?? false,
      requirementsCurrentlyDue: account.requirements?.currently_due ?? [],
    };
  } catch (error: unknown) {
    handleStripeError(error, 'get account status');
  }
};

export const updatePayoutSchedule = async (
  accountId: string,
  schedule: PayoutSchedule
): Promise<Stripe.Account> => {
  try {
    const account = await stripeServerClient.accounts.update(accountId, {
      settings: {
        payouts: {
          schedule: {
            delay_days: schedule.delayDays,
            interval: schedule.interval,
            ...(schedule.weeklyAnchor && { weekly_anchor: schedule.weeklyAnchor }),
          },
        },
      },
    });
    
    return account;
  } catch (error: unknown) {
    handleStripeError(error, 'update payout schedule');
  }
};

export const createLoginLink = async (
  accountId: string
): Promise<Stripe.LoginLink> => {
  try {
    const loginLink = await stripeServerClient.accounts.createLoginLink(
      accountId
    );
    
    return loginLink;
  } catch (error: unknown) {
    handleStripeError(error, 'create login link');
  }
};

/**
 * List all transfers for an account with automatic pagination
 * This ensures we get ALL transfers, not just the first page
 */
export const listAccountTransfers = async (
  accountId: string,
  limit = 1000 // Increased from 100 for better performance
): Promise<Stripe.Transfer[]> => {
  try {
    const transfers: Stripe.Transfer[] = [];
    
    // Use auto-pagination to ensure we get all transfers
    for await (const transfer of stripeServerClient.transfers.list({
      destination: accountId,
      limit, // Page size
    })) {
      transfers.push(transfer);
    }
    
    return transfers;
  } catch (error: unknown) {
    handleStripeError(error, 'list account transfers');
  }
};

export const getAccountBalance = async (
  accountId: string
): Promise<Stripe.Balance> => {
  try {
    const balance = await stripeServerClient.balance.retrieve({
      stripeAccount: accountId,
    });
    
    return balance;
  } catch (error: unknown) {
    handleStripeError(error, 'retrieve account balance');
  }
};

/**
 * Create a transfer to a connected account with idempotency
 * Useful for payouts and platform fees
 */
export const createTransfer = async (
  accountId: string,
  amount: number,
  currency = 'usd',
  description?: string,
  metadata?: Record<string, string>
): Promise<Stripe.Transfer> => {
  try {
    const transfer = await stripeServerClient.transfers.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      destination: accountId,
      description,
      metadata: {
        ...metadata,
        platform: 'dependablecalls',
      },
    }, {
      idempotencyKey: uuid() // Prevent duplicate transfers
    });
    
    return transfer;
  } catch (error: unknown) {
    handleStripeError(error, 'create transfer');
  }
};

/**
 * Create a payout for a connected account with idempotency
 */
export const createPayout = async (
  accountId: string,
  amount: number,
  currency = 'usd',
  description?: string,
  metadata?: Record<string, string>
): Promise<Stripe.Payout> => {
  try {
    const payout = await stripeServerClient.payouts.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      description,
      metadata: {
        ...metadata,
        platform: 'dependablecalls',
      },
    }, {
      stripeAccount: accountId,
      idempotencyKey: uuid() // Prevent duplicate payouts
    });
    
    return payout;
  } catch (error: unknown) {
    handleStripeError(error, 'create payout');
  }
};