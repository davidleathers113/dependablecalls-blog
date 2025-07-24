// Example usage file for FallbackUI components
// This file demonstrates how to use the various error fallback components

import {
  ErrorFallback,
  NotFoundError,
  InternalServerError,
  UnauthorizedError,
  NetworkError,
  FormValidationError,
  FormSubmissionError,
  PaymentError,
  LoadingError,
  EmptyStateError,
  TimeoutError,
  SuccessState,
} from './FallbackUI'

// Usage Examples for each component

export function GenericErrorExample() {
  return (
    <ErrorFallback
      title="Something went wrong"
      message="We encountered an unexpected error. Our team has been notified and is working to resolve this issue."
      errorCode="ERR_GENERIC_001"
      showTechnicalDetails={true}
      details="TypeError: Cannot read property 'id' of undefined at UserService.getUser (user.service.ts:45)"
      onRetry={() => window.location.reload()}
      onGoHome={() => (window.location.href = '/')}
      onContactSupport={() => {
        window.location.href = '/contact'
      }}
      showHomeButton={true}
      showSupportButton={true}
    />
  )
}

export function RouteErrorExamples() {
  return (
    <div className="space-y-8">
      {/* 404 Error */}
      <NotFoundError onGoHome={() => (window.location.href = '/')} />

      {/* 500 Error */}
      <InternalServerError
        onRetry={() => window.location.reload()}
        onGoHome={() => (window.location.href = '/')}
      />

      {/* 401 Unauthorized */}
      <UnauthorizedError onGoHome={() => (window.location.href = '/')} />

      {/* Network Error */}
      <NetworkError onRetry={() => window.location.reload()} />
    </div>
  )
}

export function FormErrorExamples() {
  const validationErrors = {
    email: 'Please enter a valid email address',
    password: 'Password must be at least 8 characters long',
    confirmPassword: 'Passwords do not match',
  }

  return (
    <div className="space-y-6">
      {/* Form Validation Errors */}
      <FormValidationError errors={validationErrors} onRetry={() => console.log('Reset form')} />

      {/* Form Submission Error */}
      <FormSubmissionError
        message="Failed to create your account. Please try again."
        onRetry={() => console.log('Retry submission')}
      />
    </div>
  )
}

export function PaymentErrorExamples() {
  return (
    <div className="space-y-8">
      {/* Card Declined */}
      <PaymentError
        errorType="card_declined"
        onRetry={() => console.log('Retry payment')}
        onUpdatePaymentMethod={() => console.log('Update payment method')}
        onContactSupport={() => console.log('Contact support')}
      />

      {/* Insufficient Funds */}
      <PaymentError
        errorType="insufficient_funds"
        onUpdatePaymentMethod={() => console.log('Update payment method')}
        onContactSupport={() => console.log('Contact support')}
      />

      {/* Invalid Card */}
      <PaymentError
        errorType="invalid_card"
        onUpdatePaymentMethod={() => console.log('Update payment method')}
      />

      {/* Connection Error */}
      <PaymentError
        errorType="connection_error"
        onRetry={() => console.log('Retry payment')}
        onContactSupport={() => console.log('Contact support')}
      />
    </div>
  )
}

export function LoadingErrorExamples() {
  return (
    <div className="space-y-8">
      {/* Data Loading Error */}
      <LoadingError type="data" onRetry={() => console.log('Retry data fetch')} />

      {/* Page Loading Error */}
      <LoadingError
        type="page"
        onRetry={() => window.location.reload()}
        message="The dashboard failed to load completely."
      />

      {/* Component Loading Error */}
      <LoadingError type="component" onRetry={() => console.log('Retry component load')} />
    </div>
  )
}

export function EmptyStateExamples() {
  return (
    <div className="space-y-8">
      {/* No Data Found */}
      <EmptyStateError
        title="No campaigns found"
        message="You haven't created any campaigns yet. Create your first campaign to get started."
        actionLabel="Create Campaign"
        onAction={() => console.log('Create new campaign')}
      />

      {/* No Search Results */}
      <EmptyStateError
        title="No results found"
        message="We couldn't find any campaigns matching your search criteria. Try adjusting your filters."
        actionLabel="Clear Filters"
        onAction={() => console.log('Clear search filters')}
      />
    </div>
  )
}

