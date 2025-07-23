# Feature-Level Error Boundaries Usage Guide

This guide explains how to use the feature-level error boundaries in the DCE Platform.

## Overview

The DCE Platform implements specialized error boundaries for three critical feature types:

1. **Payment Processing** - Stripe integration errors
2. **Form Handling** - Validation and submission errors
3. **Real-time Features** - WebSocket and connection errors

## Payment Error Boundaries

### When to Use

Use `PaymentErrorBoundary` for any component that:

- Processes payments through Stripe
- Handles payment forms
- Manages payment methods
- Shows payment history

### Example Usage

```tsx
import { PaymentErrorBoundary } from '@/components/payments/PaymentErrorBoundary'
import PaymentForm from '@/components/payments/PaymentForm'

// Option 1: Using the pre-wrapped component
export default function CheckoutPage() {
  return (
    <PaymentForm // This already includes PaymentErrorBoundary
      amount={5000}
      currency="usd"
      description="Campaign budget top-up"
      metadata={{
        invoiceId: 'inv_123',
        buyerId: 'buyer_456',
        billingPeriod: '2024-01',
      }}
      onSuccess={(paymentIntentId) => {
        console.log('Payment successful:', paymentIntentId)
      }}
      onError={(error) => {
        console.error('Payment error:', error)
      }}
    />
  )
}

// Option 2: Wrapping your own payment component
import { PaymentErrorBoundary } from '@/components/payments/PaymentErrorBoundary'

function CustomPaymentFlow() {
  // Your payment logic here
}

export default function PaymentPage() {
  return (
    <PaymentErrorBoundary
      onRetry={() => window.location.reload()}
      onUpdatePaymentMethod={() => navigate('/settings/payment-methods')}
      onContactSupport={() => navigate('/support')}
      preserveFormData={true}
    >
      <CustomPaymentFlow />
    </PaymentErrorBoundary>
  )
}
```

### Error Types Handled

- Card declined
- Insufficient funds
- Invalid card information
- Network/connection errors
- Generic payment failures

## Form Error Boundaries

### When to Use

Use `FormErrorBoundary` for:

- Multi-step forms (campaign creation, onboarding)
- Complex forms with validation
- Forms that need draft saving
- Forms with network submission

### Example Usage

```tsx
import { FormErrorBoundary } from '@/components/forms/FormErrorBoundary'
import { z } from 'zod'

const campaignSchema = z.object({
  name: z.string().min(3),
  budget: z.number().positive(),
  // ... other fields
})

export default function CreateCampaignPage() {
  const [retryKey, setRetryKey] = useState(0)

  const handleSaveDraft = (data: Record<string, unknown>) => {
    localStorage.setItem('campaignDraft', JSON.stringify(data))
    toast.success('Draft saved!')
  }

  return (
    <FormErrorBoundary
      formName="createCampaign"
      enableDraftSaving={true}
      validationSchema={campaignSchema}
      onRetry={() => setRetryKey((prev) => prev + 1)}
      onSaveDraft={handleSaveDraft}
      onReset={() => {
        localStorage.removeItem('campaignDraft')
        setRetryKey((prev) => prev + 1)
      }}
    >
      <CampaignForm key={retryKey} />
    </FormErrorBoundary>
  )
}
```

### Features

- Automatic form data preservation
- Draft saving with 24-hour expiration
- Validation error display
- Retry with data restoration
- Network error handling

## Real-time Error Boundaries

### When to Use

Use `RealtimeErrorBoundary` for:

- WebSocket connections
- Real-time dashboards
- Live data feeds
- Webhook processors
- Call tracking features

### Example Usage

```tsx
import { RealtimeErrorBoundary } from '@/components/realtime/RealtimeErrorBoundary'
import { WebhookHandler } from '@/components/payments/WebhookHandler'

// Option 1: Using pre-wrapped components
export default function PaymentDashboard() {
  return (
    <>
      <WebhookHandler /> {/* Already includes RealtimeErrorBoundary */}
      <RealTimeDashboard userId={user.id} userType="buyer" />
    </>
  )
}

// Option 2: Wrapping custom real-time components
function LiveCallTracker() {
  // Your real-time logic here
}

export default function CallCenter() {
  return (
    <RealtimeErrorBoundary
      featureName="Call Tracking"
      enableAutoReconnect={true}
      maxReconnectAttempts={5}
      reconnectDelay={2000}
      onReconnect={async () => {
        // Custom reconnection logic
      }}
      onFallbackToPolling={() => {
        // Switch to polling mode
      }}
    >
      <LiveCallTracker />
    </RealtimeErrorBoundary>
  )
}
```

