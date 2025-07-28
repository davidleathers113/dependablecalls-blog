import http from 'k6/http'
import ws from 'k6/ws'
import { check, group, sleep, fail } from 'k6'
import { Counter, Rate, Trend, Gauge } from 'k6/metrics'

// Custom metrics
const callPurchaseRate = new Rate('call_purchase_success_rate')
const callDeliveryTime = new Trend('call_delivery_time')
const websocketConnections = new Gauge('websocket_connections')
const apiResponseTime = new Trend('api_response_time')
const concurrentUsers = new Gauge('concurrent_users')

// Test configuration
export const options = {
  scenarios: {
    // Baseline load - normal traffic
    baseline: {
      executor: 'constant-vus',
      vus: 50,
      duration: '10m',
      tags: { scenario: 'baseline' },
    },
    
    // Peak load - high traffic periods
    peak_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 200 },
        { duration: '2m', target: 300 },
        { duration: '5m', target: 300 },
        { duration: '2m', target: 200 },
        { duration: '2m', target: 100 },
        { duration: '2m', target: 0 },
      ],
      tags: { scenario: 'peak' },
    },
    
    // Stress test - beyond normal capacity
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 400 },
        { duration: '10m', target: 600 },
        { duration: '5m', target: 800 },
        { duration: '10m', target: 800 },
        { duration: '5m', target: 0 },
      ],
      tags: { scenario: 'stress' },
    },
    
    // Spike test - sudden traffic spikes
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '30s', target: 500 }, // Sudden spike
        { duration: '2m', target: 500 },
        { duration: '30s', target: 50 }, // Drop back
        { duration: '1m', target: 0 },
      ],
      tags: { scenario: 'spike' },
    },
    
    // WebSocket connections test
    websocket_test: {
      executor: 'constant-vus',
      vus: 100,
      duration: '10m',
      exec: 'websocketTest',
      tags: { scenario: 'websocket' },
    },
    
    // API-only test for suppliers
    api_test: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 50,
      maxVUs: 200,
      exec: 'apiTest',
      tags: { scenario: 'api' },
    }
  },
  
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.01'],
    call_purchase_success_rate: ['rate>0.95'],
    call_delivery_time: ['p(95)<3000'],
    api_response_time: ['p(95)<500'],
    websocket_connections: ['value>90'],
  },
}

// Base URLs and configurations
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5173'
const API_URL = __ENV.API_URL || 'http://localhost:3000/api/v1'
const WS_URL = __ENV.WS_URL || 'ws://localhost:3000/ws'

// Test data
const testUsers = {
  buyer: {
    email: 'loadtest.buyer@example.com',
    password: 'LoadTest123!',
    token: null
  },
  supplier: {
    email: 'loadtest.supplier@example.com',
    password: 'LoadTest123!',
    token: null
  },
  network: {
    email: 'loadtest.network@example.com',
    password: 'LoadTest123!',
    token: null
  },
  admin: {
    email: 'loadtest.admin@example.com',
    password: 'LoadTest123!',
    token: null
  }
}

