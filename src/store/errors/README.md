# DCE Error Management System

A comprehensive, type-safe error handling and recovery system for Zustand stores in the DCE platform. Provides centralized error management, automatic recovery strategies, exponential backoff retry logic, and integrated monitoring/reporting.

## Features

- **Typed Error Hierarchy**: Comprehensive error classes with specific recovery strategies
- **Centralized Middleware**: Automatic error interception and handling in Zustand stores
- **Recovery Strategies**: Intelligent error recovery with exponential backoff and circuit breakers
- **Error Reporting**: Integration with monitoring systems (Sentry, webhooks, analytics)
- **State Management**: Automatic state rollback on critical errors
- **Development Tools**: Rich debugging and logging capabilities

## Quick Start

### Basic Store Integration

```typescript
import { create } from 'zustand'
import { createErrorHandlingMiddleware, createError } from '@/store/errors'

interface MyState {
  data: unknown[]
  loading: boolean
  fetchData: () => Promise<void>
}

const useMyStore = create<MyState>()(
  createErrorHandlingMiddleware({
    storeName: 'my-store',
    enableRecovery: true,
    enableReporting: true,
  })(
    (set, get) => ({
      data: [],
      loading: false,
      
      fetchData: async () => {
        set({ loading: true })
        
        try {
          const response = await fetch('/api/data')
          
          if (!response.ok) {
            throw createError.network(
              'Failed to fetch data',
              response.status,
              '/api/data',
              'GET'
            )
          }
          
          const data = await response.json()
          set({ data, loading: false })
        } catch (error) {
          set({ loading: false })
          throw error // Error middleware will handle this
        }
      },
    })
  )
)
```

### Using Error Management in Components

```typescript
import { useMyStore } from './store'
import { useErrorHandling } from '@/store/errors'

function MyComponent() {
  const { fetchData } = useMyStore()
  const { hasError, lastError, retry, clearError } = useErrorHandling('my-store')
  
  const handleFetch = async () => {
    try {
      await fetchData()
    } catch (error) {
      // Error is automatically handled by the system
      console.log('Fetch failed, but error system is handling it')
    }
  }
  
  return (
    <div>
      <button onClick={handleFetch}>Fetch Data</button>
      
      {hasError && lastError && (
        <div className="error-banner">
          <p>Error: {lastError.message}</p>
          {lastError.retryable && (
            <button onClick={retry}>Retry</button>
          )}
          <button onClick={clearError}>Dismiss</button>
        </div>
      )}
    </div>
  )
}
```

## Error Types

### Authentication & Authorization

```typescript
// Authentication errors (sign in, session, etc.)
throw createError.authentication('Invalid credentials')
throw createError.authentication('Session expired')

// Authorization errors (permissions, roles)
throw createError.authorization('Access denied', 'admin', 'user')
```

### Network & API

```typescript
// Network errors with automatic retry
throw createError.network('Connection failed', 500, '/api/endpoint', 'POST')

// API-specific errors with error codes
throw createError.api('Validation failed', 400, 'VALIDATION_ERROR', { field: 'email' })
```

### Validation & Data

```typescript
// Field validation errors
throw createError.validation('Email is required', 'email', 'required', '')

// Data processing errors
throw createError.data('Invalid JSON format', 'user', 'parse')
```

### State Management

```typescript
// State corruption or invalid transitions
throw createError.state('Invalid state transition', 'authStore', 'signIn', stateSnapshot)

// Concurrent modification errors
throw createError.concurrency('Concurrent update detected', 'campaignStore', 'update', 'delete')
```

### Business Logic

```typescript
// Business rule violations
throw createError.business('Budget exceeds limit', 'max_budget', 'campaign', 'camp_123')
```

### Configuration

```typescript
// Missing or invalid configuration
throw createError.configuration('API key not found', 'API_KEY', 'string')
```

## Recovery Strategies

The system provides automatic recovery strategies based on error types:

### Retry Strategy
```typescript
const networkError = createError.network('Server error', 500)
// Automatically retries with exponential backoff
// Strategy: { type: 'retry', action: 'exponentialBackoff', maxAttempts: 3 }
```

### Fallback Strategy
```typescript
const dataError = createError.data('Processing failed')
// Shows error message and provides fallback
// Strategy: { type: 'fallback', action: 'showErrorMessage' }
```

### Redirect Strategy
```typescript
const authError = createError.authentication('Session expired')
// Redirects to login page
// Strategy: { type: 'redirect', action: 'signOut', fallbackUrl: '/login' }
```

### State Recovery Strategy
```typescript
const stateError = createError.state('State corruption', 'authStore')
// Resets store to safe state
// Strategy: { type: 'state', action: 'resetStore', storeName: 'authStore' }
```

## Configuration

### Error Handling Middleware

