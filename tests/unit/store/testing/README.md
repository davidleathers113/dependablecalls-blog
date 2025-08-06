# DCE Store Testing Infrastructure

Comprehensive testing infrastructure for the DCE Zustand store architecture, providing complete coverage of store operations, state machine validation, cross-store integration testing, and performance benchmarking.

## 📁 Structure

```
src/store/testing/
├── README.md                 # This documentation
├── index.ts                  # Main entry point and orchestrator
├── storeTestUtils.ts         # Core testing utilities and helpers
├── integrationTests.ts       # Cross-store interaction tests
├── propertyTests.ts          # Property-based state machine tests
├── benchmarks.ts             # Performance testing suite
├── vitest.config.ts          # Test configuration
└── setup.ts                  # Global test setup and mocks
```

## 🧪 Testing Categories

### 1. Store Test Utilities (`storeTestUtils.ts`)
Core utilities for testing individual Zustand stores:

- **Store Wrapper Creation**: Setup and teardown helpers
- **Mock Data Generators**: Realistic test data factories
- **State Assertion Utilities**: Custom assertions for store state
- **Performance Tracking**: Memory usage and execution time monitoring
- **Integration Helpers**: Cross-store testing utilities

```typescript
import { createStoreTestWrapper, createStateAssertions } from '@/store/testing'

const authWrapper = createStoreTestWrapper(useAuthStore, {
  storeName: 'auth-test',
  trackPerformance: true,
  trackStateChanges: true
})

const assertions = createStateAssertions(authWrapper)
assertions.expectStateProperty('isAuthenticated', false)
```

### 2. Integration Tests (`integrationTests.ts`)
Cross-store interaction and synchronization testing:

- **Auth Flow Integration**: Login/logout across all stores  
- **Blog Store Coordination**: Editor, filter, and UI store sync
- **Navigation State Management**: Menu and preference sync
- **Real-time Data Updates**: Cross-store event propagation
- **Error Handling**: Recovery and cleanup scenarios
- **Performance Under Load**: Concurrent store operations

```typescript
await runCrossStoreTest({
  name: 'auth-sync-test',
  store1: authWrapper,
  store2: settingsWrapper,
  setup: async () => { /* test setup */ },
  execute: async () => { /* test execution */ },
  verify: async () => { /* assertions */ }
})
```

### 3. Property-Based Tests (`propertyTests.ts`)
Randomized testing for state machine validation:

- **Modal State Machines**: Blog, campaign, and UI modals
- **Navigation State Machines**: Mobile menu, sidebar, dropdowns
- **Wizard State Machines**: Multi-step campaign creation
- **Invariant Validation**: State consistency guarantees
- **Edge Case Discovery**: Randomized transition sequences

```typescript
const modalStateTest: StateTransitionTest = {
  stateName: 'modal-state-machine',
  initialState: { type: null },
  validTransitions: {
    'null': ['open_create', 'open_edit', 'open_delete'],
    'create': ['close', 'cancel', 'confirm']
  },
  invariants: [
    (state) => validTypes.includes(state.type) || 'Invalid modal type'
  ]
}

const result = await runPropertyTest(modalStateTest, {
  iterations: 500,
  maxTransitions: 20,
  validateInvariants: true
})
```

### 4. Performance Benchmarks (`benchmarks.ts`)
Comprehensive performance testing and profiling:

- **Store Operation Benchmarks**: CRUD, subscriptions, selectors
- **Memory Usage Profiling**: Leak detection and optimization
- **Scalability Testing**: High-load scenarios
- **Selector Performance**: Complex query optimization
- **Concurrent Operations**: Race condition testing

```typescript
const benchmarkRunner = new BenchmarkRunner()

const suite = await benchmarkRunner.runBenchmarkSuite('Auth Store', [
  {
    config: {
      name: 'login-operation',
      iterations: 1000,
      targetOpsPerSecond: 500,
      maxMemoryMB: 5
    },
    fn: () => authWrapper.store.getState().login(mockUser, session)
  }
])
```

## 🚀 Getting Started

### Installation

The testing infrastructure is already set up. To run tests:

```bash
# Run all store tests
npm test

# Run specific test suites
npm run test:stores
npm run test:integration  
npm run test:property
npm run test:benchmarks

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Basic Usage

```typescript
import { 
  createStoreTestWrapper, 
  mockDataGenerators,
  runCrossStoreTest 
} from '@/store/testing'

describe('My Store Tests', () => {
  let storeWrapper: ReturnType<typeof createStoreTestWrapper>

  beforeEach(() => {
    storeWrapper = createStoreTestWrapper(useMyStore, {
      storeName: 'my-store-test',
      trackPerformance: true
    })
  })

  afterEach(() => {
    storeWrapper.cleanup()
  })

  it('should handle user login', () => {
    const mockUser = mockDataGenerators.authState().user
    
    act(() => {
      storeWrapper.store.getState().login(mockUser)
    })

    expect(storeWrapper.getState().isAuthenticated).toBe(true)
  })
})
```

## 📊 Test Configuration

### Coverage Targets
- **Stores Covered**: 100%
- **Functions**: 90%  
- **Branches**: 85%
- **Lines**: 90%

### Performance Targets
- **Store Operations**: < 5ms average
- **Selector Execution**: < 1ms average  
- **Memory Leaks**: < 10MB increase
- **Operations/Second**: > 100 ops/sec

### Quality Gates
Tests must pass these thresholds before commits:
- **Integration Tests**: 95% pass rate
- **Property Tests**: 90% pass rate  
- **Benchmark Tests**: 80% pass rate

## 🔧 Configuration

### Test Environment Variables
```bash
NODE_ENV=test
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=test-anon-key
VITE_ENABLE_DEV_TOOLS=true
```

### Vitest Configuration
The `vitest.config.ts` file provides optimized settings for:
- **Test Discovery**: Automatic test file detection
- **Coverage Reporting**: Detailed HTML and JSON reports
- **Performance Monitoring**: Built-in benchmarking
- **Mock Configuration**: External service mocking
- **Parallel Execution**: Multi-threaded test runs

### Test Presets
Pre-configured test environments for different scenarios:

```typescript
// Unit tests - fast, isolated
import { TEST_PRESETS } from './vitest.config'
defineConfig(TEST_PRESETS.unit)

