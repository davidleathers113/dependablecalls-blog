# Stripe Payment Integration

# Integration Structure  
- `client.ts` - Stripe client configuration
- `payments.ts` - Payment processing
- `subscriptions.ts` - Subscription management
- `webhooks.ts` - Webhook handlers
- `types.ts` - Stripe type definitions

# Client Configuration
```tsx
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
});

export const stripePublishableKey = process.env.VITE_STRIPE_PUBLIC_KEY!;

// Client-side Stripe instance
export const getStripeInstance = async () => {
  const { loadStripe } = await import('@stripe/stripe-js');
  return loadStripe(stripePublishableKey);
};
```

# Payment Processing
```tsx
export class PaymentService {
  async createPaymentIntent(params: PaymentIntentParams): Promise<Stripe.PaymentIntent> {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(params.amount * 100), // Convert to cents
      currency: params.currency || 'usd',
      customer: params.customerId,
      metadata: {
        user_id: params.userId,
        campaign_id: params.campaignId,
        ...params.metadata,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });
    
    // Log payment intent creation
    await this.logPaymentEvent('payment_intent_created', {
      payment_intent_id: paymentIntent.id,
      amount: params.amount,
      user_id: params.userId,
    });
    
    return paymentIntent;
  }
  
  async confirmPayment(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);
    
    if (paymentIntent.status === 'succeeded') {
      await this.handleSuccessfulPayment(paymentIntent);
    }
    
    return paymentIntent;
  }
  
  private async handleSuccessfulPayment(paymentIntent: Stripe.PaymentIntent) {
    const { metadata } = paymentIntent;
    
    // Record transaction in database
    await supabase.from('transactions').insert({
      stripe_payment_intent_id: paymentIntent.id,
      user_id: metadata.user_id,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      status: 'succeeded',
      type: 'charge',
    });
    
    // Update campaign budget if applicable
    if (metadata.campaign_id) {
      await this.updateCampaignBudget(metadata.campaign_id, paymentIntent.amount / 100);
    }
  }
}
```

# Subscription Management
```tsx
export class SubscriptionService {
  async createSubscription(params: CreateSubscriptionParams): Promise<Stripe.Subscription> {
    const subscription = await stripe.subscriptions.create({
      customer: params.customerId,
      items: [{
        price: params.priceId,
        quantity: params.quantity || 1,
      }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        user_id: params.userId,
        plan_type: params.planType,
      },
    });
    
    return subscription;
  }
  
  async updateSubscription(subscriptionId: string, updates: UpdateSubscriptionParams) {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      items: updates.items,
      proration_behavior: 'always_invoice',
      metadata: updates.metadata,
    });
    
    // Update local subscription data
    await supabase
      .from('user_subscriptions')
      .update({
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        current_period_end: new Date(subscription.current_period_end * 1000),
      })
      .eq('user_id', updates.userId);
      
    return subscription;
  }
  
  async cancelSubscription(subscriptionId: string, immediately = false) {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: !immediately,
      ...(immediately && { cancel_at: Math.floor(Date.now() / 1000) }),
    });
    
    return subscription;
  }
}
```

# Webhook Handlers
```tsx
export async function handleStripeWebhook(
  body: string,
  signature: string
): Promise<{ success: boolean; error?: string }> {
  let event: Stripe.Event;
  
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return { success: false, error: 'Invalid signature' };
  }
  
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
        
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
        
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
        
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
        
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    return { success: true };
  } catch (error) {
    console.error(`Error processing webhook ${event.type}:`, error);
    return { success: false, error: error.message };
  }
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const { metadata } = paymentIntent;
  
  // Update transaction status
  await supabase
    .from('transactions')
    .update({ status: 'succeeded' })
    .eq('stripe_payment_intent_id', paymentIntent.id);
  
  // Send confirmation email
  await emailService.sendPaymentConfirmation({
    userId: metadata.user_id,
    amount: paymentIntent.amount / 100,
    currency: paymentIntent.currency,
  });
  
  // Update user credits or campaign budget
  if (metadata.campaign_id) {
    await campaignService.addBudget(metadata.campaign_id, paymentIntent.amount / 100);
  }
}
```