### Features

- Automatic reconnection with exponential backoff
- Connection status indicator
- Fallback to polling mode
- Preserves functionality during disconnections
- Shows real-time connection status

## Best Practices

### 1. Choose the Right Boundary

- Payment forms → `PaymentErrorBoundary`
- Complex forms → `FormErrorBoundary`
- Real-time features → `RealtimeErrorBoundary`
- Generic errors → Base `ErrorBoundary`

### 2. Provide Recovery Options

Always implement recovery handlers:

```tsx
<PaymentErrorBoundary
  onRetry={handleRetry}
  onUpdatePaymentMethod={handleUpdatePayment}
  onContactSupport={handleSupport}
/>
```

### 3. Preserve User Data

Enable data preservation for forms:

```tsx
<FormErrorBoundary enableDraftSaving={true} preserveFormData={true} />
```

### 4. Test Error Scenarios

Test each error boundary by simulating failures:

```tsx
// Simulate payment error
throw new Error('Your card was declined')

// Simulate network error
throw new Error('Network request failed')

// Simulate WebSocket disconnection
throw new Error('WebSocket connection lost')
```

### 5. Monitor Errors

All error boundaries integrate with Sentry:

```tsx
<PaymentErrorBoundary
  onError={(error, errorInfo) => {
    // Custom error tracking
    analytics.track('payment_error', {
      error: error.message,
      component: errorInfo.componentStack,
    })
  }}
/>
```

## Error Recovery Flows

### Payment Recovery

1. Error occurs → Show specific error message
2. User can: Retry, Update payment method, Contact support
3. Form data is preserved
4. Successful retry → Continue flow

### Form Recovery

1. Error occurs → Preserve form data
2. User can: Retry submission, Save as draft, Reset form
3. Draft saved → Can be restored within 24 hours
4. Successful retry → Form submitted

### Real-time Recovery

1. Connection lost → Show status indicator
2. Auto-reconnect attempts (5 times by default)
3. If reconnection fails → Offer fallback to polling
4. Connection restored → Resume real-time updates

## Testing Error Boundaries

### Manual Testing

1. Disconnect network to test connection errors
2. Submit invalid data to test validation errors
3. Use test card numbers to simulate payment failures
4. Kill WebSocket connections to test real-time errors

### Automated Testing

```tsx
import { render, screen } from '@testing-library/react'
import { PaymentErrorBoundary } from '@/components/payments/PaymentErrorBoundary'

test('handles payment errors gracefully', () => {
  const ThrowError = () => {
    throw new Error('Your card was declined')
  }

  render(
    <PaymentErrorBoundary>
      <ThrowError />
    </PaymentErrorBoundary>
  )

  expect(screen.getByText('Card Declined')).toBeInTheDocument()
  expect(screen.getByText('Update Payment Method')).toBeInTheDocument()
})
```

## Troubleshooting

### Payment Errors Not Caught

- Ensure error is thrown within the boundary
- Check that Stripe errors are properly propagated
- Verify error boundary is not nested incorrectly

### Form Data Not Preserved

- Enable `preserveFormData` prop
- Ensure forms have proper name attributes
- Check localStorage permissions

### Real-time Reconnection Failing

- Verify WebSocket URL is correct
- Check authentication tokens
- Monitor console for connection errors
- Ensure fallback mechanisms are implemented

## Migration Guide

### Updating Existing Components

Before:

```tsx
function PaymentForm() {
  try {
    // Payment logic
  } catch (error) {
    // Basic error handling
  }
}
```

After:

```tsx
import { withPaymentErrorBoundary } from '@/components/payments/PaymentErrorBoundary'

const PaymentForm = withPaymentErrorBoundary(
  function PaymentForm() {
    // Payment logic (no try/catch needed)
  },
  {
    preserveFormData: true,
    onRetry: () => window.location.reload(),
  }
)
```

This approach provides better error handling, user experience, and recovery options.
