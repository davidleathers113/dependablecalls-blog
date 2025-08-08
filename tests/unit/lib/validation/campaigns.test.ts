import { describe, it, expect } from 'vitest'
import {
  campaignBasicInfoSchema,
  campaignTargetingSchema,
  campaignBudgetScheduleSchema,
  campaignCallHandlingSchema,
  campaignReviewSchema,
  createCampaignSchema,
  updateCampaignSchema
} from '../../../../src/lib/validation/campaigns'

describe('Campaign Validation Schemas', () => {
  describe('campaignBasicInfoSchema', () => {
    it('should validate basic campaign information', () => {
      const validData = {
        name: 'Test Campaign',
        description: 'A test campaign for validation',
        vertical: 'home_improvement' as const,
        subVertical: 'plumbing',
        campaignType: 'inbound' as const,
        callIntent: 'sales' as const,
        priority: 'medium' as const
      }

      const result = campaignBasicInfoSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should require campaign name', () => {
      const invalidData = {
        vertical: 'home_improvement' as const,
        campaignType: 'inbound' as const,
        callIntent: 'sales' as const
      }

      const result = campaignBasicInfoSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.path.includes('name'))).toBe(true)
      }
    })

    it('should validate campaign name length', () => {
      const tooShort = {
        name: 'A',
        vertical: 'insurance' as const,
        campaignType: 'outbound' as const,
        callIntent: 'leads' as const
      }

      const result = campaignBasicInfoSchema.safeParse(tooShort)
      expect(result.success).toBe(false)
    })

    it('should accept valid verticals', () => {
      const validVerticals = [
        'home_improvement',
        'insurance',
        'legal',
        'financial',
        'healthcare',
        'automotive',
        'real_estate',
        'solar',
        'pest_control',
        'security',
        'other'
      ]

      validVerticals.forEach(vertical => {
        const data = {
          name: 'Test Campaign',
          vertical: vertical as const,
          campaignType: 'inbound' as const,
          callIntent: 'sales' as const
        }

        const result = campaignBasicInfoSchema.safeParse(data)
        expect(result.success).toBe(true)
      })
    })
  })

  describe('campaignTargetingSchema', () => {
    it('should validate geographic targeting', () => {
      const validData = {
        targetStates: ['CA', 'NY', 'TX'],
        excludedStates: ['FL'],
        targetZipCodes: ['90210', '10001'],
        radius: 50,
        population: {
          min: 10000,
          max: 100000
        },
        demographics: {
          ageMin: 25,
          ageMax: 65,
          gender: 'any' as const,
          incomeMin: 50000,
          incomeMax: 150000
        }
      }

      const result = campaignTargetingSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should require at least one target state', () => {
      const invalidData = {
        targetStates: [],
        excludedStates: []
      }

      const result = campaignTargetingSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.path.includes('targetStates'))).toBe(true)
      }
    })

    it('should validate population range', () => {
      const invalidData = {
        targetStates: ['CA'],
        population: {
          min: 100000,
          max: 50000 // max less than min
        }
      }

      const result = campaignTargetingSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should validate age range', () => {
      const invalidData = {
        targetStates: ['NY'],
        demographics: {
          ageMin: 65,
          ageMax: 25, // max less than min
          gender: 'any' as const
        }
      }

      const result = campaignTargetingSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('campaignBudgetScheduleSchema', () => {
    it('should validate budget and schedule', () => {
      const validData = {
        dailyBudget: 100,
        monthlyBudget: 3000,
        totalBudget: 10000,
        bidAmount: 15,
        targetCPA: 50,
        maxCPA: 100,
        schedule: {
          timezone: 'America/New_York' as const,
          daysOfWeek: ['monday', 'tuesday', 'wednesday'] as const,
          startTime: '09:00',
          endTime: '17:00',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31')
        },
        budgetPacing: 'standard' as const,
        bidStrategy: 'manual' as const
      }

      const result = campaignBudgetScheduleSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should require minimum daily budget', () => {
      const invalidData = {
        dailyBudget: 5, // below minimum of 10
        bidAmount: 15,
        schedule: {
          timezone: 'America/New_York' as const,
          daysOfWeek: ['monday'] as const,
          startTime: '09:00',
          endTime: '17:00',
          startDate: new Date('2024-01-01')
        }
      }

      const result = campaignBudgetScheduleSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should validate time range', () => {
      const invalidData = {
        dailyBudget: 100,
        bidAmount: 15,
        schedule: {
          timezone: 'America/Chicago' as const,
          daysOfWeek: ['friday'] as const,
          startTime: '17:00',
          endTime: '09:00', // end before start
          startDate: new Date('2024-01-01')
        }
      }

      const result = campaignBudgetScheduleSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should require at least one day of week', () => {
      const invalidData = {
        dailyBudget: 100,
        bidAmount: 15,
        schedule: {
          timezone: 'America/Los_Angeles' as const,
          daysOfWeek: [], // empty array
          startTime: '09:00',
          endTime: '17:00',
          startDate: new Date('2024-01-01')
        }
      }

      const result = campaignBudgetScheduleSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('campaignCallHandlingSchema', () => {
    it('should validate call handling configuration', () => {
      const validData = {
        trackingNumbers: [{
          number: '(555) 123-4567', // Will be transformed to 5551234567
          provider: 'Test Provider',
          active: true
        }],
        callRouting: {
          type: 'direct' as const,
          destinations: [{
            phone: '(555) 987-6543',
            weight: 100,
            priority: 1,
            name: 'Main Office',
            active: true
          }]
        },
        callSettings: {
          recordCalls: true,
          transcribeCalls: false,
          callDurationMin: 30,
          callDurationMax: 1800,
          simultaneousCalls: 5,
          callQueueTimeout: 60
        },
        qualityFilters: {
          duplicateWindow: 24,
          requireCallerID: false,
          blockInternational: true,
          blockPayphones: true,
          minCallDuration: 30,
          allowRepeats: false
        },
        webhooks: []
      }

      const result = campaignCallHandlingSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should require at least one tracking number', () => {
      const invalidData = {
        trackingNumbers: [], // empty
        callRouting: {
          type: 'direct' as const,
          destinations: [{
            phone: '(555) 987-6543',
            weight: 100,
            priority: 1,
            name: 'Main Office',
            active: true
          }]
        },
        callSettings: {
          recordCalls: false,
          transcribeCalls: false,
          callDurationMin: 30,
          callDurationMax: 1800,
          simultaneousCalls: 1,
          callQueueTimeout: 60
        },
        qualityFilters: {
          duplicateWindow: 24,
          requireCallerID: false,
          blockInternational: true,
          blockPayphones: true,
          minCallDuration: 30,
          allowRepeats: false
        }
      }

      const result = campaignCallHandlingSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should require at least one call destination', () => {
      const invalidData = {
        trackingNumbers: [{
          number: '(555) 123-4567',
          provider: 'Test Provider',
          active: true
        }],
        callRouting: {
          type: 'round_robin' as const,
          destinations: [] // empty
        },
        callSettings: {
          recordCalls: false,
          transcribeCalls: false,
          callDurationMin: 30,
          callDurationMax: 1800,
          simultaneousCalls: 1,
          callQueueTimeout: 60
        },
        qualityFilters: {
          duplicateWindow: 24,
          requireCallerID: false,
          blockInternational: true,
          blockPayphones: true,
          minCallDuration: 30,
          allowRepeats: false
        }
      }

      const result = campaignCallHandlingSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('campaignReviewSchema', () => {
    it('should validate review confirmation', () => {
      const validData = {
        confirmAccuracy: true,
        acceptTerms: true,
        launchImmediately: true,
        testMode: false,
        notes: 'Ready to launch'
      }

      const result = campaignReviewSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should require accuracy confirmation', () => {
      const invalidData = {
        confirmAccuracy: false,
        acceptTerms: true
      }

      const result = campaignReviewSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.path.includes('confirmAccuracy'))).toBe(true)
      }
    })

    it('should require terms acceptance', () => {
      const invalidData = {
        confirmAccuracy: true,
        acceptTerms: false
      }

      const result = campaignReviewSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.path.includes('acceptTerms'))).toBe(true)
      }
    })
  })

  describe('updateCampaignSchema', () => {
    it('should validate campaign updates', () => {
      const validData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'paused' as const,
        name: 'Updated Campaign Name',
        dailyBudget: 150,
        bidAmount: 20
      }

      const result = updateCampaignSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should require valid UUID for campaign ID', () => {
      const invalidData = {
        id: 'invalid-uuid',
        status: 'active' as const
      }

      const result = updateCampaignSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.path.includes('id'))).toBe(true)
      }
    })

    it('should allow partial updates', () => {
      const partialData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'active' as const
      }

      const result = updateCampaignSchema.safeParse(partialData)
      expect(result.success).toBe(true)
    })
  })

  describe('createCampaignSchema (complete)', () => {
    it('should validate complete campaign creation', () => {
      const validData = {
        // Basic info
        name: 'Complete Test Campaign',
        description: 'A complete test campaign',
        vertical: 'insurance' as const,
        campaignType: 'both' as const,
        callIntent: 'sales' as const,
        priority: 'high' as const,
        
        // Targeting
        targetStates: ['CA', 'NY'],
        excludedStates: [],
        targetZipCodes: [],
        excludedZipCodes: [],
        
        // Budget & Schedule
        dailyBudget: 200,
        bidAmount: 25,
        schedule: {
          timezone: 'America/New_York' as const,
          daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const,
          startTime: '08:00',
          endTime: '18:00',
          startDate: new Date('2024-01-01')
        },
        budgetPacing: 'standard' as const,
        bidStrategy: 'manual' as const,
        
        // Call handling
        trackingNumbers: [{
          number: '(800) 555-1234',
          provider: 'CallRail',
          active: true
        }],
        callRouting: {
          type: 'round_robin' as const,
          destinations: [{
            phone: '(555) 123-4567',
            weight: 100,
            priority: 1,
            name: 'Sales Team',
            active: true
          }]
        },
        callSettings: {
          recordCalls: true,
          transcribeCalls: true,
          callDurationMin: 30,
          callDurationMax: 1200,
          simultaneousCalls: 3,
          callQueueTimeout: 45
        },
        qualityFilters: {
          duplicateWindow: 48,
          requireCallerID: true,
          blockInternational: true,
          blockPayphones: true,
          minCallDuration: 45,
          allowRepeats: false
        },
        
        // Review
        confirmAccuracy: true,
        acceptTerms: true,
        launchImmediately: false,
        testMode: true
      }

      const result = createCampaignSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should fail validation with missing required fields', () => {
      const incompleteData = {
        name: 'Incomplete Campaign'
        // Missing most required fields
      }

      const result = createCampaignSchema.safeParse(incompleteData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0)
      }
    })
  })
})