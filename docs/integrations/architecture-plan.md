# Call Tracking Integration Architecture Plan

## Overview

This document outlines the technical architecture for integrating external call tracking platforms (Retreaver, TrackDrive, Ringba) into the DCE platform. The design emphasizes flexibility, reliability, and maintainability while supporting multiple providers.

## Architecture Principles

1. **Provider Agnostic**: Abstract common functionality to support multiple platforms
2. **Fault Tolerant**: Handle failures gracefully with retry logic and fallbacks
3. **Scalable**: Support high-volume call data without performance degradation
4. **Maintainable**: Clear separation of concerns and modular design
5. **Secure**: Protect API credentials and customer data

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         DCE Platform                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐     ┌──────────────────┐                 │
│  │   Web Interface │     │    REST API      │                 │
│  │   (React/TS)    │────▶│  (Express/Node)  │                 │
│  └─────────────────┘     └──────────────────┘                 │
│                                   │                             │
│  ┌─────────────────────────────────────────────────────┐      │
│  │              Call Tracking Service Layer             │      │
│  ├─────────────────────────────────────────────────────┤      │
│  │ ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │      │
│  │ │  Provider   │  │   Webhook    │  │    Data     │ │      │
│  │ │  Registry   │  │   Handler    │  │   Mapper    │ │      │
│  │ └─────────────┘  └──────────────┘  └─────────────┘ │      │
│  │ ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │      │
│  │ │    Cache    │  │    Queue     │  │   Metrics   │ │      │
│  │ │   (Redis)   │  │   (Bull)     │  │ (Prometheus)│ │      │
│  │ └─────────────┘  └──────────────┘  └─────────────┘ │      │
│  └─────────────────────────────────────────────────────┘      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────┐      │
│  │              Provider Adapter Layer                  │      │
│  ├─────────────────────────────────────────────────────┤      │
│  │ ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │      │
│  │ │  Retreaver  │  │  TrackDrive  │  │   Ringba    │ │      │
│  │ │   Adapter   │  │   Adapter    │  │   Adapter   │ │      │
│  │ └─────────────┘  └──────────────┘  └─────────────┘ │      │
│  └─────────────────────────────────────────────────────┘      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────┐      │
│  │                 Data Storage Layer                   │      │
│  ├─────────────────────────────────────────────────────┤      │
│  │        Supabase (PostgreSQL + Real-time)            │      │
│  └─────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘

External Services:
┌─────────────┐  ┌──────────────┐  ┌─────────────┐
│  Retreaver  │  │  TrackDrive  │  │   Ringba    │
│     API     │  │     API      │  │     API     │
└─────────────┘  └──────────────┘  └─────────────┘
```

## Core Components

### 1. Provider Registry

Manages configuration and metadata for each integrated platform.

```typescript
interface ProviderConfig {
  id: string;
  name: string;
  type: 'retreaver' | 'trackdrive' | 'ringba';
  apiBaseUrl: string;
  webhookUrl?: string;
  credentials: {
    type: 'api_key' | 'oauth' | 'basic';
    data: Record<string, string>;
  };
  features: {
    webhooks: boolean;
    realtime: boolean;
    numberProvisioning: boolean;
    recording: boolean;
    transcription: boolean;
  };
  rateLimits?: {
    requestsPerSecond?: number;
    requestsPerMinute?: number;
    requestsPerHour?: number;
  };
}
```

### 2. Provider Adapter Interface

Common interface that all platform adapters must implement:

```typescript
interface ICallTrackingProvider {
  // Core identification
  readonly providerId: string;
  readonly providerName: string;

  // Authentication
  authenticate(): Promise<void>;
  validateCredentials(): Promise<boolean>;

  // Call Data Operations
  getCall(callId: string): Promise<CallData>;
  getCalls(filters: CallFilters): Promise<PaginatedResponse<CallData>>;
  updateCall(callId: string, data: Partial<CallData>): Promise<CallData>;

