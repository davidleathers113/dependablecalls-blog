# Test Organization & Strategy

# Test Structure
```
tests/
├── unit/           # Component and utility tests
├── integration/    # API and workflow tests
├── e2e/           # End-to-end user flows
├── performance/   # Load and stress tests
└── fixtures/      # Shared test data
```

# Testing Tools
- Vitest: Unit and integration testing
- Testing Library: React component testing
- Playwright: End-to-end testing
- jsdom: DOM environment for Vitest

# Test Commands
- `npm test` - Run unit tests
- `npm run test:ci` - CI tests with coverage
- `npm run test:ui` - Visual test interface
- `npm run test:e2e` - Playwright E2E tests
- `npm run test:e2e:ui` - Playwright UI mode

# Coverage Requirements
- **90% minimum** code coverage
- Cover all critical business logic
- Test error conditions and edge cases
- Verify real-time functionality
- Test role-based access control

# Test File Naming
- Unit: `*.test.tsx` or `*.test.ts`
- Integration: `*.integration.test.ts`
- E2E: `*.spec.ts`
- Fixtures: descriptive names in `/fixtures/`

# Test Categories

## Unit Tests (`/unit/`)
- Component rendering and interaction
- Utility functions and helpers
- Store actions and state changes
- Custom hooks behavior
- Form validation logic

## Integration Tests (`/integration/`)
- API endpoint interactions
- Database operations
- Webhook processing
- Third-party service mocks
- Multi-component workflows

## E2E Tests (`/e2e/`)
- Complete user journeys
- Authentication flows
- Campaign creation/management
- Call tracking workflows
- Payment processing
- Cross-browser compatibility

## Performance Tests (`/performance/`)
- Real-time connection handling
- High-volume call processing
- Database query optimization
- Frontend rendering performance

# Test Data Management
- Use fixtures for consistent test data
- Mock external APIs in unit/integration tests
- Use test database for E2E tests
- Clean up test data after each test run

# DCE-Specific Test Scenarios
- Supplier registration and verification
- Buyer campaign setup and management
- Call routing and tracking accuracy
- Fraud detection algorithms
- Payment processing and payouts
- Real-time dashboard updates

# CI/CD Integration
- All tests must pass before deployment
- Generate coverage reports
- Run E2E tests in multiple browsers
- Performance regression detection
- Automated visual regression testing

# Test Environment Setup
- Separate test database instance
- Mock Stripe webhooks
- Test Supabase configuration
- Environment variable management
- Seed data for consistent testing

# Accessibility Testing
- Screen reader compatibility
- Keyboard navigation
- Color contrast validation
- ARIA label verification
- Focus management testing

# CRITICAL RULES
- NO regex in test code
- NO any types in test assertions
- ALWAYS clean up after tests
- ALWAYS test error conditions
- ALWAYS mock external dependencies
- MINIMUM 90% code coverage required
- TEST real-time features thoroughly
- VERIFY security and authorization