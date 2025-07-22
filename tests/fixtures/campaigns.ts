export interface TestCampaign {
  id: string
  name: string
  buyerId: string
  status: 'active' | 'paused' | 'ended' | 'draft'
  payout: number
  category: string
  description: string
  requirements: {
    minCallDuration: number
    allowedStates: string[]
    workingHours: {
      start: string
      end: string
      timezone: string
    }
    blacklistedPhones: string[]
  }
  budget: {
    daily: number
    total: number
    spent: number
  }
  createdAt: string
  updatedAt: string
}

export interface TestCampaignWithMetrics extends TestCampaign {
  metrics: {
    totalCalls: number
    qualifiedCalls: number
    conversionRate: number
    avgCallDuration: number
    totalSpent: number
  }
}

export const createTestCampaign = (overrides: Partial<TestCampaign> = {}): TestCampaign => ({
  id: `campaign_${Math.random().toString(36).substr(2, 9)}`,
  name: `Test Campaign ${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
  buyerId: `buyer_${Math.random().toString(36).substr(2, 9)}`,
  status: 'active',
  payout: 25.00,
  category: 'Home Services',
  description: 'High-quality leads for home improvement services',
  requirements: {
    minCallDuration: 60,
    allowedStates: ['CA', 'NY', 'TX', 'FL'],
    workingHours: {
      start: '08:00',
      end: '18:00',
      timezone: 'America/New_York',
    },
    blacklistedPhones: [],
  },
  budget: {
    daily: 1000,
    total: 10000,
    spent: 0,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

export const createTestCampaignWithMetrics = (
  overrides: Partial<TestCampaignWithMetrics> = {}
): TestCampaignWithMetrics => ({
  ...createTestCampaign(),
  metrics: {
    totalCalls: 150,
    qualifiedCalls: 120,
    conversionRate: 0.8,
    avgCallDuration: 180,
    totalSpent: 3000,
  },
  ...overrides,
})

export const testCampaigns = {
  activeCampaign: createTestCampaign({
    name: 'Premium Home Services',
    payout: 35.00,
    status: 'active',
    category: 'Home Services',
  }),
  pausedCampaign: createTestCampaign({
    name: 'Auto Insurance Leads',
    payout: 45.00,
    status: 'paused',
    category: 'Insurance',
  }),
  draftCampaign: createTestCampaign({
    name: 'Solar Installation',
    payout: 75.00,
    status: 'draft',
    category: 'Energy',
  }),
  highPayoutCampaign: createTestCampaign({
    name: 'Legal Services',
    payout: 125.00,
    status: 'active',
    category: 'Legal',
  }),
}