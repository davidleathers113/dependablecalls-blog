export interface TestUser {
  id: string
  email: string
  password: string
  firstName: string
  lastName: string
  userType: 'supplier' | 'buyer' | 'admin'
  isActive: boolean
  createdAt: string
}

export interface TestSupplier extends TestUser {
  userType: 'supplier'
  company: string
  trafficSources: string[]
  phoneNumbers: string[]
  payoutMethods: string[]
}

export interface TestBuyer extends TestUser {
  userType: 'buyer'
  company: string
  industry: string
  creditLimit: number
  paymentMethods: string[]
}

export interface TestAdmin extends TestUser {
  userType: 'admin'
  permissions: string[]
  lastLoginAt: string
}

export const createTestUser = (overrides: Partial<TestUser> = {}): TestUser => ({
  id: `user_${Math.random().toString(36).substr(2, 9)}`,
  email: `test${Math.random().toString(36).substr(2, 5)}@example.com`,
  password: 'TestPassword123!',
  firstName: 'Test',
  lastName: 'User',
  userType: 'supplier',
  isActive: true,
  createdAt: new Date().toISOString(),
  ...overrides,
})

export const createTestSupplier = (overrides: Partial<TestSupplier> = {}): TestSupplier => ({
  ...createTestUser({ userType: 'supplier' }),
  company: 'Test Traffic Co',
  trafficSources: ['Google Ads', 'Facebook', 'SEO'],
  phoneNumbers: ['+1-555-0123'],
  payoutMethods: ['ACH', 'PayPal'],
  ...overrides,
})

export const createTestBuyer = (overrides: Partial<TestBuyer> = {}): TestBuyer => ({
  ...createTestUser({ userType: 'buyer' }),
  company: 'Test Business Inc',
  industry: 'Home Services',
  creditLimit: 10000,
  paymentMethods: ['Credit Card', 'ACH'],
  ...overrides,
})

export const createTestAdmin = (overrides: Partial<TestAdmin> = {}): TestAdmin => ({
  ...createTestUser({ userType: 'admin' }),
  permissions: ['manage_users', 'manage_campaigns', 'view_reports'],
  lastLoginAt: new Date().toISOString(),
  ...overrides,
})

export const testUsers = {
  activeSupplier: createTestSupplier({
    email: 'supplier@test.com',
    firstName: 'Sarah',
    lastName: 'Supplier',
    company: 'Quality Leads LLC',
  }),
  activeBuyer: createTestBuyer({
    email: 'buyer@test.com',
    firstName: 'Bob',
    lastName: 'Buyer',
    company: 'Home Services Pro',
  }),
  admin: createTestAdmin({
    email: 'admin@test.com',
    firstName: 'Alice',
    lastName: 'Admin',
  }),
}