  // Webhook Management
  registerWebhook(config: WebhookConfig): Promise<WebhookRegistration>;
  unregisterWebhook(webhookId: string): Promise<void>;
  validateWebhookSignature(payload: any, signature: string): boolean;

  // Number Management
  provisionNumber(options: NumberOptions): Promise<TrackingNumber>;
  releaseNumber(number: string): Promise<void>;
  getNumbers(): Promise<TrackingNumber[]>;

  // Campaign Management
  getCampaign(campaignId: string): Promise<Campaign>;
  getCampaigns(): Promise<Campaign[]>;
  
  // Reporting
  getCallReport(startDate: Date, endDate: Date): Promise<CallReport>;
}
```

### 3. Webhook Handler

Centralized webhook processing with provider-specific validation:

```typescript
class WebhookHandler {
  constructor(
    private providers: Map<string, ICallTrackingProvider>,
    private queue: Queue,
    private eventBus: EventEmitter
  ) {}

  async handleWebhook(
    providerId: string, 
    headers: Record<string, string>,
    body: any
  ): Promise<void> {
    // 1. Get provider adapter
    const provider = this.providers.get(providerId);
    
    // 2. Validate webhook signature
    if (!provider.validateWebhookSignature(body, headers['signature'])) {
      throw new UnauthorizedError('Invalid webhook signature');
    }
    
    // 3. Queue for processing
    await this.queue.add('process-webhook', {
      providerId,
      event: body,
      timestamp: new Date()
    });
    
    // 4. Emit real-time event
    this.eventBus.emit('call-event', {
      providerId,
      event: body
    });
  }
}
```

### 4. Data Mapper

Transforms provider-specific data to DCE schema:

```typescript
class DataMapper {
  mapCall(providerType: string, providerData: any): CallRecord {
    switch (providerType) {
      case 'retreaver':
        return this.mapRetreaverCall(providerData);
      case 'trackdrive':
        return this.mapTrackDriveCall(providerData);
      case 'ringba':
        return this.mapRingbaCall(providerData);
      default:
        throw new Error(`Unknown provider type: ${providerType}`);
    }
  }

