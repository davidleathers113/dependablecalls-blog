# Service Layer Architecture Foundation

This directory contains the complete service layer abstraction foundation for the DCE platform, providing a structured migration path from store-based architecture to service-based architecture.

## 🏗️ Architecture Overview

The service layer foundation provides:
- **BaseService**: Common patterns for error handling, retry logic, caching, and monitoring
- **StoreError**: Enhanced error system with service-specific error codes for better telemetry
- **withAsyncAction**: Middleware helper to reduce boilerplate and standardize error handling
- **ServiceTelemetry**: Comprehensive performance monitoring and business metrics tracking
- **Migration Tools**: Utilities and patterns for gradual migration from stores to services

## 📁 Directory Structure

```
src/services/
├── README.md                           # This file - architecture overview
├── MIGRATION_GUIDE.md                  # Comprehensive migration documentation
├── base/
│   └── BaseService.ts                  # Abstract base class for all services
├── campaigns/
│   └── CampaignService.ts             # Example service implementation
├── blog/                              # Existing blog services
│   ├── analytics.service.ts
│   ├── author.service.ts
│   ├── comment.service.ts
│   ├── index.ts
│   ├── post.service.ts
│   └── taxonomy.service.ts
└── edge-functions.service.ts          # Edge function service

src/lib/
├── errors/
│   └── StoreError.ts                  # Enhanced error system with service codes
└── telemetry/
    └── ServiceTelemetry.ts            # Performance monitoring and metrics

src/store/utils/
└── withAsyncAction.ts                 # Async action middleware helper
```

## 🚀 Quick Start

### 1. Create a New Service

```typescript
// src/services/auth/AuthService.ts
import { BaseService } from '../base/BaseService'
import { createStoreError } from '../../lib/errors/StoreError'

export class AuthService extends BaseService {
  constructor() {
    super({
      name: 'auth',
      enableCaching: true,
      cacheTtl: 5 * 60 * 1000, // 5 minutes
      maxRetries: 3,
    })
  }

  async signIn(email: string, password: string) {
    return this.executeOperation({
      name: 'signIn',
      execute: async () => {
        // Business logic here
        const { data, error } = await this.supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          throw createStoreError.invalidCredentials('auth', 'signIn')
        }

        return data
      }
    })
  }
}

export const authService = AuthService.getInstance()
```

### 2. Integrate with Store Using withAsyncAction

```typescript
// src/store/authStore.ts
import { create } from 'zustand'
import { authService } from '../services/auth/AuthService'
import { withAsyncAction, type AsyncActionState } from './utils/withAsyncAction'

interface AuthState extends AsyncActionState {
  user: User | null
  session: Session | null
  signIn: (email: string, password: string) => Promise<void>
}

// Create async action
const signInAction = withAsyncAction({
  actionName: 'signIn',
  storeName: 'auth',
  serviceName: 'auth',
  enableLoadingState: true,
  enableRecovery: true,
  validateParams: (params: { email: string; password: string }) => {
    return params.email && params.password
  },
})(async (params: { email: string; password: string }) => {
  return authService.signIn(params.email, params.password)
})

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: false,
  error: null,
  actionHistory: [],

  signIn: signInAction.bind({ setState: set, getState: get }),
  
  clearError: () => set({ error: null }),
  retryLastAction: async () => { /* implement retry logic */ },
  getActionHistory: () => get().actionHistory,
  clearActionHistory: () => set({ actionHistory: [] }),
}))
```

### 3. Use in Components

