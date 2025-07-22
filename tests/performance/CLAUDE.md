# Performance Test Patterns

# Test Structure

```
performance/
├── load/          # Load testing scenarios
├── stress/        # Stress testing limits
├── benchmarks/    # Performance benchmarks
└── profiling/     # Performance profiling
```

# Load Testing Patterns

```tsx
// load/concurrent-users.test.ts
import { describe, it, expect } from 'vitest'
import { loadTest } from '../helpers/load-test'

describe('Concurrent User Load Tests', () => {
  it('should handle 100 concurrent users', async () => {
    const results = await loadTest({
      virtualUsers: 100,
      duration: '30s',
      scenario: async (userId) => {
        // Simulate user journey
        await login(`user${userId}@test.com`, 'password')
        await browseCampaigns()
        await viewCampaignDetails()
        await generateTrackingNumber()
      },
    })

    expect(results.successRate).toBeGreaterThan(0.95) // 95% success
    expect(results.avgResponseTime).toBeLessThan(1000) // Under 1s
    expect(results.p95ResponseTime).toBeLessThan(2000) // 95th percentile under 2s
  })
})
```

# API Performance Tests

```tsx
// load/api-endpoints.test.ts
describe('API Endpoint Performance', () => {
  const endpoints = [
    { path: '/api/campaigns', method: 'GET' },
    { path: '/api/calls', method: 'GET' },
    { path: '/api/analytics/dashboard', method: 'GET' },
  ]

  endpoints.forEach(({ path, method }) => {
    it(`should handle load on ${method} ${path}`, async () => {
      const results = await loadTest({
        virtualUsers: 50,
        duration: '1m',
        scenario: async () => {
          const start = performance.now()
          const response = await fetch(path, { method })
          const duration = performance.now() - start

          return {
            status: response.status,
            duration,
          }
        },
      })

      expect(results.errorRate).toBeLessThan(0.01) // Less than 1% errors
      expect(results.avgResponseTime).toBeLessThan(500) // Under 500ms avg
    })
  })
})
```

# Database Performance Tests

```tsx
// performance/database-queries.test.ts
describe('Database Query Performance', () => {
  it('should execute campaign queries efficiently', async () => {
    const queries = [
      // Complex join query
      async () => {
        const start = performance.now()
        const { data } = await supabase
          .from('campaigns')
          .select(
            `
            *,
            calls (count),
            transactions (sum(amount))
          `
          )
          .eq('status', 'active')
          .limit(50)
        return performance.now() - start
      },

      // Aggregation query
      async () => {
        const start = performance.now()
        const { data } = await supabase.rpc('get_campaign_analytics', {
          campaign_id: testCampaigns.active.id,
          date_from: '2024-01-01',
          date_to: '2024-12-31',
        })
        return performance.now() - start
      },
    ]

    const durations = await Promise.all(queries.map((q) => q()))

    durations.forEach((duration) => {
      expect(duration).toBeLessThan(100) // Each query under 100ms
    })
  })
})
```

# Real-time Performance Tests

```tsx
// performance/realtime-subscriptions.test.ts
describe('Real-time Subscription Performance', () => {
  it('should handle multiple simultaneous subscriptions', async () => {
    const subscriptionCount = 100
    const channels: RealtimeChannel[] = []
    const messageReceived: number[] = []

    // Create subscriptions
    const startSubscribe = performance.now()
    for (let i = 0; i < subscriptionCount; i++) {
      const channel = supabase
        .channel(`test-channel-${i}`)
        .on('broadcast', { event: 'test' }, () => {
          messageReceived.push(performance.now())
        })
        .subscribe()

      channels.push(channel)
    }
    const subscribeTime = performance.now() - startSubscribe

    // Wait for all subscriptions
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Broadcast message
    const broadcastStart = performance.now()
    await supabase.channel('test-broadcast').send({
      type: 'broadcast',
      event: 'test',
      payload: { message: 'test' },
    })

    // Wait for messages
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Calculate latencies
    const latencies = messageReceived.map((time) => time - broadcastStart)
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length

    expect(subscribeTime).toBeLessThan(5000) // Subscribe all within 5s
    expect(avgLatency).toBeLessThan(100) // Avg latency under 100ms
    expect(messageReceived.length).toBeGreaterThan(90) // 90% delivery

    // Cleanup
    channels.forEach((ch) => supabase.removeChannel(ch))
  })
})
```