  private mapRetreaverCall(data: any): CallRecord {
    return {
      id: generateUUID(),
      external_id: data.uuid,
      provider: 'retreaver',
      campaign_id: data.campaign_id,
      tracking_number: data.dialed_number,
      caller_number: data.caller_number,
      destination_number: data.receiving_number,
      status: this.mapRetreaverStatus(data.status),
      started_at: new Date(data.initiated_at),
      answered_at: data.answered_at ? new Date(data.answered_at) : null,
      ended_at: data.completed_at ? new Date(data.completed_at) : null,
      duration_seconds: data.duration || 0,
      recording_url: data.recording_url,
      metadata: {
        tags: data.tag_values,
        original_data: data
      }
    };
  }
}
```

### 5. Queue System

Handles asynchronous processing of webhooks and data sync:

```typescript
// Queue configuration
const callQueue = new Queue('call-processing', {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 1000,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

// Queue processor
callQueue.process('process-webhook', async (job) => {
  const { providerId, event } = job.data;
  
  // Map data
  const callData = dataMapper.mapCall(providerId, event);
  
  // Store in database
  await supabase.from('calls').upsert(callData);
  
  // Update cache
  await cache.set(`call:${callData.id}`, callData);
  
  // Emit events for real-time updates
  await supabase.from('call_events').insert({
    call_id: callData.id,
    event_type: 'webhook_processed',
    data: event
  });
});
```

### 6. Caching Strategy

Multi-level caching for performance:

```typescript
class CacheManager {
  constructor(
    private redis: Redis,
    private ttl: number = 300 // 5 minutes
  ) {}

  async getCachedCall(callId: string): Promise<CallRecord | null> {
    const cached = await this.redis.get(`call:${callId}`);
    return cached ? JSON.parse(cached) : null;
  }

  async cacheCall(call: CallRecord): Promise<void> {
    await this.redis.setex(
      `call:${call.id}`,
      this.ttl,
      JSON.stringify(call)
    );
  }

  async invalidateCall(callId: string): Promise<void> {
    await this.redis.del(`call:${callId}`);
  }

  // Batch operations
  async warmCache(startDate: Date, endDate: Date): Promise<void> {
    const calls = await this.fetchRecentCalls(startDate, endDate);
    const pipeline = this.redis.pipeline();
    
    calls.forEach(call => {
      pipeline.setex(
        `call:${call.id}`,
        this.ttl,
        JSON.stringify(call)
      );
    });
    
    await pipeline.exec();
  }
}
```

## Data Flow Patterns

### 1. Real-time Call Updates (Webhook Flow)

```
Provider → Webhook Endpoint → Validation → Queue → Processing → Database → Real-time Broadcast
                                                        ↓
                                                     Cache Update
```

### 2. Historical Data Sync (Batch Flow)

```
Scheduler → Provider API → Pagination Handler → Data Mapper → Batch Insert → Cache Warm
                               ↓
                          Rate Limiter
```

### 3. Client Data Request Flow

```
Client Request → Cache Check → Database Query → Provider API (if needed) → Response
                    ↓
                 Cache Hit → Response
```

## Security Considerations

### 1. Credential Management

```typescript
// Use environment variables with encryption
const credentials = {
  retreaver: {
    apiKey: decrypt(process.env.RETREAVER_API_KEY_ENCRYPTED),
    companyId: process.env.RETREAVER_COMPANY_ID
  },
  trackdrive: {
    publicKey: decrypt(process.env.TRACKDRIVE_PUBLIC_KEY_ENCRYPTED),
    privateKey: decrypt(process.env.TRACKDRIVE_PRIVATE_KEY_ENCRYPTED)
  },
  ringba: {
    clientId: process.env.RINGBA_CLIENT_ID,
    clientSecret: decrypt(process.env.RINGBA_CLIENT_SECRET_ENCRYPTED)
  }
};
```

### 2. Webhook Security

- Validate signatures for each provider
- Use webhook-specific endpoints with provider ID
- Implement IP whitelisting where supported
- Log all webhook attempts for audit

### 3. API Security

- Rate limiting per provider
- Request/response logging
- Error masking in production
- Regular credential rotation

## Error Handling Strategy

```typescript
class ProviderError extends Error {
  constructor(
    public provider: string,
    public code: string,
    public retryable: boolean,
    message: string
  ) {
    super(message);
  }
}

// Retry logic
async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (!isRetryable(error) || attempt === options.maxAttempts) {
        throw error;
      }
      
      const delay = options.backoff === 'exponential'
        ? Math.pow(2, attempt) * options.baseDelay
        : options.baseDelay;
        
      await sleep(delay);
    }
  }
  
  throw lastError;
}
```

## Monitoring & Observability

### 1. Metrics to Track

```typescript
// Provider health metrics
metrics.gauge('provider.api.availability', availability, { provider });
metrics.counter('provider.api.requests', { provider, endpoint, status });
metrics.histogram('provider.api.latency', latency, { provider, endpoint });

// Webhook metrics
metrics.counter('webhooks.received', { provider, event_type });
metrics.counter('webhooks.processed', { provider, status });
metrics.histogram('webhooks.processing_time', duration, { provider });

// Data sync metrics
metrics.gauge('sync.lag_seconds', lagSeconds, { provider });
metrics.counter('sync.records_processed', count, { provider, type });
```

### 2. Logging Strategy

```typescript
logger.info('Webhook received', {
  provider,
  eventType,
  callId,
  timestamp,
  signature: signature.substring(0, 10) + '...'
});