```typescript
// src/components/auth/LoginForm.tsx
import { useAuthStore } from '../../store/authStore'
import { STORE_ERROR_CODES } from '../../lib/errors/StoreError'

export function LoginForm() {
  const { signIn, loading, error, clearError } = useAuthStore()

  const handleSubmit = async (email: string, password: string) => {
    try {
      await signIn(email, password)
      // Success - user is now signed in
    } catch (error) {
      // Error is already handled by withAsyncAction
      // Custom error handling can be done here
    }
  }

  const getErrorMessage = () => {
    if (!error) return null

    switch (error.code) {
      case STORE_ERROR_CODES.AUTH_INVALID_CREDENTIALS:
        return 'Invalid email or password. Please try again.'
      case STORE_ERROR_CODES.AUTH_SESSION_EXPIRED:
        return 'Your session has expired. Please sign in again.'
      case STORE_ERROR_CODES.SERVICE_RATE_LIMITED:
        return 'Too many attempts. Please wait before trying again.'
      default:
        return 'An error occurred. Please try again.'
    }
  }

  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      const formData = new FormData(e.currentTarget)
      handleSubmit(
        formData.get('email') as string,
        formData.get('password') as string
      )
    }}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      
      {error && (
        <div className="error">
          {getErrorMessage()}
          <button onClick={clearError}>Dismiss</button>
        </div>
      )}
      
      <button type="submit" disabled={loading}>
        {loading ? 'Signing In...' : 'Sign In'}
      </button>
    </form>
  )
}
```

## 🔧 Key Features

### BaseService Features
- **Error Handling**: Automatic error conversion to StoreError with proper codes
- **Retry Logic**: Exponential backoff with configurable retry policies  
- **Caching**: Request deduplication and response caching with TTL
- **Monitoring**: Performance metrics and health checks
- **Logging**: Structured logging with service context

### StoreError Features
- **Error Codes**: Standardized error codes for telemetry and i18n
- **Error Classification**: Automatic error type inference and severity assignment
- **Recovery Strategies**: Built-in recovery patterns for common error scenarios
- **Context Preservation**: Rich error context for debugging and monitoring

### withAsyncAction Features
- **Loading States**: Automatic loading state management
- **Error Handling**: Integration with StoreError system
- **Validation**: Parameter and result validation
- **Caching**: Operation-level caching with configurable TTL
- **Retry Logic**: Configurable retry policies for operations
- **Telemetry**: Automatic performance and error tracking

### ServiceTelemetry Features
- **Performance Metrics**: Response time, error rates, cache hit rates
- **Business Metrics**: Custom business event tracking
- **Health Monitoring**: Service health status and alerts
- **Error Tracking**: Detailed error classification and trending
- **Integration**: Works with Sentry, DataDog, and custom endpoints

## 📊 Monitoring & Observability

### Service Health Monitoring

```typescript
import { campaignService } from './services/campaigns/CampaignService'

// Get service health status
const health = await campaignService.healthCheck()
console.log(health) // { status: 'healthy', responseTime: 45, metrics: { ... } }

// Get performance metrics
const metrics = campaignService.getMetrics()
console.log(metrics) // { operationCount: 150, averageResponseTime: 89, errorRate: 0.02, ... }
```

### Telemetry Integration

```typescript
import { telemetryManager, trackBusinessMetric } from '../lib/telemetry/ServiceTelemetry'

// Track business events
trackBusinessMetric('campaign', 'campaign_created', {
  value: 1,
  userId: 'user-123',
  userType: 'supplier',
  metadata: { budget: 5000, targeting: 'geo' }
})

// Get system-wide health
const systemHealth = telemetryManager.getSystemHealth()
console.log(systemHealth) // { status: 'healthy', services: { campaign: { ... }, auth: { ... } } }
```

## 🎯 Migration Strategy

The migration is designed to be gradual and non-breaking:

### Phase 1: Foundation ✅ (Complete)
- [x] BaseService class with common patterns
- [x] StoreError system with service-specific codes
- [x] withAsyncAction middleware helper
- [x] Example CampaignService implementation
- [x] Comprehensive migration documentation

### Phase 2: Service Integration (Next Steps)
- [ ] Create service instances for each domain
- [ ] Implement thin wrapper methods proxying to stores
- [ ] Integrate withAsyncAction in existing stores
- [ ] Add service health checks and monitoring

### Phase 3: Business Logic Migration
- [ ] Move validation logic to services
- [ ] Implement business rules in services
- [ ] Add caching and optimization
- [ ] Update stores to call service methods

### Phase 4: Advanced Features
- [ ] Service-to-service communication
- [ ] Advanced caching strategies
- [ ] Event-driven architecture
- [ ] Comprehensive telemetry integration

