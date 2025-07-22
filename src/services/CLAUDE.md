# Service Layer Patterns

# Service Structure

```
services/
├── api/           # External API services
├── auth/          # Authentication services
├── billing/       # Payment processing
├── campaigns/     # Campaign management
├── calls/         # Call tracking
├── analytics/     # Analytics and reporting
└── fraud/         # Fraud detection
```

# Service Class Pattern

```tsx
export class CampaignService {
  constructor(
    private supabase: SupabaseClient,
    private stripe: Stripe
  ) {}

  async createCampaign(data: CreateCampaignDTO): Promise<Campaign> {
    // Validate input
    const validated = campaignSchema.parse(data)

    // Business logic
    const campaign = await this.supabase.from('campaigns').insert(validated).select().single()

    if (campaign.error) throw new ServiceError(campaign.error.message)

    // Side effects (analytics, notifications)
    await this.trackCampaignCreation(campaign.data)

    return campaign.data
  }
}
```

# Error Handling

```tsx
export class ServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode = 400
  ) {
    super(message)
    this.name = 'ServiceError'
  }
}

export function handleServiceError(error: unknown): ServiceError {
  if (error instanceof ServiceError) return error

  if (error instanceof Error) {
    return new ServiceError(error.message, 'UNKNOWN_ERROR', 500)
  }

  return new ServiceError('Unknown error', 'UNKNOWN_ERROR', 500)
}
```

# Authentication Service

```tsx
export class AuthService {
  async login(email: string, password: string): Promise<AuthResponse> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw new ServiceError(error.message, 'AUTH_FAILED', 401)

    // Additional business logic (logging, analytics)
    await this.logUserActivity('login', data.user.id)

    return data
  }

  async validateSession(): Promise<User | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user
  }
}
```

# Billing Service

```tsx
export class BillingService {
  async processPayment(
    amount: number,
    paymentMethodId: string,
    userId: string
  ): Promise<PaymentResult> {
    // Create payment intent
    const intent = await this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      payment_method: paymentMethodId,
      confirm: true,
      metadata: { userId },
    })

    // Record transaction
    await this.recordTransaction(intent, userId)

    return {
      success: intent.status === 'succeeded',
      transactionId: intent.id,
    }
  }
}
```

# Call Tracking Service

```tsx
export class CallTrackingService {
  async startCall(campaignId: string, supplierId: string, callerNumber: string): Promise<Call> {
    // Generate tracking number
    const trackingNumber = await this.generateTrackingNumber()

    // Create call record
    const call = await this.supabase
      .from('calls')
      .insert({
        campaign_id: campaignId,
        supplier_id: supplierId,
        caller_number: callerNumber,
        tracking_number: trackingNumber,
        status: 'active',
      })
      .select()
      .single()

    // Set up real-time monitoring
    await this.initializeCallMonitoring(call.data.id)

    return call.data
  }

  private async generateTrackingNumber(): Promise<string> {
    // Implementation for unique tracking number
    return `1800${Date.now().toString().slice(-7)}`
  }
}
```

# Analytics Service

```tsx
export class AnalyticsService {
  async getCampaignMetrics(campaignId: string, dateRange: DateRange): Promise<CampaignMetrics> {
    const [calls, conversions, revenue] = await Promise.all([
      this.getCallVolume(campaignId, dateRange),
      this.getConversions(campaignId, dateRange),
      this.getRevenue(campaignId, dateRange),
    ])

    return {
      totalCalls: calls.count,
      conversionRate: (conversions / calls.count) * 100,
      revenue,
      costPerAcquisition: revenue / conversions,
    }
  }
}
```

# Fraud Detection Service

```tsx
export class FraudDetectionService {
  async analyzeCall(callId: string): Promise<FraudScore> {
    const call = await this.getCallDetails(callId)

    const checks = await Promise.all([
      this.checkDuplicateCaller(call.caller_number),
      this.checkCallPattern(call),
      this.checkGeographicAnomaly(call),
      this.checkCallDuration(call.duration),
    ])

    const score = this.calculateFraudScore(checks)

    if (score > FRAUD_THRESHOLD) {
      await this.flagCall(callId, score)
    }

    return score
  }
}
```

# Service Registration Pattern

```tsx
// services/index.ts
export class ServiceRegistry {
  private static instance: ServiceRegistry

  authService: AuthService
  billingService: BillingService
  campaignService: CampaignService
  callService: CallTrackingService
  analyticsService: AnalyticsService
  fraudService: FraudDetectionService

  private constructor() {
    this.authService = new AuthService()
    this.billingService = new BillingService(stripe)
    this.campaignService = new CampaignService(supabase, stripe)
    this.callService = new CallTrackingService()
    this.analyticsService = new AnalyticsService()
    this.fraudService = new FraudDetectionService()
  }

  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry()
    }
    return ServiceRegistry.instance
  }
}
```

# Service Testing

```tsx
describe('CampaignService', () => {
  let service: CampaignService

  beforeEach(() => {
    service = new CampaignService(mockSupabase, mockStripe)
  })

  it('should create campaign successfully', async () => {
    const campaign = await service.createCampaign({
      name: 'Test Campaign',
      vertical: 'insurance',
      target_cpa: 50,
    })

    expect(campaign).toBeDefined()
    expect(campaign.name).toBe('Test Campaign')
  })
})
```

# Caching Strategy

```tsx
export class CachedService {
  private cache = new Map<string, CacheEntry>()

  async getCachedData<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl = 300000 // 5 minutes
  ): Promise<T> {
    const cached = this.cache.get(key)

    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data as T
    }

    const data = await fetcher()
    this.cache.set(key, { data, timestamp: Date.now() })

    return data
  }
}
```

# Transaction Management

```tsx
export async function withTransaction<T>(operation: () => Promise<T>): Promise<T> {
  const client = await supabase.rpc('begin_transaction')

  try {
    const result = await operation()
    await supabase.rpc('commit_transaction')
    return result
  } catch (error) {
    await supabase.rpc('rollback_transaction')
    throw error
  }
}
```

# DCE-Specific Services

- Real-time call quality monitoring
- Dynamic campaign routing
- Supplier performance scoring
- Automated payout calculations
- Lead quality validation
- Commission rate optimization

# CRITICAL RULES

- NO regex in service logic
- NO any types in service methods
- ALWAYS validate inputs with Zod
- ALWAYS handle errors explicitly
- ALWAYS use transactions for multi-step operations
- ALWAYS log service operations
- NEVER expose internal errors to clients
- USE dependency injection for testing
- IMPLEMENT proper retry logic
- CACHE expensive operations appropriately
