import { z } from 'zod'
import validator from 'validator'
import {
  emailSchema,
  phoneSchema,
  nameSchema,
  companyNameSchema,
  urlSchema,
  currencyAmountSchema,
  percentageSchema,
  timezoneSchema
} from './common'

/**
 * Settings and configuration form validation schemas
 * Covers account, billing, notification, and system settings
 */

// Bank routing number validation using validator.js
const routingNumberSchema = z
  .string()
  .min(9, 'Routing number must be 9 digits')
  .max(9, 'Routing number must be 9 digits')
  .refine(
    (val) => validator.isNumeric(val),
    { message: 'Routing number must contain only digits' }
  )

// Bank account number validation
const accountNumberSchema = z
  .string()
  .min(4, 'Account number must be at least 4 digits')
  .max(17, 'Account number must be less than 17 digits')
  .refine(
    (val) => validator.isNumeric(val),
    { message: 'Account number must contain only digits' }
  )

// Tax ID validation (flexible format)
const taxIdSchema = z
  .string()
  .min(1, 'Tax ID is required')
  .refine(
    (val) => {
      // Remove all non-alphanumeric characters for validation
      const clean = val.replace(/[^a-zA-Z0-9]/g, '')
      return clean.length >= 9 // Basic length check
    },
    { message: 'Please enter a valid Tax ID' }
  )

// Account settings schema
export const accountSettingsSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  phone: phoneSchema.optional(),
  company: companyNameSchema.optional(),
  jobTitle: z.string().max(100).optional(),
  timezone: timezoneSchema,
  language: z.enum(['en', 'es', 'fr']).default('en'),
  dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']).default('MM/DD/YYYY'),
  timeFormat: z.enum(['12h', '24h']).default('12h'),
  currency: z.enum(['USD', 'EUR', 'GBP', 'CAD']).default('USD')
})

// Profile settings schema
export const profileSettingsSchema = z.object({
  displayName: nameSchema.optional(),
  bio: z.string().max(500).optional(),
  website: urlSchema.optional(),
  linkedIn: urlSchema.optional(),
  avatar: z.string().url().optional(),
  publicProfile: z.boolean().default(false),
  showEmail: z.boolean().default(false),
  showPhone: z.boolean().default(false)
})

// Security settings schema
export const securitySettingsSchema = z.object({
  twoFactorEnabled: z.boolean().default(false),
  twoFactorMethod: z.enum(['totp', 'sms', 'email']).optional(),
  backupCodes: z.array(z.string()).optional(),
  sessionTimeout: z.number().min(15).max(480).default(60), // minutes
  passwordExpiration: z.number().min(30).max(365).default(90), // days
  loginNotifications: z.boolean().default(true),
  securityAlerts: z.boolean().default(true),
  apiKeyRotation: z.enum(['never', 'monthly', 'quarterly', 'annually']).default('quarterly'),
  allowedIPs: z.array(z.string().ip()).optional().default([])
})

// Notification settings schema
export const notificationSettingsSchema = z.object({
  email: z.object({
    campaignUpdates: z.boolean().default(true),
    callAlerts: z.boolean().default(true),
    budgetAlerts: z.boolean().default(true),
    qualityAlerts: z.boolean().default(true),
    weeklyReports: z.boolean().default(true),
    monthlyReports: z.boolean().default(false),
    productUpdates: z.boolean().default(false),
    marketingEmails: z.boolean().default(false)
  }),
  sms: z.object({
    enabled: z.boolean().default(false),
    urgentAlerts: z.boolean().default(false),
    campaignStatus: z.boolean().default(false),
    budgetAlerts: z.boolean().default(false)
  }),
  push: z.object({
    enabled: z.boolean().default(true),
    callUpdates: z.boolean().default(true),
    campaignChanges: z.boolean().default(true),
    qualityIssues: z.boolean().default(true)
  }),
  frequency: z.object({
    digestFrequency: z.enum(['real_time', 'hourly', 'daily', 'weekly']).default('daily'),
    quietHoursEnabled: z.boolean().default(false),
    quietHoursStart: z.string().optional(),
    quietHoursEnd: z.string().optional()
  })
})

