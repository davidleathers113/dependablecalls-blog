import { z } from 'zod'
import {
  nameSchema,
  descriptionSchema,
  currencyAmountSchema,
  percentageSchema,
  phoneSchema,
  urlSchema,
  zipCodeSchema,
  stateCodeSchema,
  timeSchema,
  timezoneSchema,
  campaignStatusSchema,
  verticalSchema
} from './common'

/**
 * Campaign creation and management validation schemas
 * Multi-step form validation for campaign wizard
 */

// Basic campaign information (Step 1)
export const campaignBasicInfoSchema = z.object({
  name: nameSchema.refine(
    (val) => val.length >= 3 && val.length <= 100,
    { message: 'Campaign name must be between 3 and 100 characters' }
  ),
  description: descriptionSchema,
  vertical: verticalSchema,
  subVertical: z.string().max(100).optional(),
  campaignType: z.enum(['inbound', 'outbound', 'both'], {
    errorMap: () => ({ message: 'Please select a campaign type' })
  }),
  callIntent: z.enum(['sales', 'leads', 'support', 'survey'], {
    errorMap: () => ({ message: 'Please select the call intent' })
  }),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium')
})

// Targeting and geography (Step 2)
export const campaignTargetingSchema = z.object({
  targetStates: z.array(stateCodeSchema).min(1, 'Please select at least one state'),
  excludedStates: z.array(stateCodeSchema).optional().default([]),
  targetZipCodes: z.array(zipCodeSchema).optional().default([]),
  excludedZipCodes: z.array(zipCodeSchema).optional().default([]),
  radius: z.number().min(0).max(500).optional(),
  population: z.object({
    min: z.number().min(0).optional(),
    max: z.number().min(0).optional()
  }).optional().refine(
    (data) => !data || !data.min || !data.max || data.min <= data.max,
    { message: 'Minimum population must be less than maximum' }
  ),
  demographics: z.object({
    ageMin: z.number().min(18).max(100).optional(),
    ageMax: z.number().min(18).max(100).optional(),
    gender: z.enum(['any', 'male', 'female']).default('any'),
    incomeMin: z.number().min(0).optional(),
    incomeMax: z.number().min(0).optional()
  }).optional().refine(
    (data) => !data || !data.ageMin || !data.ageMax || data.ageMin <= data.ageMax,
    { message: 'Minimum age must be less than maximum age' }
  ).refine(
    (data) => !data || !data.incomeMin || !data.incomeMax || data.incomeMin <= data.incomeMax,
    { message: 'Minimum income must be less than maximum income' }
  )
})

// Budget and schedule (Step 3)
export const campaignBudgetScheduleSchema = z.object({
  dailyBudget: currencyAmountSchema.min(10, 'Daily budget must be at least $10'),
  monthlyBudget: currencyAmountSchema.optional(),
  totalBudget: currencyAmountSchema.optional(),
  bidAmount: currencyAmountSchema.min(1, 'Bid amount must be at least $1'),
  targetCPA: currencyAmountSchema.optional(),
  maxCPA: currencyAmountSchema.optional(),
  
  schedule: z.object({
    timezone: timezoneSchema,
    daysOfWeek: z.array(z.enum([
      'monday', 'tuesday', 'wednesday', 'thursday', 
      'friday', 'saturday', 'sunday'
    ])).min(1, 'Please select at least one day'),
    startTime: timeSchema,
    endTime: timeSchema,
    startDate: z.date().min(new Date(), 'Start date cannot be in the past'),
    endDate: z.date().optional()
  }).refine(
    (data) => {
      // Validate time range
      const [startHour, startMin] = data.startTime.split(':').map(Number)
      const [endHour, endMin] = data.endTime.split(':').map(Number)
      const startMinutes = startHour * 60 + startMin
      const endMinutes = endHour * 60 + endMin
      return startMinutes < endMinutes
    },
    { message: 'Start time must be before end time', path: ['endTime'] }
  ).refine(
    (data) => !data.endDate || data.startDate <= data.endDate,
    { message: 'Start date must be before end date', path: ['endDate'] }
  ),

  budgetPacing: z.enum(['standard', 'accelerated', 'even']).default('standard'),
  bidStrategy: z.enum(['manual', 'auto_maximize_calls', 'target_cpa']).default('manual')
})

// Call handling setup (Step 4)
export const campaignCallHandlingSchema = z.object({
  trackingNumbers: z.array(z.object({
    number: phoneSchema,
    provider: z.string().min(1, 'Provider is required'),
    active: z.boolean().default(true)
  })).min(1, 'Please add at least one tracking number'),

  callRouting: z.object({
    type: z.enum(['direct', 'round_robin', 'weighted', 'priority'], {
      errorMap: () => ({ message: 'Please select a routing type' })
    }),
    destinations: z.array(z.object({
      phone: phoneSchema,
      weight: z.number().min(1).max(100).default(100),
      priority: z.number().min(1).max(10).default(1),
      name: z.string().min(1, 'Destination name is required'),
      active: z.boolean().default(true)
    })).min(1, 'Please add at least one call destination')
  }),

  callSettings: z.object({
    recordCalls: z.boolean().default(false),
    transcribeCalls: z.boolean().default(false),
    callDurationMin: z.number().min(0).max(600).default(30),
    callDurationMax: z.number().min(30).max(3600).default(1800),
    simultaneousCalls: z.number().min(1).max(100).default(5),
    callQueueTimeout: z.number().min(10).max(300).default(60)
  }),

  qualityFilters: z.object({
    duplicateWindow: z.number().min(0).max(168).default(24), // hours
    requireCallerID: z.boolean().default(false),
    blockInternational: z.boolean().default(true),
    blockPayphones: z.boolean().default(true),
    minCallDuration: z.number().min(0).max(600).default(30), // seconds
    allowRepeats: z.boolean().default(false)
  }),

  webhooks: z.array(z.object({
    url: urlSchema,
    events: z.array(z.enum([
      'call_start', 'call_end', 'call_answered', 
      'call_missed', 'call_transferred', 'call_recorded'
    ])).min(1, 'Please select at least one event'),
    active: z.boolean().default(true)
  })).optional().default([])
})