# Frontend Performance Tests

```tsx
// performance/rendering.test.ts
import { render } from '@testing-library/react'
import { measureRender } from '../helpers/performance'

describe('Component Rendering Performance', () => {
  it('should render dashboard efficiently', async () => {
    const metrics = await measureRender(() => {
      render(<DashboardPage />)
    })

    expect(metrics.renderTime).toBeLessThan(50) // Initial render under 50ms
    expect(metrics.layoutTime).toBeLessThan(20) // Layout under 20ms
  })

  it('should handle large lists efficiently', async () => {
    const largeData = generateCallBatch(1000)

    const metrics = await measureRender(() => {
      render(<CallList calls={largeData} />)
    })

    expect(metrics.renderTime).toBeLessThan(200) // Under 200ms for 1000 items
    expect(metrics.memoryUsage).toBeLessThan(50 * 1024 * 1024) // Under 50MB
  })
})
```

# Memory Performance Tests

```tsx
// performance/memory-usage.test.ts
describe('Memory Usage Tests', () => {
  it('should not leak memory during operations', async () => {
    const initialMemory = performance.memory.usedJSHeapSize

    // Perform operations that might leak
    for (let i = 0; i < 100; i++) {
      const calls = generateCallBatch(100)
      const processed = calls.map((call) => ({
        ...call,
        formatted: formatCallDuration(call.duration),
        quality: calculateQualityScore(call),
      }))

      // Simulate component mounting/unmounting
      const { unmount } = render(<CallList calls={processed} />)
      unmount()
    }

    // Force garbage collection if available
    if (global.gc) global.gc()

    await new Promise((resolve) => setTimeout(resolve, 1000))

    const finalMemory = performance.memory.usedJSHeapSize
    const memoryIncrease = finalMemory - initialMemory

    // Allow for some memory increase but not excessive
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024) // Less than 10MB increase
  })
})
```

# Stress Testing

```tsx
// stress/system-limits.test.ts
describe('System Stress Tests', () => {
  it('should handle burst traffic', async () => {
    const results = await stressTest({
      pattern: 'burst',
      peakUsers: 500,
      duration: '10s',
      rampUp: '1s',
    })

    expect(results.crashPoint).toBeUndefined() // System shouldn't crash
    expect(results.degradationPoint).toBeGreaterThan(300) // Handle 300+ users
  })

  it('should recover from overload', async () => {
    // Overload system
    await stressTest({
      virtualUsers: 1000,
      duration: '30s',
    })

    // Wait for recovery
    await new Promise((resolve) => setTimeout(resolve, 5000))

    // Test normal operation
    const recoveryTest = await loadTest({
      virtualUsers: 10,
      duration: '10s',
      scenario: async () => {
        const response = await fetch('/api/health')
        return response.status
      },
    })

    expect(recoveryTest.successRate).toBe(1) // Full recovery
  })
})
```

# Call Volume Performance