// Integration tests - with setup/teardown  
defineConfig(TEST_PRESETS.integration)

// Property tests - comprehensive validation
defineConfig(TEST_PRESETS.property)

// Benchmark tests - performance focused
defineConfig(TEST_PRESETS.benchmark)

// CI/CD optimized
defineConfig(TEST_PRESETS.ci)
```

## 🎯 Custom Matchers

Extended Jest/Vitest matchers for store-specific assertions:

```typescript
// Store validation
expect(store).toHaveValidStoreState()
expect(store).toHaveStoreAction('login')
expect(store).toHaveStateProperty('isAuthenticated', true)

// State machine validation  
expect(transition).toBeValidStateTransition('closed', 'open')
expect(modalState).toHaveValidModal()

// Performance validation
expect(operationTime).toMeetPerformanceThreshold(5) // ms
```

## 📈 Monitoring and Reporting

### Test Orchestrator
The `DCETestingOrchestrator` class provides centralized test execution:

```typescript
import DCETestingOrchestrator from '@/store/testing'

const orchestrator = new DCETestingOrchestrator()

// Run complete test suite
await orchestrator.runFullTestSuite()

// Get detailed results
const results = orchestrator.getTestResults()
```

### CI/CD Integration
Built-in helpers for continuous integration:

```typescript
import { CI_HELPERS } from '@/store/testing'

// Generate JUnit XML for CI systems
const junitReport = CI_HELPERS.generateJUnitReport(testResults)

// Export metrics for monitoring
const metrics = CI_HELPERS.exportMetrics(results)

// Skip tests for minor changes
const { skip, reason } = CI_HELPERS.shouldSkipTests(changedFiles)
```

### Quality Gates
Pre-commit validation ensures code quality:

```typescript
import { runPreCommitQualityGate } from '@/store/testing'

// In your pre-commit hook
const passed = await runPreCommitQualityGate()
if (!passed) {
  process.exit(1)
}
```

## 🧰 Mock Services

All external services are automatically mocked for testing:

- **Supabase**: Database operations, auth, real-time
- **Stripe**: Payment processing and webhooks  
- **Analytics**: Event tracking and user identification
- **React Router**: Navigation and routing
- **Date/Time**: Consistent time-based testing

## 🔍 Debugging Tests

### Performance Profiling
```typescript
// Enable performance tracking
const wrapper = createStoreTestWrapper(useStore, {
  trackPerformance: true
})

// Get performance summary
const perfSummary = wrapper.getPerformanceSummary()
console.log(`Average operation time: ${perfSummary.avgDuration}ms`)
```

### State Change Tracking
```typescript
// Enable state change tracking
const wrapper = createStoreTestWrapper(useStore, {
  trackStateChanges: true  
})

// View state history
const history = wrapper.getStateHistory()
console.log(`${history.length} state changes recorded`)
```

### Test Utilities
Global utilities available in all tests:

```typescript
// Wait for conditions
await testUtils.waitFor(() => store.getState().loaded)

// Generate test data
const user = testUtils.generateTestData.user({ role: 'admin' })

// Mock network conditions
testUtils.mockNetworkConditions('offline')
```

## 📚 Best Practices

### 1. Test Organization
- **One store per test file**: `authStore.test.ts`
- **Group related tests**: `describe('Authentication Flow')`
- **Clear test names**: `'should authenticate user and update all stores'`

### 2. Test Data Management  
- **Use mock data generators**: Consistent, realistic test data
- **Avoid hardcoded values**: Use factories and generators
- **Reset state between tests**: Clean slate for each test

### 3. Assertion Strategy
- **Test behavior, not implementation**: Focus on what, not how
- **Use custom matchers**: More readable and maintainable tests
- **Validate side effects**: Check all state changes and integrations

### 4. Performance Testing
- **Set realistic targets**: Based on actual usage patterns
- **Test worst-case scenarios**: High load and edge cases
- **Monitor memory usage**: Prevent leaks and optimize allocation

### 5. Property Testing
- **Define clear invariants**: What should always be true  
- **Use meaningful generators**: Realistic random data
- **Validate edge cases**: Property tests excel at finding bugs

## 🤝 Contributing

When adding new stores or modifying existing ones:

1. **Add comprehensive tests** for all new functionality
2. **Update integration tests** if stores interact  
3. **Add property tests** for any state machines
4. **Include benchmarks** for performance-critical operations
5. **Maintain coverage targets** above the specified thresholds

### Test Checklist
- [ ] Unit tests for all store actions and selectors
- [ ] Integration tests for cross-store interactions  
- [ ] Property tests for state machine transitions
- [ ] Performance benchmarks for critical operations
- [ ] Mock data generators for new entities
- [ ] Custom matchers for domain-specific assertions
- [ ] Documentation updates for new test utilities

## 📖 Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Zustand Testing Guide](https://github.com/pmndrs/zustand#testing)
- [Property-Based Testing](https://hypothesis.works/articles/what-is-property-based-testing/)
- [Performance Testing Best Practices](https://web.dev/performance-testing/)

---

This testing infrastructure provides comprehensive coverage and validation for the DCE store architecture, ensuring reliability, performance, and maintainability as the application scales.