// Review and launch (Step 5)
export const campaignReviewSchema = z.object({
  confirmAccuracy: z.boolean().refine(
    (val) => val === true,
    { message: 'Please confirm that all information is accurate' }
  ),
  acceptTerms: z.boolean().refine(
    (val) => val === true,
    { message: 'You must accept the campaign terms to launch' }
  ),
  launchImmediately: z.boolean().default(true),
  testMode: z.boolean().default(false),
  notes: z.string().max(500).optional()
})

// Complete campaign schema (all steps combined)
export const createCampaignSchema = campaignBasicInfoSchema
  .merge(campaignTargetingSchema)
  .merge(campaignBudgetScheduleSchema)
  .merge(campaignCallHandlingSchema)
  .merge(campaignReviewSchema)

// Campaign update schema (for editing existing campaigns)
export const updateCampaignSchema = z.object({
  id: z.string().uuid('Invalid campaign ID'),
  status: campaignStatusSchema.optional(),
  name: campaignBasicInfoSchema.shape.name.optional(),
  description: descriptionSchema,
  dailyBudget: currencyAmountSchema.optional(),
  bidAmount: currencyAmountSchema.optional(),
  targetStates: z.array(stateCodeSchema).optional(),
  schedule: campaignBudgetScheduleSchema.shape.schedule.optional(),
  callSettings: campaignCallHandlingSchema.shape.callSettings.optional(),
  lastModified: z.date().default(new Date())
})

// Campaign duplication schema
export const duplicateCampaignSchema = z.object({
  sourceCampaignId: z.string().uuid('Invalid source campaign ID'),
  newName: nameSchema.refine(
    (val) => val.length >= 3 && val.length <= 100,
    { message: 'Campaign name must be between 3 and 100 characters' }
  ),
  copySettings: z.object({
    targeting: z.boolean().default(true),
    budget: z.boolean().default(false),
    schedule: z.boolean().default(true),
    callHandling: z.boolean().default(true),
    qualityFilters: z.boolean().default(true)
  }),
  modifyBudget: z.boolean().default(false),
  newDailyBudget: currencyAmountSchema.optional()
}).refine(
  (data) => !data.modifyBudget || data.newDailyBudget,
  {
    message: 'New daily budget is required when modifying budget',
    path: ['newDailyBudget']
  }
)

// Campaign performance goals schema
export const campaignGoalsSchema = z.object({
  targetCallVolume: z.number().min(1, 'Target call volume must be at least 1 per day'),
  targetConversionRate: percentageSchema.optional(),
  targetCostPerCall: currencyAmountSchema.optional(),
  targetRevenue: currencyAmountSchema.optional(),
  qualityThreshold: percentageSchema.min(50, 'Quality threshold must be at least 50%').default(80)
})

// Campaign bulk actions schema
export const bulkCampaignActionSchema = z.object({
  campaignIds: z.array(z.string().uuid()).min(1, 'Please select at least one campaign'),
  action: z.enum(['pause', 'resume', 'delete', 'duplicate', 'export'], {
    errorMap: () => ({ message: 'Please select a valid action' })
  }),
  confirmDeletion: z.boolean().optional()
}).refine(
  (data) => data.action !== 'delete' || data.confirmDeletion === true,
  {
    message: 'Please confirm deletion of selected campaigns',
    path: ['confirmDeletion']
  }
)

// Type exports for form integration
export type CampaignBasicInfoFormData = z.infer<typeof campaignBasicInfoSchema>
export type CampaignTargetingFormData = z.infer<typeof campaignTargetingSchema>
export type CampaignBudgetScheduleFormData = z.infer<typeof campaignBudgetScheduleSchema>
export type CampaignCallHandlingFormData = z.infer<typeof campaignCallHandlingSchema>
export type CampaignReviewFormData = z.infer<typeof campaignReviewSchema>
export type CreateCampaignFormData = z.infer<typeof createCampaignSchema>
export type UpdateCampaignFormData = z.infer<typeof updateCampaignSchema>
export type DuplicateCampaignFormData = z.infer<typeof duplicateCampaignSchema>
export type CampaignGoalsFormData = z.infer<typeof campaignGoalsSchema>
export type BulkCampaignActionFormData = z.infer<typeof bulkCampaignActionSchema>

// Legacy exports for backward compatibility
export { createCampaignSchema as CreateCampaignSchema }
export type { CreateCampaignFormData as CreateCampaignData }