export interface TestCall {
  id: string
  campaignId: string
  supplierId: string
  buyerId: string
  phoneNumber: string
  callerNumber: string
  status: 'ringing' | 'connected' | 'completed' | 'failed' | 'qualified' | 'rejected'
  duration: number
  startTime: string
  endTime?: string
  recordingUrl?: string
  transcription?: string
  qualificationNotes?: string
  payout?: number
  metadata: {
    userAgent?: string
    referrer?: string
    ip?: string
    location?: {
      city: string
      state: string
      country: string
    }
  }
  fraudScore: number
  createdAt: string
  updatedAt: string
}

export interface TestCallWithTracking extends TestCall {
  tracking: {
    events: Array<{
      type: 'dial' | 'ring' | 'connect' | 'disconnect' | 'qualify' | 'reject'
      timestamp: string
      data?: Record<string, unknown>
    }>
    qualityMetrics: {
      audioQuality: number
      connectionStability: number
      backgroundNoise: number
    }
  }
}

export const createTestCall = (overrides: Partial<TestCall> = {}): TestCall => ({
  id: `call_${Math.random().toString(36).substr(2, 9)}`,
  campaignId: `campaign_${Math.random().toString(36).substr(2, 9)}`,
  supplierId: `supplier_${Math.random().toString(36).substr(2, 9)}`,
  buyerId: `buyer_${Math.random().toString(36).substr(2, 9)}`,
  phoneNumber: '+1-555-CAMPAIGN',
  callerNumber: '+1-555-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0'),
  status: 'completed',
  duration: 180,
  startTime: new Date(Date.now() - 300000).toISOString(),
  endTime: new Date().toISOString(),
  payout: 25.00,
  metadata: {
    userAgent: 'Mozilla/5.0 (compatible; TestBot/1.0)',
    referrer: 'https://example.com',
    ip: '192.168.1.100',
    location: {
      city: 'San Francisco',
      state: 'CA',
      country: 'US',
    },
  },
  fraudScore: 0.1,
  createdAt: new Date(Date.now() - 300000).toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

export const createTestCallWithTracking = (
  overrides: Partial<TestCallWithTracking> = {}
): TestCallWithTracking => ({
  ...createTestCall(),
  tracking: {
    events: [
      { type: 'dial', timestamp: new Date(Date.now() - 300000).toISOString() },
      { type: 'ring', timestamp: new Date(Date.now() - 295000).toISOString() },
      { type: 'connect', timestamp: new Date(Date.now() - 290000).toISOString() },
      { type: 'disconnect', timestamp: new Date().toISOString() },
    ],
    qualityMetrics: {
      audioQuality: 0.9,
      connectionStability: 0.95,
      backgroundNoise: 0.1,
    },
  },
  ...overrides,
})

export const testCalls = {
  qualifiedCall: createTestCall({
    status: 'qualified',
    duration: 240,
    payout: 35.00,
    qualificationNotes: 'Customer expressed strong interest, scheduled follow-up',
  }),
  rejectedCall: createTestCall({
    status: 'rejected',
    duration: 45,
    payout: 0,
    qualificationNotes: 'Not interested in service',
  }),
  fraudulentCall: createTestCall({
    status: 'rejected',
    duration: 15,
    payout: 0,
    fraudScore: 0.9,
    qualificationNotes: 'Suspected fraud - very short duration, high fraud score',
  }),
  longCall: createTestCall({
    status: 'qualified',
    duration: 600,
    payout: 50.00,
    qualificationNotes: 'Extended conversation, high purchase intent',
  }),
  failedCall: createTestCall({
    status: 'failed',
    duration: 0,
    payout: 0,
    endTime: undefined,
    qualificationNotes: 'Call failed to connect',
  }),
}