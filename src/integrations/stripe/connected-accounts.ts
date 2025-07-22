import { stripeServerClient } from './client';
import type { CreateConnectedAccountParams, ConnectedAccountStatus, PayoutSchedule } from './types';
import type Stripe from 'stripe';

export const createConnectedAccount = async (
  params: CreateConnectedAccountParams
): Promise<Stripe.Account> => {
  try {
    const account = await stripeServerClient.accounts.create({
      type: 'express',
      email: params.email,
      country: params.country || 'US',
      business_type: params.businessType || 'individual',
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
    });
    
    return account;
  } catch (error) {
    console.error('Error creating connected account:', error);
    throw new Error(`Failed to create connected account: ${error.message}`);
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
    });
    
    return accountLink;
  } catch (error) {
    console.error('Error creating account link:', error);
    throw new Error(`Failed to create account link: ${error.message}`);
  }
};

export const getConnectedAccount = async (
  accountId: string
): Promise<Stripe.Account | null> => {
  try {
    const account = await stripeServerClient.accounts.retrieve(accountId);
    return account;
  } catch (error) {
    if (error.code === 'resource_missing') {
      return null;
    }
    console.error('Error retrieving connected account:', error);
    throw new Error(`Failed to retrieve account: ${error.message}`);
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
  } catch (error) {
    console.error('Error updating connected account:', error);
    throw new Error(`Failed to update account: ${error.message}`);
  }
};

export const deleteConnectedAccount = async (
  accountId: string
): Promise<boolean> => {
  try {
    const result = await stripeServerClient.accounts.del(accountId);
    return result.deleted;
  } catch (error) {
    console.error('Error deleting connected account:', error);
    throw new Error(`Failed to delete account: ${error.message}`);
  }
};

export const getAccountStatus = async (
  accountId: string
): Promise<ConnectedAccountStatus> => {
  try {
    const account = await stripeServerClient.accounts.retrieve(accountId);
    
    return {
      id: account.id,
      chargesEnabled: account.charges_enabled || false,
      payoutsEnabled: account.payouts_enabled || false,
      detailsSubmitted: account.details_submitted || false,
      requirementsCurrentlyDue: account.requirements?.currently_due || [],
    };
  } catch (error) {
    console.error('Error getting account status:', error);
    throw new Error(`Failed to get account status: ${error.message}`);
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
  } catch (error) {
    console.error('Error updating payout schedule:', error);
    throw new Error(`Failed to update payout schedule: ${error.message}`);
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
  } catch (error) {
    console.error('Error creating login link:', error);
    throw new Error(`Failed to create login link: ${error.message}`);
  }
};

export const listAccountTransfers = async (
  accountId: string,
  limit: number = 100
): Promise<Stripe.Transfer[]> => {
  try {
    const transfers = await stripeServerClient.transfers.list({
      destination: accountId,
      limit,
    });
    
    return transfers.data;
  } catch (error) {
    console.error('Error listing account transfers:', error);
    throw new Error(`Failed to list transfers: ${error.message}`);
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
  } catch (error) {
    console.error('Error retrieving account balance:', error);
    throw new Error(`Failed to retrieve balance: ${error.message}`);
  }
};