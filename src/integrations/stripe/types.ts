import type Stripe from 'stripe';

export interface StripeCustomerData {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  metadata: {
    userId: string;
    userType: 'buyer' | 'supplier';
    companyName?: string;
  };
}

export interface CreateConnectedAccountParams {
  email: string;
  country?: string;
  businessType?: 'individual' | 'company';
  metadata: {
    supplierId: string;
    companyName?: string;
  };
}

export interface CreatePaymentIntentParams {
  amount: number;
  currency: string;
  customerId: string;
  metadata: {
    invoiceId: string;
    buyerId: string;
    billingPeriod: string;
  };
  paymentMethodTypes?: string[];
}

export interface CreateTransferParams {
  amount: number;
  currency: string;
  destination: string;
  metadata: {
    payoutId: string;
    supplierId: string;
    callCount: string;
    period: string;
  };
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
  created: number;
}

export interface PaymentStatus {
  id: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  amount: number;
  currency: string;
  error?: string;
}

export interface ConnectedAccountStatus {
  id: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsCurrentlyDue: string[];
}

export interface PayoutSchedule {
  delayDays: number;
  interval: 'daily' | 'weekly' | 'monthly' | 'manual';
  weeklyAnchor?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';
}

export type StripeEventType =
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'charge.dispute.created'
  | 'account.updated'
  | 'account.application.authorized'
  | 'account.application.deauthorized'
  | 'payout.created'
  | 'payout.paid'
  | 'payout.failed'
  | 'transfer.created'
  | 'transfer.reversed';

export interface WebhookHandlerMap {
  [key: string]: (event: Stripe.Event) => Promise<void>;
}