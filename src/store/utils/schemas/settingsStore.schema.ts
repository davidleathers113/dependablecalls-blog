/**
 * Settings Store Schema Definitions - Phase 3.1b
 * Versioned schemas for settings state persistence
 */

import { z } from 'zod'
import { registerSchema } from './index'

// User settings schema
const UserSettingsSchema = z.object({
  version: z.number().default(1),
  updatedAt: z.string(),
  profile: z.object({
    displayName: z.string().optional(),
    timezone: z.string().default('UTC'),
    language: z.string().default('en'),
    dateFormat: z.string().default('MM/DD/YYYY'),
    timeFormat: z.enum(['12h', '24h']).default('12h'),
  }).optional(),
  notifications: z.object({
    email: z.object({
      enabled: z.boolean().default(true),
      frequency: z.enum(['immediate', 'hourly', 'daily', 'weekly']).default('immediate'),
      campaigns: z.boolean().default(true),
      billing: z.boolean().default(true),
      system: z.boolean().default(true),
      marketing: z.boolean().default(false),
    }).optional(),
    push: z.object({
      enabled: z.boolean().default(false),
      campaigns: z.boolean().default(false),
      billing: z.boolean().default(true),
      system: z.boolean().default(true),
    }).optional(),
    sms: z.object({
      enabled: z.boolean().default(false),
      campaigns: z.boolean().default(false),
      billing: z.boolean().default(false),
      emergency: z.boolean().default(true),
    }).optional(),
  }).optional(),
  privacy: z.object({
    dataSharing: z.boolean().default(false),
    analytics: z.boolean().default(true),
    marketing: z.boolean().default(false),
    thirdPartyIntegrations: z.boolean().default(true),
  }).optional(),
  dashboard: z.object({
    layout: z.enum(['compact', 'standard', 'expanded']).default('standard'),
    widgets: z.array(z.string()).default([]),
    refreshInterval: z.number().default(30000),
    showWelcome: z.boolean().default(true),
  }).optional(),
})

// Base role settings schema
const BaseRoleSettingsSchema = z.object({
  version: z.number(),
  updatedAt: z.string(),
})

// Supplier settings schema
const SupplierSettingsSchema = BaseRoleSettingsSchema.extend({
  callRouting: z.object({
    defaultStrategy: z.enum(['round_robin', 'priority', 'geographic', 'time_based']).default('round_robin'),
    timeoutDuration: z.number().default(30),
    maxConcurrentCalls: z.number().default(10),
    businessHours: z.object({
      enabled: z.boolean().default(true),
      timezone: z.string().default('UTC'),
      schedule: z.record(z.object({
        enabled: z.boolean(),
        start: z.string(),
        end: z.string(),
      })).default({}),
      holidays: z.array(z.string()).default([]),
    }).optional(),
    geographicRouting: z.object({
      enabled: z.boolean().default(false),
      regions: z.array(z.object({
        name: z.string(),
        states: z.array(z.string()),
        priority: z.number(),
      })).default([]),
    }).optional(),
  }).optional(),
  qualityControl: z.object({
    callRecording: z.object({
      enabled: z.boolean().default(true),
      retention: z.number().default(90),
      transcription: z.boolean().default(false),
    }).optional(),
    qualityScoring: z.object({
      enabled: z.boolean().default(true),
      autoScore: z.boolean().default(false),
      minScore: z.number().default(70),
      reviewThreshold: z.number().default(80),
    }).optional(),
    fraudDetection: z.object({
      enabled: z.boolean().default(true),
      strictMode: z.boolean().default(false),
      autoBlock: z.boolean().default(false),
    }).optional(),
  }).optional(),
  leadSources: z.object({
    tracking: z.object({
      utmParameters: z.boolean().default(true),
      customParameters: z.array(z.string()).default([]),
      landingPageTracking: z.boolean().default(true),
    }).optional(),
    validation: z.object({
      required: z.array(z.string()).default([]),
      customValidation: z.record(z.unknown()).default({}),
    }).optional(),
  }).optional(),
  payouts: z.object({
    schedule: z.enum(['daily', 'weekly', 'bi_weekly', 'monthly']).default('weekly'),
    minimum: z.number().default(100),
    method: z.enum(['ach', 'wire', 'check', 'paypal']).default('ach'),
    currency: z.string().default('USD'),
  }).optional(),
})