```typescript
const errorConfig = {
  storeName: 'my-store',
  enableRecovery: true,
  enableReporting: true,
  maxRecoveryAttempts: 3,
  recoveryTimeout: 30000,
  rollbackStrategy: {
    enabled: true,
    preserveInitialState: true,
    rollbackKeys: ['user', 'session'],
    skipForErrorTypes: ['ValidationError'],
  },
  development: {
    logErrors: true,
    logRecovery: true,
    breakOnErrors: false,
  },
}
```

### Error Reporting

```typescript
const reportingConfig = {
  enabled: true,
  sentryDsn: 'https://sentry.dsn',
  sampleRate: 1.0,
  batchSize: 10,
  batchTimeout: 5000,
  endpoints: {
    webhook: 'https://api.example.com/errors',
    analytics: 'https://analytics.example.com/events',
  },
  filters: [
    {
      name: 'excludeNoisy',
      predicate: (error) => !error.message.includes('noise'),
    },
  ],
  transformers: [
    {
      name: 'addUserId',
      transform: (error, context) => ({
        context: { ...context, userId: getCurrentUserId() },
      }),
    },
  ],
}
```

## Advanced Usage

### Custom Error Types

```typescript
class PaymentError extends DCEError {
  constructor(message: string, public paymentId: string, options?: ErrorOptions) {
    super(message, {
      ...options,
      category: 'payment',
      severity: 'high',
      recoverable: true,
    })
  }

  protected getDefaultRecoveryStrategy(): RecoveryStrategy {
    return {
      type: 'fallback',
      action: 'retryPayment',
      message: 'Payment failed. Please try again.',
    }
  }
}
```

### Retryable Operations

```typescript
import { createRetryableOperation } from '@/store/errors'

const operation = createRetryableOperation(
  async () => {
    const response = await fetch('/api/critical-action')
    if (!response.ok) throw new Error('Request failed')
    return response.json()
  },
  { storeName: 'my-store', actionType: 'criticalAction' },
  {
    shouldRetry: (error, attempt) => attempt < 5,
    onRetry: (error, attempt) => console.log(`Retry ${attempt}: ${error.message}`),
    onSuccess: (result, attempts) => console.log(`Success after ${attempts} attempts`),
  }
)

const result = await recoveryManager.executeWithRetry(operation)
```

### Safe Async Wrappers

```typescript
import { createSafeAsync } from '@/store/errors'

const safeApiCall = createSafeAsync(
  async (userId: string) => {
    const response = await fetch(`/api/users/${userId}`)
    return response.json()
  },
  { storeName: 'user-store', actionType: 'fetchUser' }
)

// Returns null on error instead of throwing
const userData = await safeApiCall('123')
```

## Monitoring & Reporting

### Error Reports

```typescript
const reporter = new ErrorReporter(config)

// Generate comprehensive error report
const report = await reporter.generateReport({
  start: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
  end: Date.now(),
})

console.log({
  total: report.summary.total,
  byType: report.summary.byType,
  bySeverity: report.summary.bySeverity,
  trends: report.trends.topErrors,
  userImpact: report.userImpact.affectedUsers,
})
```

### Integration with External Services

#### Sentry
```typescript
// Automatically integrates if Sentry is available
window.Sentry = SentrySDK
```

#### Custom Webhooks
```typescript
// Errors are automatically batched and sent to configured endpoints
const config = {
  endpoints: {
    webhook: 'https://your-webhook.com/errors',
  },
}
```

#### Analytics
```typescript
// Track errors as analytics events
const config = {
  endpoints: {
    analytics: 'https://analytics.example.com/track',
  },
}
```

## Testing

The error management system includes comprehensive tests:

```bash
# Run error management tests
npm test src/store/errors

# Run specific test suites
npm test src/store/errors/__tests__/errorTypes.test.ts
npm test src/store/errors/__tests__/recovery.test.ts
npm test src/store/errors/__tests__/reporting.test.ts
```

### Testing with Error Management

```typescript
import { createError } from '@/store/errors'
import { renderHook, act } from '@testing-library/react'

test('should handle network errors', async () => {
  const { result } = renderHook(() => useMyStore())
  
  // Mock fetch to throw network error
  vi.mocked(fetch).mockRejectedValue(
    createError.network('Connection failed', 500)
  )
  
  await act(async () => {
    try {
      await result.current.fetchData()
    } catch (error) {
      expect(error).toBeInstanceOf(NetworkError)
    }
  })
  
  // Verify error state
  expect(result.current.hasError).toBe(true)
  expect(result.current.lastError?.retryable).toBe(true)
})
```

## Best Practices

### 1. Use Appropriate Error Types
```typescript
// ❌ Generic error
throw new Error('Something went wrong')

// ✅ Specific error type
throw createError.network('Connection timeout', 408, '/api/data', 'GET')
```

### 2. Provide Context
```typescript
// ❌ No context
throw createError.validation('Invalid input')

// ✅ Rich context
throw createError.validation('Email format invalid', 'email', 'format', inputValue)
```