## 📚 Documentation

- **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)**: Complete migration guide with examples
- **[BaseService.ts](./base/BaseService.ts)**: Documentation for base service patterns
- **[StoreError.ts](../lib/errors/StoreError.ts)**: Error system documentation and codes
- **[withAsyncAction.ts](../store/utils/withAsyncAction.ts)**: Async action middleware documentation

## 🛠️ Development Tools

### Service Testing

```typescript
// tests/services/CampaignService.test.ts
import { CampaignService } from '../services/campaigns/CampaignService'
import { STORE_ERROR_CODES } from '../lib/errors/StoreError'

describe('CampaignService', () => {
  let service: CampaignService

  beforeEach(() => {
    service = new CampaignService()
  })

  it('should create campaign successfully', async () => {
    const campaign = await service.createCampaign({
      name: 'Test Campaign',
      budget: 1000,
      bidPrice: 10,
      targeting: { geolocations: ['US'] },
      buyerId: 'buyer-123'
    }, 'supplier-123')

    expect(campaign).toMatchObject({
      name: 'Test Campaign',
      budget: 1000,
      status: 'draft'
    })
  })

  it('should handle validation errors', async () => {
    await expect(
      service.createCampaign({
        name: '', // Invalid
        budget: 1000,
        bidPrice: 10,
        targeting: { geolocations: ['US'] },
        buyerId: 'buyer-123'
      }, 'supplier-123')
    ).rejects.toHaveProperty('code', STORE_ERROR_CODES.DATA_VALIDATION_FAILED)
  })
})
```

### Store Integration Testing

```typescript
// tests/store/authStore.test.ts
import { renderHook, act } from '@testing-library/react'
import { useAuthStore } from '../store/authStore'

describe('useAuthStore', () => {
  it('should handle sign in flow', async () => {
    const { result } = renderHook(() => useAuthStore())

    await act(async () => {
      await result.current.signIn('test@example.com', 'password')
    })

    expect(result.current.user).toBeTruthy()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })
})
```

## 🔒 Security Considerations

- **Input Validation**: All service methods validate inputs using business rules
- **Error Information**: Sensitive data is filtered from error contexts
- **Telemetry**: User data is sanitized in telemetry collection
- **Caching**: Cache keys are sanitized to prevent data leakage
- **Rate Limiting**: Built-in support for rate limiting and abuse prevention

## 🚀 Performance Optimizations

- **Request Deduplication**: Prevent duplicate concurrent requests
- **Response Caching**: Cache frequently accessed data with TTL
- **Batch Operations**: Group multiple operations for efficiency  
- **Lazy Loading**: Load data only when needed
- **Error Recovery**: Automatic retry with exponential backoff

## 🤝 Contributing

When adding new services:

1. **Extend BaseService**: All services should extend the BaseService class
2. **Use StoreError**: Create service-specific errors with proper codes
3. **Add Tests**: Include unit tests for business logic
4. **Document APIs**: Document service methods and error conditions
5. **Monitor Health**: Implement service-specific health checks
6. **Follow Patterns**: Use established patterns for consistency

## 🆘 Troubleshooting

### Common Issues

**Service Not Found**
```typescript
// Make sure service is properly instantiated
const campaignService = CampaignService.getInstance()
```

**Error Codes Not Working**
```typescript
// Import error codes properly
import { STORE_ERROR_CODES } from '../lib/errors/StoreError'
```

**withAsyncAction Not Working**
```typescript
// Bind the action properly to store
const action = withAsyncAction(config)(implementation)
// In store:
myAction: action.bind({ setState: set, getState: get })
```

**Telemetry Not Collecting**
```typescript
// Check telemetry is enabled
const collector = createServiceTelemetry('myService', { 
  enabled: true,
  sampleRate: 1.0 
})
```

For more detailed troubleshooting, see the [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md).

---

This service layer foundation provides a robust, scalable architecture that maintains backward compatibility while enabling gradual migration to better patterns. The system is designed to grow with your needs while providing excellent developer experience and operational visibility.