logger.error('Provider API error', {
  provider,
  endpoint,
  error: error.message,
  retryable: error.retryable,
  attempt,
  maxAttempts
});
```

## Database Schema Updates

```sql
-- Add provider tracking to calls table
ALTER TABLE calls ADD COLUMN provider VARCHAR(50);
ALTER TABLE calls ADD COLUMN external_id VARCHAR(255);
ALTER TABLE calls ADD COLUMN provider_data JSONB;
ALTER TABLE calls ADD COLUMN last_synced_at TIMESTAMPTZ;

-- Provider configuration table
CREATE TABLE provider_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  credentials JSONB NOT NULL, -- Encrypted
  settings JSONB,
  features JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook log table
CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,
  event_type VARCHAR(100),
  payload JSONB,
  signature VARCHAR(500),
  processed BOOLEAN DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync status table
CREATE TABLE sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,
  last_sync_at TIMESTAMPTZ,
  last_successful_sync_at TIMESTAMPTZ,
  records_synced INTEGER DEFAULT 0,
  status VARCHAR(50),
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Configuration Management

```typescript
// Provider configuration structure
const providerConfig = {
  retreaver: {
    enabled: process.env.RETREAVER_ENABLED === 'true',
    apiUrl: 'https://api.retreaver.com',
    webhookPath: '/webhooks/retreaver',
    syncInterval: 300000, // 5 minutes
    batchSize: 100,
    features: {
      webhooks: true,
      realtime: true,
      numberProvisioning: true,
      recording: true
    }
  },
  trackdrive: {
    enabled: process.env.TRACKDRIVE_ENABLED === 'true',
    apiUrl: 'https://app.trackdrive.com/api/v1',
    webhookPath: '/webhooks/trackdrive',
    syncInterval: 600000, // 10 minutes
    batchSize: 50,
    features: {
      webhooks: true,
      realtime: false,
      numberProvisioning: true,
      recording: true
    }
  },
  ringba: {
    enabled: process.env.RINGBA_ENABLED === 'true',
    apiUrl: 'https://api.ringba.com/v2',
    webhookPath: '/webhooks/ringba',
    syncInterval: 300000, // 5 minutes
    batchSize: 100,
    features: {
      webhooks: true,
      realtime: true,
      numberProvisioning: true,
      recording: true
    }
  }
};
```

## Testing Strategy

### 1. Unit Tests

```typescript
describe('RetreaverAdapter', () => {
  let adapter: RetreaverAdapter;
  let mockApi: MockAdapter;

  beforeEach(() => {
    mockApi = new MockAdapter(axios);
    adapter = new RetreaverAdapter(testConfig);
  });

  it('should map call data correctly', async () => {
    const retrealData = fixtures.retreavorCall;
    const mapped = adapter.mapCall(retrealData);
    
    expect(mapped.tracking_number).toBe(retrealData.dialed_number);
    expect(mapped.status).toBe('completed');
    expect(mapped.duration_seconds).toBe(retrealData.duration);
  });

  it('should handle webhook signature validation', () => {
    const payload = { test: 'data' };
    const signature = generateTestSignature(payload);
    
    expect(adapter.validateWebhookSignature(payload, signature)).toBe(true);
  });
});
```

### 2. Integration Tests

```typescript
describe('Call Tracking Integration', () => {
  it('should process webhook and update database', async () => {
    const webhook = fixtures.retreavorWebhook;
    
    const response = await request(app)
      .post('/webhooks/retreaver')
      .set('X-Signature', validSignature)
      .send(webhook);
      
    expect(response.status).toBe(200);
    
    // Verify database update
    const call = await supabase
      .from('calls')
      .select()
      .eq('external_id', webhook.uuid)
      .single();
      
    expect(call.data).toBeDefined();
    expect(call.data.status).toBe('completed');
  });
});
```

### 3. Mock Provider Service

