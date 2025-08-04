# Store-to-Service Migration Guide

This guide provides comprehensive instructions for migrating from store-based architecture to service layer architecture in the DCE platform. The migration is designed to be gradual and non-breaking, allowing for incremental improvements while maintaining existing functionality.

## Table of Contents

1. [Overview](#overview)
2. [Migration Phases](#migration-phases)
3. [Service Layer Architecture](#service-layer-architecture)
4. [Migration Process](#migration-process)
5. [Error Handling Migration](#error-handling-migration)
6. [Store Integration Patterns](#store-integration-patterns)
7. [Code Examples](#code-examples)
8. [Best Practices](#best-practices)
9. [Testing Strategy](#testing-strategy)
10. [Rollback Procedures](#rollback-procedures)

## Overview

### Current State
- Stores contain direct Supabase calls
- Business logic mixed with state management
- Inconsistent error handling patterns
- Limited testing capabilities for business logic

### Target State
- Services encapsulate business logic and external API calls
- Stores focus on state management and UI concerns
- Standardized error handling with structured error codes
- Improved testability and maintainability
- Better telemetry and monitoring

### Benefits
- **Separation of Concerns**: Business logic separated from state management
- **Testability**: Services can be unit tested independently
- **Reusability**: Services can be used across different stores/components
- **Error Handling**: Standardized error codes and recovery strategies
- **Monitoring**: Better telemetry and performance tracking
- **Maintainability**: Cleaner, more organized codebase

## Migration Phases

### Phase 1: Foundation Setup ✅
- [x] Create BaseService class with common patterns
- [x] Implement StoreError system with service-specific error codes
- [x] Create withAsyncAction middleware helper
- [x] Build CampaignService as example implementation
- [x] Document migration patterns and best practices

### Phase 2: Gradual Service Integration
- [ ] Create service instances for each domain (Auth, Buyer, Supplier, etc.)
- [ ] Implement thin wrapper methods that proxy to existing store logic
- [ ] Integrate withAsyncAction in stores for service calls
- [ ] Add service health checks and monitoring
- [ ] Update error handling to use StoreError codes

### Phase 3: Business Logic Migration
- [ ] Move validation logic from stores to services
- [ ] Implement business rules and constraints in services
- [ ] Add caching and optimization in service layer
- [ ] Migrate complex operations to service methods
- [ ] Update stores to call service methods instead of direct DB calls

### Phase 4: Advanced Features
- [ ] Implement service-to-service communication patterns
- [ ] Add advanced caching strategies (Redis integration)
- [ ] Implement event-driven architecture between services
- [ ] Add comprehensive telemetry and APM integration
- [ ] Optimize performance with batch operations

## Service Layer Architecture

### Service Hierarchy

```
BaseService (Abstract)
├── AuthService
├── CampaignService ✅
├── BuyerService
├── SupplierService
├── CallTrackingService
├── BillingService
├── NotificationService
└── AnalyticsService
```

### Service Responsibilities

**BaseService**
- Error handling and recovery
- Caching and request deduplication
- Retry logic with exponential backoff
- Performance monitoring and telemetry
- Health checks and service status

**Domain Services**
- Business logic and validation
- External API integration
- Data transformation
- Domain-specific error handling
- Transaction management

## Migration Process

### Step 1: Create Service Class

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

  // Phase 2: Thin wrapper methods
  async signIn(email: string, password: string) {
    return this.executeOperation({
      name: 'signIn',
      execute: async () => {
        // Initially proxy to existing logic
        return this.callExistingStoreMethod('signIn', { email, password })
      }
    })
  }

  // Phase 3: Move business logic here
  async signInWithValidation(email: string, password: string) {
    return this.executeOperation({
      name: 'signInWithValidation',
      execute: async () => {
        // Validate input
        this.validateEmail(email)
        this.validatePassword(password)
        
        // Check rate limiting
        await this.checkRateLimit(email)
        
        // Perform authentication
        const result = await this.performAuthentication(email, password)
        
        // Business logic for post-auth
        await this.updateLastLogin(result.user.id)
        
        return result
      }
    })
  }

  private validateEmail(email: string): void {
    if (!email || !email.includes('@')) {
      throw createStoreError.validationFailed('email', 'valid email required', email, 'auth')
    }
  }
}
```

### Step 2: Create Store Action

```typescript
// src/store/authStore.ts
import { AuthService } from '../services/auth/AuthService'
import { withAsyncAction } from './utils/withAsyncAction'

const authService = AuthService.getInstance()

// Create async action
const signInAction = withAsyncAction({
  actionName: 'signIn',
  storeName: 'auth',
  serviceName: 'auth',
  enableLoadingState: true,
  enableRecovery: true,
})(async (params: { email: string; password: string }) => {
  return authService.signIn(params.email, params.password)
})

// In store implementation
export const useAuthStore = create<AuthState>((set, get) => ({
  // ... existing state
  
  signIn: signInAction.bind({ setState: set, getState: get }),
  
  // ... rest of store
}))
```

### Step 3: Migrate Error Handling

```typescript
// Before: Generic error handling
catch (error) {
  console.error('Sign in failed:', error)
  set({ error: error.message })
}

// After: Structured error handling
catch (error) {
  const storeError = migrateError(error, { 
    serviceName: 'auth', 
    operation: 'signIn' 
  })
  
  set({ 
    error: storeError,
    errorCode: storeError.code 
  })
  
  // Error is automatically reported to monitoring
}
```

## Error Handling Migration

### Before: Inconsistent Error Handling

```typescript
// Different error patterns across stores
try {
  const { data, error } = await supabase.from('campaigns').select('*')
  if (error) throw error
} catch (error) {
  set({ error: error.message }) // String error
}

try {
  const response = await fetch('/api/campaigns')
  if (!response.ok) throw new Error('Failed')
} catch (error) {
  set({ error }) // Error object
}
```

### After: Standardized Error Handling

```typescript
// Consistent error handling with codes
import { createStoreError, STORE_ERROR_CODES } from '../lib/errors/StoreError'

// In service
if (error.code === 'PGRST116') {
  throw createStoreError.notFound('campaign', id, 'campaign')
}

if (response.status === 429) {
  throw createStoreError.serviceRateLimited('campaign', response.headers.get('retry-after'))
}

// In store - automatic error handling via withAsyncAction
const fetchCampaigns = withAsyncAction({
  actionName: 'fetchCampaigns',
  storeName: 'campaign',
  serviceName: 'campaign',
})(async (params) => {
  return campaignService.getCampaigns(params)
})
```

## Store Integration Patterns

### Pattern 1: Direct Service Call

```typescript
// For new functionality - call service directly
const createCampaign = async (data: CreateCampaignRequest) => {
  set({ loading: true, error: null })
  
  try {
    const campaign = await campaignService.createCampaign(data, userId)
    set(state => ({
      campaigns: [...state.campaigns, campaign],
      loading: false
    }))
  } catch (error) {
    const storeError = migrateError(error, { serviceName: 'campaign' })
    set({ error: storeError, loading: false })
  }
}
```

### Pattern 2: withAsyncAction Wrapper

```typescript
// For standardized async operations
const createCampaignAction = withAsyncAction({
  actionName: 'createCampaign',
  storeName: 'campaign',
  serviceName: 'campaign',
  enableLoadingState: true,
  enableRecovery: false, // Don't retry mutations
  validateParams: (data: CreateCampaignRequest) => {
    return data.name && data.budget > 0
  },
  onSuccess: (campaign: Campaign) => {
    // Custom success handling
    showSuccessNotification(`Campaign "${campaign.name}" created successfully`)
  }
})(async (data: CreateCampaignRequest, context) => {
  const userId = context.state.user?.id
  if (!userId) {
    throw createStoreError.sessionExpired('campaign', 'createCampaign')
  }
  
  return campaignService.createCampaign(data, userId)
})
```

### Pattern 3: Gradual Migration

```typescript
// Phase 2: Proxy pattern
const getCampaigns = async (filters: CampaignFilters) => {
  // Gradually move to service while maintaining compatibility
  if (USE_SERVICE_LAYER) {
    return campaignService.getCampaigns({ filters })
  } else {
    // Keep existing logic temporarily
    return getExistingCampaignLogic(filters)
  }
}

// Phase 3: Full migration
const getCampaigns = async (filters: CampaignFilters) => {
  return campaignService.getCampaigns({ filters })
}
```

## Code Examples

### Complete Service Implementation

```typescript
// src/services/buyer/BuyerService.ts
export class BuyerService extends BaseService {
  constructor() {
    super({
      name: 'buyer',
      enableCaching: true,
      cacheTtl: 3 * 60 * 1000,
    })
  }

  async getBuyerProfile(id: string): Promise<BuyerProfile | null> {
    return this.executeOperation({
      name: 'getBuyerProfile',
      cacheKey: `buyer:${id}`,
      execute: async () => {
        const { data, error } = await this.supabase
          .from('buyers')
          .select(`
            *,
            campaigns(count),
            billing_info(*)
          `)
          .eq('id', id)
          .single()

        if (error) {
          if (error.code === 'PGRST116') {
            return null
          }
          throw createStoreError.fetchFailed('buyer profile', error.message, 'buyer')
        }

        return this.transformBuyerData(data)
      }
    })
  }

  async updateBuyerProfile(id: string, updates: Partial<BuyerProfile>): Promise<BuyerProfile> {
    return this.executeOperation({
      name: 'updateBuyerProfile',
      skipCache: true,
      execute: async () => {
        // Validate updates
        this.validateBuyerUpdates(updates)

        // Check permissions
        await this.validateBuyerPermissions(id)

        const { data, error } = await this.supabase
          .from('buyers')
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select('*')
          .single()

        if (error) {
          throw createStoreError.saveFailed('buyer profile', error.message, 'buyer')
        }

        // Clear related caches
        this.clearCache()

        return this.transformBuyerData(data)
      }
    })
  }

  private validateBuyerUpdates(updates: Partial<BuyerProfile>): void {
    if (updates.email && !this.isValidEmail(updates.email)) {
      throw createStoreError.validationFailed('email', 'valid email required', updates.email, 'buyer')
    }

    if (updates.creditLimit && updates.creditLimit < 0) {
      throw createStoreError.validationFailed('creditLimit', 'must be non-negative', updates.creditLimit, 'buyer')
    }
  }
}
```

### Store Integration

```typescript
// src/store/buyerStore.ts
import { BuyerService } from '../services/buyer/BuyerService'
import { withAsyncAction, type AsyncActionState } from './utils/withAsyncAction'

interface BuyerState extends AsyncActionState {
  profile: BuyerProfile | null
  campaigns: Campaign[]
  // ... other state
}

const buyerService = BuyerService.getInstance()

// Create async actions
const getBuyerProfileAction = withAsyncAction({
  actionName: 'getBuyerProfile',
  storeName: 'buyer',
  serviceName: 'buyer',
  cache: {
    enabled: true,
    key: (id: string) => `buyer-profile:${id}`,
    ttl: 5 * 60 * 1000,
  }
})(async (id: string) => {
  return buyerService.getBuyerProfile(id)
})

const updateBuyerProfileAction = withAsyncAction({
  actionName: 'updateBuyerProfile',
  storeName: 'buyer',
  serviceName: 'buyer',
  enableRecovery: false,
})(async (params: { id: string; updates: Partial<BuyerProfile> }) => {
  return buyerService.updateBuyerProfile(params.id, params.updates)
})

export const useBuyerStore = create<BuyerState>((set, get) => ({
  // State
  profile: null,
  campaigns: [],
  loading: false,
  error: null,
  actionHistory: [],

  // Actions
  getBuyerProfile: getBuyerProfileAction.bind({ setState: set, getState: get }),
  updateBuyerProfile: updateBuyerProfileAction.bind({ setState: set, getState: get }),

  // Helper methods
  clearError: () => set({ error: null }),
  retryLastAction: async () => {
    // Implementation depends on last action
  },
}))
```

## Best Practices

### Service Design

1. **Single Responsibility**: Each service handles one domain
2. **Stateless**: Services should not maintain state between calls
3. **Error Handling**: Always use StoreError for consistent error handling
4. **Validation**: Validate inputs at service boundary
5. **Logging**: Use service logging for debugging and monitoring
6. **Testing**: Write unit tests for business logic in services

### Store Design

1. **State Management**: Stores focus on UI state and data caching
2. **Service Integration**: Use withAsyncAction for service calls
3. **Error Display**: Handle StoreError objects for user feedback
4. **Loading States**: Let withAsyncAction manage loading states
5. **Cache Management**: Let services handle data caching

### Error Handling

1. **Consistent Codes**: Use STORE_ERROR_CODES for all errors
2. **User Messages**: Provide helpful error messages for users
3. **Recovery**: Implement recovery strategies where applicable
4. **Monitoring**: Ensure errors are reported for monitoring
5. **Debugging**: Include context for debugging in development

## Testing Strategy

### Service Testing

```typescript
// tests/services/BuyerService.test.ts
describe('BuyerService', () => {
  let service: BuyerService
  let mockSupabase: jest.Mocked<SupabaseClient>

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient()
    service = new BuyerService()
    // Inject mock
    service['supabase'] = mockSupabase
  })

  it('should fetch buyer profile successfully', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: mockBuyerData,
        error: null
      })
    })

    const result = await service.getBuyerProfile('buyer-123')
    
    expect(result).toEqual(expect.objectContaining({
      id: 'buyer-123',
      name: 'Test Buyer'
    }))
  })

  it('should handle validation errors correctly', async () => {
    await expect(
      service.updateBuyerProfile('buyer-123', { email: 'invalid-email' })
    ).rejects.toThrow(StoreError)
    
    await expect(
      service.updateBuyerProfile('buyer-123', { email: 'invalid-email' })
    ).rejects.toHaveProperty('code', STORE_ERROR_CODES.DATA_VALIDATION_FAILED)
  })
})
```

### Store Testing

```typescript
// tests/store/buyerStore.test.ts
describe('useBuyerStore', () => {
  it('should handle successful profile fetch', async () => {
    const { result } = renderHook(() => useBuyerStore())
    
    // Mock service response
    jest.spyOn(buyerService, 'getBuyerProfile').mockResolvedValue(mockProfile)
    
    await act(async () => {
      await result.current.getBuyerProfile('buyer-123')
    })
    
    expect(result.current.profile).toEqual(mockProfile)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should handle service errors correctly', async () => {
    const { result } = renderHook(() => useBuyerStore())
    const mockError = createStoreError.notFound('buyer', 'buyer-123', 'buyer')
    
    jest.spyOn(buyerService, 'getBuyerProfile').mockRejectedValue(mockError)
    
    await act(async () => {
      try {
        await result.current.getBuyerProfile('buyer-123')
      } catch (error) {
        // Expected to throw
      }
    })
    
    expect(result.current.error).toEqual(mockError)
    expect(result.current.loading).toBe(false)
  })
})
```

## Rollback Procedures

### Phase 2 Rollback
If issues arise during Phase 2, you can easily rollback by:

1. **Feature Flag**: Set `USE_SERVICE_LAYER = false`
2. **Service Bypass**: Update proxy methods to skip service layer
3. **Error Handling**: Revert to original error handling temporarily

```typescript
// Emergency rollback pattern
const getCampaigns = async (filters: CampaignFilters) => {
  if (process.env.EMERGENCY_ROLLBACK === 'true') {
    return originalGetCampaignsLogic(filters)
  }
  return campaignService.getCampaigns({ filters })
}
```

### Phase 3 Rollback
For Phase 3 rollback:

1. **Database Schema**: Ensure backward compatibility
2. **API Contracts**: Maintain existing interfaces
3. **Store State**: Preserve existing store state structure
4. **Error Codes**: Map new error codes back to legacy formats

## Migration Checklist

### Per Service Migration

- [ ] Create service class extending BaseService
- [ ] Implement core business operations
- [ ] Add validation and business rules
- [ ] Create unit tests for service methods
- [ ] Update store to use withAsyncAction
- [ ] Update error handling to use StoreError
- [ ] Add telemetry and monitoring
- [ ] Document service API and migration notes
- [ ] Test service integration thoroughly
- [ ] Deploy with feature flag for rollback capability

### System-wide Tasks

- [ ] Set up service monitoring and alerting
- [ ] Configure centralized logging for services
- [ ] Implement service health checks
- [ ] Set up performance benchmarking
- [ ] Update deployment pipeline for services
- [ ] Create service documentation
- [ ] Train team on new patterns
- [ ] Update coding standards and guidelines

## Conclusion

This migration guide provides a comprehensive approach to moving from store-based to service-based architecture. The key is to migrate gradually, maintain backward compatibility, and ensure thorough testing at each phase.

The service layer foundation provides:
- Standardized error handling with StoreError codes
- Consistent patterns with BaseService
- Reduced boilerplate with withAsyncAction
- Better testability and maintainability
- Improved monitoring and telemetry

Follow this guide phase by phase to ensure a smooth migration while maintaining system stability and user experience.