### 3. Handle Errors at Store Level
```typescript
// ❌ Handle in component
const handleClick = async () => {
  try {
    await fetchData()
  } catch (error) {
    setError(error.message)
  }
}

// ✅ Let error middleware handle
const handleClick = async () => {
  await fetchData() // Error middleware handles failures
}
```

### 4. Use Safe Async for Non-Critical Operations
```typescript
// ❌ Let all errors bubble up
const loadOptionalData = async () => {
  return await fetch('/api/optional-data').then(r => r.json())
}

// ✅ Use safe wrapper for optional operations
const loadOptionalData = createSafeAsync(async () => {
  return await fetch('/api/optional-data').then(r => r.json())
})
```

### 5. Configure Recovery Appropriately
```typescript
// Configure different recovery strategies per store
const authErrorConfig = {
  storeName: 'auth-store',
  rollbackStrategy: {
    enabled: true,
    rollbackKeys: ['user', 'session'], // Only rollback auth state
  },
}

const uiErrorConfig = {
  storeName: 'ui-store',
  rollbackStrategy: {
    enabled: false, // UI errors don't need rollback
  },
}
```

## Performance Considerations

- **Batching**: Errors are batched for efficient reporting
- **Sampling**: Configure sample rates to reduce overhead
- **Circuit Breakers**: Prevent cascading failures
- **Caching**: Deduplication reduces duplicate processing
- **Lazy Loading**: Error reporting integrations are loaded on demand

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DCE Error Management                     │
├─────────────────────────┬───────────────────────────────────┤
│     Error Types         │         Middleware                │
│  ┌─────────────────┐    │  ┌─────────────────────────────┐  │
│  │ • Authentication│    │  │ • Error Interception        │  │
│  │ • Authorization │    │  │ • Recovery Execution        │  │
│  │ • Network       │    │  │ • State Rollback           │  │
│  │ • Validation    │    │  │ • Reporting Integration     │  │
│  │ • State         │    │  └─────────────────────────────┘  │
│  │ • Business      │    │                                   │
│  └─────────────────┘    │                                   │
├─────────────────────────┼───────────────────────────────────┤
│      Recovery           │         Reporting                 │
│  ┌─────────────────┐    │  ┌─────────────────────────────┐  │
│  │ • Retry Logic   │    │  │ • Error Aggregation         │  │
│  │ • Backoff       │    │  │ • Deduplication            │  │
│  │ • Circuit Breaker│   │  │ • Trend Analysis           │  │
│  │ • Strategies    │    │  │ • External Integration     │  │
│  └─────────────────┘    │  └─────────────────────────────┘  │
└─────────────────────────┴───────────────────────────────────┘
```

## Migration Guide

### From Basic Error Handling

```typescript
// Before: Basic try/catch
const fetchData = async () => {
  try {
    const response = await fetch('/api/data')
    const data = await response.json()
    set({ data })
  } catch (error) {
    console.error('Fetch failed:', error)
    set({ error: error.message })
  }
}

// After: Error management system
const fetchData = async () => {
  const response = await fetch('/api/data')
  
  if (!response.ok) {
    throw createError.network(
      'Failed to fetch data',
      response.status,
      '/api/data',
      'GET'
    )
  }
  
  const data = await response.json()
  set({ data })
  // Error middleware handles failures automatically
}
```

### Gradual Integration

1. **Start with one store**: Integrate error management into your most critical store
2. **Add error types**: Replace generic errors with typed errors
3. **Configure reporting**: Set up monitoring integration
4. **Expand coverage**: Apply to additional stores
5. **Optimize configuration**: Fine-tune recovery and reporting settings

## Troubleshooting

### Common Issues

#### Errors Not Being Caught
```typescript
// ❌ Async errors in event handlers
const handleClick = () => {
  fetchData() // Unhandled promise rejection
}

// ✅ Properly await async operations
const handleClick = async () => {
  try {
    await fetchData()
  } catch (error) {
    // Error middleware handles this
  }
}
```

#### Circuit Breaker Too Aggressive
```typescript
// Increase threshold if needed
const config = {
  circuitBreakerThreshold: 10, // Default: 5
  circuitBreakerRecoveryTime: 30000, // Default: 60000
}
```

#### Memory Usage from Error Caching
```typescript
// Reduce cache size if memory is a concern
const config = {
  maxCachedErrors: 100, // Default: 1000
}
```

### Debug Mode

```typescript
const config = {
  development: {
    logErrors: true,
    logRecovery: true,
    breakOnErrors: true, // Triggers debugger on errors
  },
}
```

## Contributing

When adding new error types or recovery strategies:

1. Extend the appropriate base class
2. Implement required methods
3. Add comprehensive tests
4. Update documentation
5. Consider backward compatibility

## License

Part of the DCE platform - internal use only.