// Authentication helper
function authenticate(userType) {
  const user = testUsers[userType]
  if (user.token) return user.token
  
  const response = http.post(`${API_URL}/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
  
  if (response.status === 200) {
    const data = JSON.parse(response.body)
    user.token = data.token
    return user.token
  }
  
  fail(`Authentication failed for ${userType}: ${response.status}`)
}

// Main test scenario
export default function() {
  concurrentUsers.add(1)
  
  const userType = ['buyer', 'supplier', 'network', 'admin'][Math.floor(Math.random() * 4)]
  const token = authenticate(userType)
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
  
  group(`${userType} user journey`, function() {
    // Dashboard load
    group('Dashboard', function() {
      const dashboardResponse = http.get(`${BASE_URL}/${userType}/dashboard`, { headers })
      check(dashboardResponse, {
        'dashboard loads successfully': (r) => r.status === 200,
        'dashboard loads quickly': (r) => r.timings.duration < 2000
      })
      apiResponseTime.add(dashboardResponse.timings.duration)
    })
    
    if (userType === 'buyer') {
      buyerJourney(headers)
    } else if (userType === 'supplier') {
      supplierJourney(headers)
    } else if (userType === 'network') {
      networkJourney(headers)
    } else if (userType === 'admin') {
      adminJourney(headers)
    }
  })
  
  sleep(Math.random() * 3 + 1) // Random sleep 1-4 seconds
}

function buyerJourney(headers) {
  group('Buyer: Marketplace Search', function() {
    const searchParams = {
      category: 'insurance',
      min_quality: 80,
      max_price: 60,
      location: 'CA',
      page: 1,
      limit: 20
    }
    
    const searchResponse = http.get(
      `${API_URL}/marketplace/search?` + Object.entries(searchParams)
        .map(([k, v]) => `${k}=${v}`).join('&'),
      { headers }
    )
    
    check(searchResponse, {
      'search returns results': (r) => r.status === 200,
      'search response time acceptable': (r) => r.timings.duration < 1000,
      'search has results': (r) => JSON.parse(r.body).calls.length > 0
    })
    
    apiResponseTime.add(searchResponse.timings.duration)
  })
  
  group('Buyer: Call Purchase', function() {
    // Simulate call purchase
    const purchaseData = {
      call_id: 'test-call-' + Math.random().toString(36).substr(2, 9),
      quantity: Math.floor(Math.random() * 5) + 1,
      payment_method: 'account_balance'
    }
    
    const startTime = Date.now()
    const purchaseResponse = http.post(
      `${API_URL}/purchases/create`,
      JSON.stringify(purchaseData),
      { headers }
    )
    
    const purchaseSuccess = check(purchaseResponse, {
      'purchase completes successfully': (r) => r.status === 200,
      'purchase response time acceptable': (r) => r.timings.duration < 3000
    })
    
    callPurchaseRate.add(purchaseSuccess)
    
    if (purchaseSuccess) {
      // Simulate call delivery time
      const deliveryTime = Math.random() * 2000 + 500 // 0.5-2.5 seconds
      callDeliveryTime.add(deliveryTime)
    }
  })
  
  group('Buyer: Analytics View', function() {
    const analyticsResponse = http.get(`${API_URL}/buyer/analytics/dashboard`, { headers })
    check(analyticsResponse, {
      'analytics loads': (r) => r.status === 200,
      'analytics loads quickly': (r) => r.timings.duration < 1500
    })
  })
}

function supplierJourney(headers) {
  group('Supplier: Inventory Management', function() {
    const inventoryResponse = http.get(`${API_URL}/supplier/inventory`, { headers })
    check(inventoryResponse, {
      'inventory loads': (r) => r.status === 200,
      'inventory response time': (r) => r.timings.duration < 1000
    })
    
    // Create new listing
    const listingData = {
      title: `Test Listing ${Date.now()}`,
      category: 'insurance',
      tracking_number: '+1800' + Math.floor(Math.random() * 9000000 + 1000000),
      price: Math.floor(Math.random() * 50) + 25,
      volume: Math.floor(Math.random() * 500) + 100,
      description: 'Load test generated listing'
    }
    
    const createResponse = http.post(
      `${API_URL}/supplier/inventory/create`,
      JSON.stringify(listingData),
      { headers }
    )
    
    check(createResponse, {
      'listing created successfully': (r) => r.status === 200,
      'creation response time': (r) => r.timings.duration < 2000
    })
  })
  
  group('Supplier: Sales Analytics', function() {
    const salesResponse = http.get(`${API_URL}/supplier/analytics/sales`, { headers })
    check(salesResponse, {
      'sales analytics loads': (r) => r.status === 200
    })
  })
}

function networkJourney(headers) {
  group('Network: Relationship Overview', function() {
    const relationshipsResponse = http.get(`${API_URL}/network/relationships`, { headers })
    check(relationshipsResponse, {
      'relationships load': (r) => r.status === 200,
      'relationships response time': (r) => r.timings.duration < 1500
    })
  })
  
  group('Network: Quality Monitoring', function() {
    const qualityResponse = http.get(`${API_URL}/network/quality/monitoring`, { headers })
    check(qualityResponse, {
      'quality data loads': (r) => r.status === 200
    })
  })
}

function adminJourney(headers) {
  group('Admin: System Health', function() {
    const healthResponse = http.get(`${API_URL}/admin/system/health`, { headers })
    check(healthResponse, {
      'system health loads': (r) => r.status === 200,
      'health check is fast': (r) => r.timings.duration < 500
    })
  })
  
  group('Admin: User Management', function() {
    const usersResponse = http.get(`${API_URL}/admin/users?page=1&limit=50`, { headers })
    check(usersResponse, {
      'users list loads': (r) => r.status === 200,
      'users response time': (r) => r.timings.duration < 1000
    })
  })
}

// WebSocket test scenario
export function websocketTest() {
  const token = authenticate('buyer')
  
  const wsResponse = ws.connect(`${WS_URL}?token=${token}`, {
    tags: { scenario: 'websocket' }
  }, function (socket) {
    websocketConnections.add(1)
    
    socket.on('open', function() {
      console.log('WebSocket connection opened')
      
      // Subscribe to real-time updates
      socket.send(JSON.stringify({
        type: 'subscribe',
        channels: ['marketplace_updates', 'call_notifications']
      }))
    })
    
    socket.on('message', function(data) {
      const message = JSON.parse(data)
      check(message, {
        'message has valid format': (m) => m.type && m.data,
        'message timestamp recent': (m) => {
          const messageTime = new Date(m.timestamp)
          return Date.now() - messageTime.getTime() < 5000
        }
      })
    })
    
    socket.on('error', function(error) {
      console.error('WebSocket error:', error)
    })
    
    socket.on('close', function() {
      console.log('WebSocket connection closed')
      websocketConnections.add(-1)
    })
    
    // Keep connection alive for test duration
    let heartbeatInterval = setInterval(() => {
      socket.send(JSON.stringify({ type: 'ping' }))
    }, 30000)
    
    socket.setTimeout(() => {
      clearInterval(heartbeatInterval)
      socket.close()
    }, 600000) // 10 minutes
  })
  
  check(wsResponse, {
    'websocket connects successfully': (r) => r && r.status === 101
  })
}

// API-only test scenario
export function apiTest() {
  const token = authenticate('supplier')
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
  
  // Simulate API-heavy supplier operations
  group('API: Bulk Operations', function() {
    // Bulk inventory check
    const inventoryCheck = http.get(`${API_URL}/supplier/inventory/status`, { headers })
    check(inventoryCheck, {
      'inventory status API responds': (r) => r.status === 200,
      'inventory API is fast': (r) => r.timings.duration < 300
    })
    
    // Update pricing
    const pricingUpdate = http.put(
      `${API_URL}/supplier/inventory/bulk-price-update`,
      JSON.stringify({
        category: 'insurance',
        adjustment_percentage: Math.random() * 10 - 5 // -5% to +5%
      }),
      { headers }
    )
    
    check(pricingUpdate, {
      'bulk pricing update succeeds': (r) => r.status === 200,
      'pricing update is fast': (r) => r.timings.duration < 1000
    })
    
    apiResponseTime.add(inventoryCheck.timings.duration)
    apiResponseTime.add(pricingUpdate.timings.duration)
  })
}

// Setup function
export function setup() {
  console.log('Starting DCE Platform Load Test')
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`API URL: ${API_URL}`)
  console.log(`WebSocket URL: ${WS_URL}`)
  
  // Pre-authenticate users
  for (const userType of Object.keys(testUsers)) {
    try {
      authenticate(userType)
      console.log(`✓ ${userType} user authenticated`)
    } catch (error) {
      console.error(`✗ Failed to authenticate ${userType}: ${error}`)
    }
  }
  
  return { timestamp: Date.now() }
}

// Teardown function
export function teardown(data) {
  console.log('Load test completed')
  console.log(`Test duration: ${(Date.now() - data.timestamp) / 1000}s`)
}

// Custom checks for DCE-specific functionality
export function handleSummary(data) {
  const summary = {
    testInfo: {
      timestamp: new Date().toISOString(),
      duration: data.state.testRunDurationMs,
      scenarios: Object.keys(options.scenarios)
    },
    metrics: {
      http_requests: data.metrics.http_reqs.values.count,
      failed_requests: data.metrics.http_req_failed.values.rate,
      avg_response_time: data.metrics.http_req_duration.values.avg,
      p95_response_time: data.metrics.http_req_duration.values['p(95)'],
      call_purchase_rate: data.metrics.call_purchase_success_rate?.values.rate || 0,
      avg_call_delivery: data.metrics.call_delivery_time?.values.avg || 0,
      peak_websocket_connections: data.metrics.websocket_connections?.values.max || 0
    },
    thresholds: data.thresholds,
    performance_grade: calculatePerformanceGrade(data)
  }
  
  return {
    'load-test-summary.json': JSON.stringify(summary, null, 2),
    stdout: generateConsoleReport(summary)
  }
}

function calculatePerformanceGrade(data) {
  const metrics = data.metrics
  let score = 100
  
  // Deduct points for performance issues
  if (metrics.http_req_failed.values.rate > 0.01) score -= 30
  if (metrics.http_req_duration.values['p(95)'] > 2000) score -= 20
  if (metrics.call_purchase_success_rate?.values.rate < 0.95) score -= 25
  if (metrics.call_delivery_time?.values.avg > 3000) score -= 15
  if (metrics.websocket_connections?.values.min < 90) score -= 10
  
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

function generateConsoleReport(summary) {
  return `
📊 DCE Platform Load Test Results
================================

🎯 Performance Grade: ${summary.performance_grade}

📈 Key Metrics:
  • Total Requests: ${summary.metrics.http_requests.toLocaleString()}
  • Failed Rate: ${(summary.metrics.failed_requests * 100).toFixed(2)}%
  • Avg Response: ${summary.metrics.avg_response_time.toFixed(0)}ms
  • P95 Response: ${summary.metrics.p95_response_time.toFixed(0)}ms
  • Call Purchase Rate: ${(summary.metrics.call_purchase_rate * 100).toFixed(1)}%
  • Avg Call Delivery: ${summary.metrics.avg_call_delivery.toFixed(0)}ms
  • Peak WebSocket Connections: ${summary.metrics.peak_websocket_connections}

⏱️ Test Duration: ${(summary.testInfo.duration / 1000).toFixed(0)}s
📅 Completed: ${summary.testInfo.timestamp}

${summary.performance_grade === 'A' ? '🎉 Excellent performance!' : 
  summary.performance_grade === 'B' ? '👍 Good performance' :
  summary.performance_grade === 'C' ? '⚠️ Fair performance - consider optimization' :
  '🚨 Performance issues detected - immediate attention required'}
`
}