// Buyer settings schema
const BuyerSettingsSchema = BaseRoleSettingsSchema.extend({
  campaigns: z.object({
    autoOptimization: z.object({
      enabled: z.boolean().default(false),
      bidAdjustment: z.boolean().default(false),
      pauseLowPerformers: z.boolean().default(false),
      threshold: z.number().default(0.1),
    }).optional(),
    budgetManagement: z.object({
      dailyBudgetCap: z.boolean().default(true),
      autoReplenish: z.boolean().default(false),
      alertThreshold: z.number().default(0.8),
    }).optional(),
    qualityFilters: z.object({
      minQualityScore: z.number().default(70),
      duplicateDetection: z.boolean().default(true),
      geographicFiltering: z.boolean().default(false),
      timeBasedFiltering: z.boolean().default(false),
    }).optional(),
  }).optional(),
  billing: z.object({
    paymentMethod: z.enum(['credit_card', 'ach', 'wire', 'check']).default('credit_card'),
    billingCycle: z.enum(['daily', 'weekly', 'monthly']).default('monthly'),
    autoRecharge: z.object({
      enabled: z.boolean().default(false),
      threshold: z.number().default(100),
      amount: z.number().default(1000),
    }).optional(),
    invoicing: z.object({
      frequency: z.enum(['weekly', 'monthly']).default('monthly'),
      format: z.enum(['pdf', 'csv']).default('pdf'),
      delivery: z.enum(['email', 'portal']).default('email'),
    }).optional(),
  }).optional(),
  reporting: z.object({
    defaultDateRange: z.enum(['today', 'yesterday', 'last_7_days', 'last_30_days', 'last_90_days']).default('last_7_days'),
    autoReports: z.object({
      enabled: z.boolean().default(false),
      frequency: z.enum(['daily', 'weekly', 'monthly']).default('weekly'),
      recipients: z.array(z.string()).default([]),
    }).optional(),
    customMetrics: z.array(z.string()).default([]),
  }).optional(),
})

// Network settings schema
const NetworkSettingsSchema = BaseRoleSettingsSchema.extend({
  branding: z.object({
    logo: z.string().optional(),
    colors: z.object({
      primary: z.string().default('#0066cc'),
      secondary: z.string().default('#666666'),
      accent: z.string().default('#ff6600'),
    }).optional(),
    customDomain: z.string().optional(),
  }).optional(),
  commissions: z.object({
    supplierRate: z.number().default(0.7),
    buyerRate: z.number().default(0.25),
    networkRate: z.number().default(0.05),
    minimumPayout: z.number().default(50),
  }).optional(),
  policies: z.object({
    qualityStandards: z.array(z.string()).default([]),
    fraudPrevention: z.object({
      strictMode: z.boolean().default(true),
      autoSuspension: z.boolean().default(false),
      reviewRequired: z.boolean().default(true),
    }).optional(),
  }).optional(),
})