// Call tracking settings schema
export const callTrackingSettingsSchema = z.object({
  defaultProvider: z.string().min(1, 'Please select a call tracking provider'),
  trackingNumbers: z.array(z.object({
    number: z.string(),
    provider: z.string(),
    campaigns: z.array(z.string()),
    active: z.boolean()
  })).default([]),
  recordCalls: z.boolean().default(false),
  transcribeCalls: z.boolean().default(false),
  callRecordingRetention: z.number().min(30).max(2555).default(90), // days
  webhookUrl: urlSchema.optional(),
  retryAttempts: z.number().min(0).max(10).default(3),
  timeoutSeconds: z.number().min(5).max(120).default(30),
  dataRetentionDays: z.number().min(30).max(2555).default(90),
  qualityScoring: z.object({
    enabled: z.boolean().default(true),
    minDuration: z.number().min(0).max(300).default(30), // seconds
    requireCallerID: z.boolean().default(false),
    blockRepeats: z.boolean().default(false),
    repeatWindow: z.number().min(1).max(168).default(24) // hours
  }),
  // Provider-specific fields
  providerApiKey: z.string().optional(),
  providerApiSecret: z.string().optional(),
  providerAccountId: z.string().optional()
})

// Payout settings schema
export const payoutSettingsSchema = z.object({
  preferredMethod: z.enum(['bank_transfer', 'wire', 'paypal', 'check'], {
    errorMap: () => ({ message: 'Please select a payout method' })
  }),
  minimumPayout: currencyAmountSchema.min(10, 'Minimum payout must be at least $10'),
  payoutSchedule: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'net30'], {
    errorMap: () => ({ message: 'Please select a payout schedule' })
  }),
  holdPeriod: z.number().min(0).max(30).default(3), // days
  bankDetails: z.object({
    accountName: nameSchema,
    bankName: z.string().min(1, 'Bank name is required'),
    routingNumber: routingNumberSchema,
    accountNumber: accountNumberSchema,
    accountType: z.enum(['checking', 'savings']).default('checking')
  }).optional(),
  taxInformation: z.object({
    taxId: taxIdSchema,
    vatNumber: z.string().optional(),
    taxExempt: z.boolean().default(false),
    w9Filed: z.boolean().default(false),
    businessType: z.enum(['sole_proprietor', 'llc', 'corporation', 'partnership']).optional()
  }),
  invoiceSettings: z.object({
    generateAutomatically: z.boolean().default(true),
    emailTo: z.array(emailSchema).default([]),
    includeDetails: z.boolean().default(true),
    customTemplate: z.string().optional(),
    logoUrl: urlSchema.optional()
  }),
  // Form-specific confirmation fields
  confirmAccountNumber: z.string().optional(),
  confirmRoutingNumber: z.string().optional(),
  acceptTerms: z.boolean().refine(
    (val) => val === true,
    { message: 'You must accept the terms to save payout settings' }
  )
}).refine(
  (data) => {
    // If bank_transfer is selected and bank details exist, validate confirmation fields
    if (data.preferredMethod === 'bank_transfer' && data.bankDetails) {
      return data.bankDetails.accountNumber === data.confirmAccountNumber &&
             data.bankDetails.routingNumber === data.confirmRoutingNumber
    }
    return true
  },
  {
    message: 'Account and routing number confirmations must match',
    path: ['confirmAccountNumber']
  }
)

// Billing settings schema
export const billingSettingsSchema = z.object({
  billingAddress: z.object({
    company: companyNameSchema.optional(),
    address1: z.string().min(1, 'Address is required'),
    address2: z.string().optional(),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(2, 'State is required'),
    zipCode: z.string().min(5, 'ZIP code is required'),
    country: z.string().default('US')
  }),
  paymentMethod: z.enum(['credit_card', 'bank_transfer', 'invoice'], {
    errorMap: () => ({ message: 'Please select a payment method' })
  }),
  autoRecharge: z.object({
    enabled: z.boolean().default(false),
    threshold: currencyAmountSchema.default(100),
    amount: currencyAmountSchema.default(500)
  }),
  creditLimit: currencyAmountSchema.optional(),
  prepaidBalance: currencyAmountSchema.optional(),
  taxExempt: z.boolean().default(false),
  poNumber: z.string().max(50).optional(),
  billingContact: z.object({
    name: nameSchema.optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional()
  }).optional()
})