```typescript
class MockProviderService {
  constructor(private port: number) {
    this.app = express();
    this.setupRoutes();
  }

  setupRoutes() {
    // Mock API endpoints
    this.app.get('/api/calls', (req, res) => {
      res.json({
        calls: generateMockCalls(req.query),
        pagination: {
          page: req.query.page || 1,
          total: 100
        }
      });
    });

    // Mock webhook sender
    this.app.post('/send-webhook', async (req, res) => {
      const webhook = generateMockWebhook(req.body.type);
      await this.sendWebhook(webhook);
      res.json({ sent: true });
    });
  }
}
```

## Performance Considerations

### 1. Database Optimization

```sql
-- Indexes for common queries
CREATE INDEX idx_calls_provider_external_id ON calls(provider, external_id);
CREATE INDEX idx_calls_provider_updated_at ON calls(provider, updated_at);
CREATE INDEX idx_webhook_logs_provider_created_at ON webhook_logs(provider, created_at);

-- Partitioning for large tables
CREATE TABLE calls_2024_01 PARTITION OF calls
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### 2. Connection Pooling

```typescript
const providerPools = new Map<string, AxiosInstance>();

function getProviderClient(provider: string): AxiosInstance {
  if (!providerPools.has(provider)) {
    const client = axios.create({
      baseURL: providerConfig[provider].apiUrl,
      timeout: 30000,
      maxRedirects: 5,
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent: new https.Agent({ keepAlive: true })
    });
    
    providerPools.set(provider, client);
  }
  
  return providerPools.get(provider);
}
```

## Migration Strategy

### Phase 1: Preparation
1. Deploy provider adapter framework
2. Configure webhook endpoints
3. Set up monitoring and logging

### Phase 2: Parallel Running
1. Start receiving webhooks (no processing)
2. Log and compare with existing data
3. Identify data mapping issues

### Phase 3: Gradual Migration
1. Enable processing for new calls
2. Backfill historical data
3. Verify data integrity

### Phase 4: Cutover
1. Disable internal call tracking
2. Switch all clients to external data
3. Archive old call tracking code

## Disaster Recovery

### 1. Webhook Recovery

```typescript
async function recoverMissedWebhooks(
  provider: string,
  startTime: Date,
  endTime: Date
): Promise<void> {
  const adapter = getProviderAdapter(provider);
  
  // Fetch calls from provider API
  const calls = await adapter.getCalls({
    startDate: startTime,
    endDate: endTime
  });
  
  // Compare with local data
  for (const call of calls) {
    const exists = await checkCallExists(call.id);
    if (!exists) {
      // Reprocess as if it were a webhook
      await processWebhook(provider, call);
    }
  }
}
```

### 2. Data Consistency Checks

```typescript
class DataConsistencyChecker {
  async validateProvider(provider: string): Promise<ValidationReport> {
    const report = {
      provider,
      missingCalls: [],
      mismatchedData: [],
      errors: []
    };
    
    // Get recent calls from provider
    const providerCalls = await this.fetchProviderCalls(provider);
    
    // Compare with local data
    for (const pCall of providerCalls) {
      const localCall = await this.findLocalCall(pCall.id);
      
      if (!localCall) {
        report.missingCalls.push(pCall.id);
      } else if (!this.compareCallData(pCall, localCall)) {
        report.mismatchedData.push({
          id: pCall.id,
          differences: this.getDifferences(pCall, localCall)
        });
      }
    }
    
    return report;
  }
}
```

## Future Enhancements

1. **Multi-Provider Routing**: Route calls through different providers based on cost/quality
2. **Provider Failover**: Automatic failover between providers
3. **Advanced Analytics**: Aggregate analytics across all providers
4. **Custom Provider Support**: Plugin system for adding new providers
5. **GraphQL API**: Unified GraphQL endpoint for all call data
6. **Machine Learning**: Call quality prediction and fraud detection
7. **Event Streaming**: Kafka/Kinesis integration for high-volume scenarios

## Conclusion

This architecture provides a robust, scalable foundation for integrating multiple call tracking platforms while maintaining flexibility for future enhancements. The modular design allows for easy addition of new providers and features without disrupting existing functionality.