// Admin settings schema
const AdminSettingsSchema = BaseRoleSettingsSchema.extend({
  permissions: z.object({
    fullAccess: z.boolean().default(false),
    modules: z.array(z.string()).default([]),
    dataAccess: z.enum(['none', 'read', 'write', 'full']).default('read'),
    userManagement: z.boolean().default(false),
    systemConfiguration: z.boolean().default(false),
    billingAccess: z.boolean().default(false),
  }),
  systemConfig: z.object({
    platformSettings: z.object({
      siteName: z.string().default(''),
      siteUrl: z.string().default(''),
      supportEmail: z.string().default(''),
      timezone: z.string().default('UTC'),
      maintenanceMode: z.boolean().default(false),
    }),
    securityPolicies: z.array(z.unknown()).default([]),
    integrationSettings: z.object({
      providers: z.record(z.unknown()).default({}),
      limits: z.record(z.unknown()).default({}),
      defaults: z.record(z.unknown()).default({}),
    }),
    featureFlags: z.array(z.unknown()).default([]),
    rateLimits: z.array(z.unknown()).default([]),
  }),
  auditLog: z.object({
    enabled: z.boolean().default(true),
    retention: z.number().default(90),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    includeReadOperations: z.boolean().default(false),
    sensitiveDataMasking: z.boolean().default(true),
    exportFormat: z.enum(['json', 'csv']).default('json'),
  }),
  monitoring: z.object({
    healthChecks: z.array(z.unknown()).default([]),
    alertChannels: z.array(z.unknown()).default([]),
    performanceMetrics: z.object({
      sampleRate: z.number().default(1),
      metrics: z.array(z.unknown()).default([]),
      thresholds: z.record(z.unknown()).default({}),
    }),
    errorTracking: z.object({
      provider: z.string().default(''),
      projectId: z.string().default(''),
      environment: z.string().default('production'),
      sampleRate: z.number().default(1),
    }),
    uptimeMonitoring: z.object({
      monitors: z.array(z.unknown()).default([]),
      statusPage: z.boolean().default(false),
    }),
  }),
  maintenance: z.object({
    maintenanceWindow: z.object({
      dayOfWeek: z.number().default(0),
      startHour: z.number().default(0),
      duration: z.number().default(0),
      timezone: z.string().default('UTC'),
    }),
    backupSchedule: z.object({
      frequency: z.enum(['hourly', 'daily', 'weekly']).default('daily'),
      retention: z.number().default(30),
      location: z.string().default(''),
      encryption: z.boolean().default(true),
    }),
    updatePolicy: z.object({
      autoUpdate: z.boolean().default(false),
      schedule: z.enum(['manual', 'scheduled']).default('manual'),
      testing: z.boolean().default(true),
      rollback: z.boolean().default(true),
    }),
    disasterRecovery: z.object({
      rpo: z.number().default(24),
      rto: z.number().default(4),
      backupRegions: z.array(z.string()).default([]),
      testFrequency: z.enum(['monthly', 'quarterly', 'annually']).default('quarterly'),
    }),
  }),
})

// Union of all role settings
const RoleSettingsSchema = z.union([
  SupplierSettingsSchema,
  BuyerSettingsSchema,
  NetworkSettingsSchema,
  AdminSettingsSchema,
])

// Full settings state schema
const SettingsStateSchema = z.object({
  userSettings: UserSettingsSchema.nullable(),
  roleSettings: RoleSettingsSchema.nullable(),
  isLoading: z.boolean(),
  isSaving: z.boolean(),
  isDirty: z.boolean(),
  error: z.string().nullable(),
  lastSaved: z.string().nullable(),
})

// Persisted settings data schema (only user settings and lastSaved)
const SettingsPersistedSchema = z.object({
  userSettings: UserSettingsSchema.nullable(),
  lastSaved: z.string().nullable(),
})

// Register version 1 of settings store schema
registerSchema(
  'settings-store',
  1,
  SettingsPersistedSchema,
  {
    createdAt: new Date().toISOString(),
    description: 'Initial settings store schema - persists user settings and timestamps',
    isBreaking: false,
  },
  ['userSettings', 'lastSaved']
)

// Export schemas
export {
  UserSettingsSchema,
  SupplierSettingsSchema,
  BuyerSettingsSchema,
  NetworkSettingsSchema,
  AdminSettingsSchema,
  RoleSettingsSchema,
  SettingsStateSchema,
  SettingsPersistedSchema,
}

// Export types
export type UserSettings = z.infer<typeof UserSettingsSchema>
export type SupplierSettings = z.infer<typeof SupplierSettingsSchema>
export type BuyerSettings = z.infer<typeof BuyerSettingsSchema>
export type NetworkSettings = z.infer<typeof NetworkSettingsSchema>
export type AdminSettings = z.infer<typeof AdminSettingsSchema>
export type RoleSettings = z.infer<typeof RoleSettingsSchema>
export type SettingsState = z.infer<typeof SettingsStateSchema>
export type SettingsPersisted = z.infer<typeof SettingsPersistedSchema>