// Quality standards schema
export const qualityStandardsSchema = z.object({
  callDuration: z.object({
    minimum: z.number().min(0).max(300).default(30), // seconds
    target: z.number().min(30).max(1800).default(120),
    maximum: z.number().min(60).max(3600).default(1800)
  }).refine(
    (data) => data.minimum <= data.target && data.target <= data.maximum,
    { message: 'Duration values must be in ascending order' }
  ),
  callQuality: z.object({
    minimumScore: percentageSchema.min(50).default(70),
    requireCallerID: z.boolean().default(false),
    blockInternational: z.boolean().default(true),
    allowMobile: z.boolean().default(true),
    allowLandline: z.boolean().default(true)
  }),
  duplicateHandling: z.object({
    allowDuplicates: z.boolean().default(false),
    duplicateWindow: z.number().min(1).max(168).default(24), // hours
    duplicateAction: z.enum(['block', 'flag', 'allow']).default('block')
  }),
  geographicFiltering: z.object({
    allowInternational: z.boolean().default(false),
    blockedCountries: z.array(z.string()).default([]),
    allowedStates: z.array(z.string()).default([]),
    blockedStates: z.array(z.string()).default([])
  }),
  timeFiltering: z.object({
    businessHoursOnly: z.boolean().default(false),
    timezone: timezoneSchema.optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    allowWeekends: z.boolean().default(true)
  })
})

// API settings schema
export const apiSettingsSchema = z.object({
  apiKeys: z.array(z.object({
    name: z.string().min(1, 'API key name is required'),
    key: z.string(),
    permissions: z.array(z.enum([
      'read_campaigns',
      'write_campaigns',
      'read_calls',
      'write_calls',
      'read_reports',
      'admin'
    ])).min(1, 'Please select at least one permission'),
    active: z.boolean().default(true),
    expiresAt: z.date().optional()
  })).default([]),
  webhookEndpoints: z.array(z.object({
    url: urlSchema,
    events: z.array(z.string()).min(1, 'Please select at least one event'),
    secret: z.string().optional(),
    active: z.boolean().default(true)
  })).default([]),
  rateLimits: z.object({
    requestsPerMinute: z.number().min(10).max(1000).default(100),
    requestsPerHour: z.number().min(100).max(10000).default(1000),
    burstLimit: z.number().min(10).max(200).default(50)
  }),
  ipWhitelist: z.array(z.string().ip()).optional().default([])
})

// Campaign defaults schema
export const campaignDefaultsSchema = z.object({
  defaultBudget: currencyAmountSchema.default(100),
  defaultBidAmount: currencyAmountSchema.default(10),
  defaultTargetCPA: currencyAmountSchema.optional(),
  defaultTimezone: timezoneSchema,
  defaultSchedule: z.object({
    daysOfWeek: z.array(z.string()).default(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']),
    startTime: z.string().default('09:00'),
    endTime: z.string().default('17:00')
  }),
  defaultQualityFilters: z.object({
    minCallDuration: z.number().min(0).max(300).default(30),
    requireCallerID: z.boolean().default(false),
    blockInternational: z.boolean().default(true),
    allowRepeats: z.boolean().default(false)
  }),
  autoApproval: z.object({
    enabled: z.boolean().default(false),
    maxBudget: currencyAmountSchema.optional(),
    maxBidAmount: currencyAmountSchema.optional(),
    requireReview: z.boolean().default(true)
  })
})

// Type exports for form integration
export type AccountSettingsFormData = z.infer<typeof accountSettingsSchema>
export type ProfileSettingsFormData = z.infer<typeof profileSettingsSchema>
export type SecuritySettingsFormData = z.infer<typeof securitySettingsSchema>
export type NotificationSettingsFormData = z.infer<typeof notificationSettingsSchema>
export type CallTrackingSettingsFormData = z.infer<typeof callTrackingSettingsSchema>
export type PayoutSettingsFormData = z.infer<typeof payoutSettingsSchema>
export type BillingSettingsFormData = z.infer<typeof billingSettingsSchema>
export type QualityStandardsFormData = z.infer<typeof qualityStandardsSchema>
export type ApiSettingsFormData = z.infer<typeof apiSettingsSchema>
export type CampaignDefaultsFormData = z.infer<typeof campaignDefaultsSchema>

// Legacy exports for backward compatibility (type aliases only)
export type { CallTrackingSettingsFormData as CallTrackingFormData }
export type { PayoutSettingsFormData as PayoutFormData }