# Payout Processing
```tsx
export class PayoutService {
  async createPayout(params: PayoutParams): Promise<Stripe.Transfer> {
    // Create Stripe Connect transfer
    const transfer = await stripe.transfers.create({
      amount: Math.round(params.amount * 100),
      currency: params.currency || 'usd',
      destination: params.stripeAccountId,
      metadata: {
        user_id: params.userId,
        payout_period: params.payoutPeriod,
      },
    });
    
    // Record payout in database
    await supabase.from('payouts').insert({
      user_id: params.userId,
      stripe_transfer_id: transfer.id,
      amount: params.amount,
      currency: params.currency,
      status: 'processing',
      payout_period: params.payoutPeriod,
    });
    
    return transfer;
  }
  
  async processScheduledPayouts() {
    // Get suppliers eligible for payout
    const { data: suppliers } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'supplier')
      .eq('payout_enabled', true);
    
    for (const supplier of suppliers) {
      const earnings = await this.calculateSupplierEarnings(supplier.id);
      
      if (earnings.amount >= MINIMUM_PAYOUT_AMOUNT) {
        await this.createPayout({
          userId: supplier.id,
          amount: earnings.amount,
          stripeAccountId: supplier.stripe_account_id,
          payoutPeriod: getCurrentPayoutPeriod(),
        });
      }
    }
  }
}
```

# Customer Management
```tsx
export class CustomerService {
  async createCustomer(user: User): Promise<Stripe.Customer> {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.profile?.company || `${user.first_name} ${user.last_name}`,
      metadata: {
        user_id: user.id,
        role: user.role,
      },
    });
    
    // Store Stripe customer ID
    await supabase
      .from('users')
      .update({ stripe_customer_id: customer.id })
      .eq('id', user.id);
    
    return customer;
  }
  
  async updateCustomer(customerId: string, updates: CustomerUpdateParams) {
    return stripe.customers.update(customerId, {
      email: updates.email,
      name: updates.name,
      phone: updates.phone,
      address: updates.address,
    });
  }
}
```

# Error Handling
```tsx
export function handleStripeError(error: Stripe.StripeError): string {
  switch (error.code) {
    case 'card_declined':
      return 'Your card was declined. Please try a different payment method.';
    case 'insufficient_funds':
      return 'Insufficient funds on your card. Please try a different payment method.';
    case 'expired_card':
      return 'Your card has expired. Please use a different payment method.';
    case 'incorrect_cvc':
      return 'The security code you entered is incorrect.';
    case 'payment_intent_authentication_failure':
      return 'Payment authentication failed. Please try again.';
    default:
      return 'Payment processing failed. Please try again.';
  }
}
```

# Testing Helpers
```tsx
export const TEST_PAYMENT_METHODS = {
  visa: 'pm_card_visa',
  visaDebit: 'pm_card_visa_debit',
  mastercard: 'pm_card_mastercard',
  amex: 'pm_card_amex',
  declined: 'pm_card_declined',
  insufficientFunds: 'pm_card_chargeDeclinedInsufficientFunds',
  fraudulent: 'pm_card_chargeDeclinedFraudulent',
};

export async function createTestPaymentIntent(amount: number) {
  return stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: 'usd',
    payment_method: TEST_PAYMENT_METHODS.visa,
    confirm: true,
  });
}
```

# CRITICAL RULES
- NO regex in Stripe integration
- NO any types in Stripe interfaces
- ALWAYS verify webhook signatures
- ALWAYS handle Stripe errors gracefully
- SECURE API key management
- NEVER log sensitive payment data
- IMPLEMENT proper retry logic
- TEST with Stripe test environment
- COMPLY with PCI DSS requirements
- HANDLE idempotency for payments