```tsx
// performance/call-volume.test.ts
describe('High Call Volume Performance', () => {
  it('should process high call volume', async () => {
    const callsPerSecond = 50
    const duration = 60 // 1 minute
    const totalCalls = callsPerSecond * duration

    const start = performance.now()
    const results = []

    for (let second = 0; second < duration; second++) {
      const batch = Array.from({ length: callsPerSecond }, () =>
        callService.startCall({
          campaign_id: testCampaigns.active.id,
          supplier_id: testUsers.supplier.id,
          caller_number: generatePhoneNumber(),
        })
      )

      const batchStart = performance.now()
      const batchResults = await Promise.allSettled(batch)
      const batchDuration = performance.now() - batchStart

      results.push({
        second,
        processed: batchResults.filter((r) => r.status === 'fulfilled').length,
        failed: batchResults.filter((r) => r.status === 'rejected').length,
        duration: batchDuration,
      })

      // Wait for next second
      const elapsed = performance.now() - start
      const waitTime = Math.max(0, (second + 1) * 1000 - elapsed)
      await new Promise((resolve) => setTimeout(resolve, waitTime))
    }

    const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0)
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length

    expect(totalProcessed / totalCalls).toBeGreaterThan(0.95) // 95% processed
    expect(avgDuration).toBeLessThan(1000) // Process batch within 1s
  })
})
```

# Performance Benchmarks

```tsx
// benchmarks/operations.bench.ts
import { bench, describe } from 'vitest'

describe('Operation Benchmarks', () => {
  bench('format phone number', () => {
    formatPhoneNumber('4155551234')
  })

  bench('calculate quality score', () => {
    calculateQualityScore(180, true, 0.1)
  })

  bench('validate campaign data', () => {
    campaignSchema.parse(testCampaigns.active)
  })

  bench('generate tracking number', () => {
    generateTrackingNumber()
  })
})
```

# Performance Monitoring

```tsx
// helpers/performance-monitor.ts
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map()

  measure<T>(name: string, fn: () => T): T {
    const start = performance.now()
    const result = fn()
    const duration = performance.now() - start

    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    this.metrics.get(name)!.push(duration)

    return result
  }

  getStats(name: string) {
    const measurements = this.metrics.get(name) || []
    if (measurements.length === 0) return null

    const sorted = [...measurements].sort((a, b) => a - b)
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sorted.reduce((a, b) => a + b, 0) / sorted.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    }
  }
}
```

# Performance Test Configuration

```tsx
// performance.config.ts
export const performanceThresholds = {
  api: {
    avgResponseTime: 500, // ms
    p95ResponseTime: 1000,
    p99ResponseTime: 2000,
    errorRate: 0.01, // 1%
  },
  database: {
    queryTime: 100, // ms
    connectionPoolSize: 20,
  },
  frontend: {
    initialRender: 100, // ms
    reRender: 50,
    bundleSize: 500 * 1024, // 500KB
  },
  realtime: {
    subscriptionTime: 1000, // ms
    messageLatency: 100,
    deliveryRate: 0.99, // 99%
  },
}
```

# Performance Utilities

```tsx
// helpers/load-test.ts
export async function loadTest(options: LoadTestOptions) {
  const results = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    durations: [] as number[],
  }

  const promises = []
  for (let i = 0; i < options.virtualUsers; i++) {
    promises.push(runScenario(options.scenario, i, results))
  }

  await Promise.all(promises)

  return calculateMetrics(results)
}

function calculateMetrics(results: TestResults) {
  const sorted = [...results.durations].sort((a, b) => a - b)
  return {
    successRate: results.successfulRequests / results.totalRequests,
    errorRate: results.failedRequests / results.totalRequests,
    avgResponseTime: sorted.reduce((a, b) => a + b, 0) / sorted.length,
    p95ResponseTime: sorted[Math.floor(sorted.length * 0.95)],
    p99ResponseTime: sorted[Math.floor(sorted.length * 0.99)],
  }
}
```

# CRITICAL RULES

- NO regex in performance tests
- NO any types in test code
- ALWAYS establish baselines first
- ALWAYS test under realistic conditions
- ALWAYS measure before optimizing
- ALWAYS clean up after tests
- TEST both average and worst cases
- MONITOR memory usage
- PROFILE hot code paths
- DOCUMENT performance requirements