export function TimeoutErrorExample() {
  return (
    <TimeoutError
      timeoutDuration={30}
      onRetry={() => console.log('Retry request')}
      onCancel={() => console.log('Cancel operation')}
    />
  )
}

export function SuccessStateExample() {
  return (
    <SuccessState
      title="Campaign Created Successfully"
      message="Your new campaign has been created and is now active. You can start receiving calls immediately."
      onPrimaryAction={() => console.log('View campaign')}
      onSecondaryAction={() => console.log('Create another')}
      primaryActionLabel="View Campaign"
      secondaryActionLabel="Create Another"
    />
  )
}

// Real-world usage patterns for DCE platform

export function DCECampaignErrorExample() {
  return (
    <ErrorFallback
      title="Campaign Load Failed"
      message="We couldn't load your campaign data. This might be due to a temporary network issue or server maintenance."
      errorCode="CAMPAIGN_001"
      onRetry={() => console.log('Retry loading campaigns')}
      onGoHome={() => (window.location.href = '/app/dashboard')}
      onContactSupport={() => {
        window.location.href = '/contact'
      }}
      showHomeButton={true}
      showSupportButton={true}
      retryLabel="Reload Campaigns"
    />
  )
}

export function DCECallTrackingErrorExample() {
  return (
    <LoadingError
      type="data"
      message="Real-time call tracking data is temporarily unavailable. Historical data may still be visible."
      onRetry={() => console.log('Retry call tracking connection')}
    />
  )
}

export function DCEPayoutErrorExample() {
  return (
    <PaymentError
      errorType="payment_failed"
      onRetry={() => console.log('Retry payout')}
      onUpdatePaymentMethod={() => console.log('Update bank account')}
      onContactSupport={() => (window.location.href = '/contact')}
    />
  )
}

export function DCEBuyerOnboardingErrorExample() {
  const onboardingErrors = {
    companyName: 'Company name is required',
    businessLicense: 'Please upload a valid business license',
    creditCheck: 'Credit verification failed. Please contact support.',
  }

  return (
    <FormValidationError
      errors={onboardingErrors}
      title="Onboarding Incomplete"
      message="Please complete the following requirements to activate your buyer account:"
      onRetry={() => console.log('Continue onboarding')}
    />
  )
}

// Example of using components with React Query
// eslint-disable-next-line react-refresh/only-export-components
export function withReactQueryExample() {
  // This would typically be used with React Query's error handling
  const exampleQueryError = new Error('Failed to fetch campaign data')

  const handleRetry = () => {
    // queryClient.refetchQueries(['campaigns'])
    console.log('Refetch campaigns')
  }

  if (exampleQueryError.message.includes('404')) {
    return <NotFoundError onGoHome={() => (window.location.href = '/')} />
  }

  if (exampleQueryError.message.includes('network')) {
    return <NetworkError onRetry={handleRetry} />
  }

  return (
    <ErrorFallback
      title="Data Loading Error"
      message="Unable to load the requested data. Please try again."
      onRetry={handleRetry}
      showSupportButton={true}
      onContactSupport={() => {
        window.location.href = '/contact'
      }}
    />
  )
}

// Example of using components with form libraries (React Hook Form)
// eslint-disable-next-line react-refresh/only-export-components
export function withFormLibraryExample() {
  // This would typically be used with React Hook Form's error handling
  const formErrors = {
    email: 'Invalid email format',
    phone: 'Please enter a valid phone number',
    campaign_name: 'Campaign name must be unique',
  }

  const handleFormSubmissionError = () => {
    console.log('Reset form and clear errors')
  }

  return (
    <div className="space-y-4">
      <FormValidationError errors={formErrors} onRetry={handleFormSubmissionError} />

      <FormSubmissionError
        message="Failed to save campaign settings. Please check your network connection and try again."
        onRetry={() => console.log('Resubmit form')}
      />
    </div>
  )
}
