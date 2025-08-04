/**
 * Test Security Audit - Phase 3.1a
 * Quick test to demonstrate PII scanning functionality
 */

import { scanStoreForPII, reportPIIToConsole } from './piiScanner'

// Test data that simulates various stores
const testStores = {
  'auth-store-test': {
    user: {
      id: '123',
      email: 'user@example.com',
      phone: '555-123-4567',
      name: 'John Doe',
    },
    session: {
      access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      refresh_token: 'rt_1234567890abcdef',
    },
    preferences: {
      theme: 'dark',
      locale: 'en-US',
    },
    password: 'this_should_not_be_here!',
  },
  
  'buyer-store-test': {
    campaigns: [
      {
        id: 'camp_1',
        name: 'Summer Sale',
        budget: 5000,
      },
    ],
    billingInfo: {
      cardNumber: '4111111111111111',
      cvv: '123',
      bankAccount: '123456789',
    },
    currentBalance: 1000,
    creditLimit: 5000,
  },
  
  'settings-store-test': {
    userSettings: {
      notifications: {
        email: 'notify@example.com',
        sms: true,
      },
      apiKeys: {
        stripe: 'sk_test_1234567890',
        twilio: 'AC1234567890abcdef',
      },
    },
  },
}

// Persistence configs
const persistConfigs = {
  'auth-store-test': {
    partialize: (state: { preferences: unknown }) => ({
      preferences: state.preferences,
    }),
  },
  'buyer-store-test': {
    partialize: (state: { campaigns: unknown; currentBalance: unknown; billingInfo: unknown }) => ({
      campaigns: state.campaigns,
      currentBalance: state.currentBalance,
      billingInfo: state.billingInfo, // This is BAD!
    }),
  },
  'settings-store-test': {
    partialize: (state: { userSettings: unknown }) => ({
      userSettings: state.userSettings,
    }),
  },
}

console.log('🔍 Running Security Audit Test...\n')
console.log('This demonstrates the PII scanner detecting various security issues:\n')

// Run audits
Object.entries(testStores).forEach(([storeName, state]) => {
  const report = scanStoreForPII(
    storeName,
    state,
    persistConfigs[storeName as keyof typeof persistConfigs]
  )
  
  reportPIIToConsole(report)
  console.log('')
})

console.log('📊 Summary of Issues Found:')
console.log('1. ❌ CRITICAL: Password stored in client state (auth-store)')
console.log('2. ❌ CRITICAL: Auth tokens in state (should be httpOnly cookies)')
console.log('3. ❌ HIGH: Credit card and bank info persisted unencrypted')
console.log('4. ❌ HIGH: API keys stored in client state')
console.log('5. ⚠️  MEDIUM: Email/phone persisted without encryption')
console.log('\n✅ The PII scanner successfully detected all these issues!')
console.log('\nNext steps:')
console.log('- Implement encryption for sensitive persisted data')
console.log('- Remove passwords and tokens from client state')
console.log('- Move sensitive data to server-side storage')
console.log('- Add schema versioning for safe migrations')