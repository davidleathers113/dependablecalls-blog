# Stripe Integration

This directory contains the complete Stripe integration for the Dependable Call Exchange platform.

## Setup

1. Create a Stripe account at https://stripe.com
2. Get your API keys from the Stripe Dashboard
3. Copy `.env.example` to `.env` and fill in your Stripe keys:
   ```
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
   VITE_STRIPE_SECRET_KEY=sk_test_...
   VITE_STRIPE_WEBHOOK_SECRET=whsec_...
   VITE_STRIPE_CONNECT_CLIENT_ID=ca_...
   ```

## Architecture

### Core Modules

- **client.ts** - Stripe SDK initialization and configuration
- **types.ts** - TypeScript interfaces for Stripe operations
- **customers.ts** - Customer and payment method management
- **connected-accounts.ts** - Stripe Connect for supplier payouts
- **payments.ts** - Payment intent creation and management
- **subscriptions.ts** - Subscription handling for buyers
- **billing.ts** - Invoice and usage-based billing
- **payouts.ts** - Transfer and payout management for suppliers
- **webhooks.ts** - Webhook event handlers

### Key Features

1. **Buyer Payments**
   - Credit card and ACH support
   - Subscription management
   - Usage-based billing
   - Invoice generation

2. **Supplier Payouts**
   - Stripe Connect Express accounts
   - Automatic weekly payouts (Fridays)
   - Real-time balance tracking
   - Payout history

3. **Security**
   - Webhook signature verification
   - PCI compliance through Stripe
   - Secure payment method storage

## Usage Examples

### Creating a Customer

```typescript
import { createStripeCustomer } from '@/integrations/stripe';

const customer = await createStripeCustomer(email, {
  userId: user.id,
  userType: 'buyer',
  companyName: user.company_name,
});
```

### Creating a Payment Intent

```typescript
import { createPaymentIntent } from '@/integrations/stripe';

const paymentIntent = await createPaymentIntent({
  amount: 10000, // $100.00 in cents
  currency: 'usd',
  customerId: customer.id,
  metadata: {
    invoiceId: invoice.id,
    buyerId: buyer.id,
    billingPeriod: '2024-01',
  },
});
```

### Setting up Supplier Payouts

```typescript
import { createConnectedAccount, createAccountLink } from '@/integrations/stripe';

// Create connected account
const account = await createConnectedAccount({
  email: supplier.email,
  metadata: {
    supplierId: supplier.id,
    companyName: supplier.company_name,
  },
});

// Generate onboarding link
const accountLink = await createAccountLink(
  account.id,
  'https://app.dependablecalls.com/suppliers/onboarding/refresh',
  'https://app.dependablecalls.com/suppliers/onboarding/return'
);
```

### Processing Weekly Payouts

```typescript
import { scheduleWeeklyPayouts } from '@/integrations/stripe';

const suppliers = await getSupplierPayoutData();
const transfers = await scheduleWeeklyPayouts(suppliers);
```

## Webhook Configuration

1. Set up webhook endpoint in Stripe Dashboard
2. Point to: `https://yourdomain.com/.netlify/functions/stripe-webhook`
3. Select events:
   - payment_intent.succeeded
   - payment_intent.payment_failed
   - charge.dispute.created
   - account.updated
   - account.application.authorized
   - account.application.deauthorized
   - payout.created
   - payout.paid
   - payout.failed
   - transfer.created
   - transfer.reversed

## Testing

Use Stripe test cards:
- Success: 4242 4242 4242 4242
- Decline: 4000 0000 0000 0002
- 3D Secure: 4000 0000 0000 3220

Test bank accounts (ACH):
- Success: 000123456789
- Failure: 000111111113

## Error Handling

All functions include proper error handling and will throw descriptive errors. Wrap calls in try-catch blocks:

```typescript
try {
  const result = await stripeOperation();
} catch (error) {
  console.error('Stripe error:', error.message);
  // Handle error appropriately
}
```

## Security Considerations

1. Never expose secret keys in client-side code
2. Always verify webhook signatures
3. Use HTTPS in production
4. Implement rate limiting on payment endpoints
5. Log all payment-related activities
6. Monitor for suspicious patterns