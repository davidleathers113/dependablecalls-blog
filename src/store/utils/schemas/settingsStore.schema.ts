/**
 * Settings Store Schema Definitions - Phase 3.1b
 * Versioned schemas for settings state persistence
 */

import { z } from 'zod'
import { registerSchema } from './index'

// User settings schema - matches UserSettings interface exactly
const UserSettingsSchema = z.object({
  version: z.number().default(1),
  updatedAt: z.string(),
  // Profile settings - required to match interface
  profile: z.object({
    displayName: z.string().optional(),
    avatarUrl: z.string().optional(),
    bio: z.string().optional(),
    timezone: z.string().default('UTC'),
    language: z.enum(['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja']).default('en'),
    dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD-MMM-YYYY']).default('MM/DD/YYYY'),
    phoneFormat: z.enum(['US', 'International', 'E.164']).default('US'),
    currency: z.enum(['USD', 'EUR', 'GBP', 'CAD', 'AUD']).default('USD'),
  }),
  // User preferences - required to match interface
  preferences: z.object({
    theme: z.enum(['light', 'dark', 'system']).default('system'),
    dashboardLayout: z.enum(['compact', 'expanded', 'custom']).default('expanded'),
    defaultPage: z.string().default('/dashboard'),
    tablePageSize: z.number().default(25),
    soundAlerts: z.boolean().default(true),
    keyboardShortcuts: z.boolean().default(true),
    autoRefresh: z.boolean().default(true),
    refreshInterval: z.number().default(30),
    compactMode: z.boolean().default(false),
    showOnboarding: z.boolean().default(true),
  }),
  // Notifications - required to match interface
  notifications: z.object({
    email: z.object({
      enabled: z.boolean().default(true),
      newCalls: z.boolean().default(true),
      callCompleted: z.boolean().default(false),
      dailySummary: z.boolean().default(true),
      weeklyReport: z.boolean().default(true),
      monthlyReport: z.boolean().default(false),
      campaignAlerts: z.boolean().default(true),
      budgetAlerts: z.boolean().default(true),
      qualityAlerts: z.boolean().default(true),
      fraudAlerts: z.boolean().default(true),
      systemUpdates: z.boolean().default(true),
      marketingEmails: z.boolean().default(false),
    }),
    browser: z.object({
      enabled: z.boolean().default(true),
      newCalls: z.boolean().default(true),
      callStatus: z.boolean().default(true),
      campaignAlerts: z.boolean().default(true),
      systemAlerts: z.boolean().default(true),
      sound: z.boolean().default(true),
      vibrate: z.boolean().default(false),
    }),
    sms: z.object({
      enabled: z.boolean().default(false),
      phoneNumber: z.string().optional(),
      urgentOnly: z.boolean().default(true),
      fraudAlerts: z.boolean().default(true),
      systemDowntime: z.boolean().default(true),
      dailyLimit: z.number().default(10),
    }).optional(),
    quietHours: z.object({
      enabled: z.boolean().default(false),
      start: z.string().default('22:00'),
      end: z.string().default('08:00'),
      timezone: z.string().default('UTC'),
      weekendsOnly: z.boolean().default(false),
      excludeUrgent: z.boolean().default(true),
    }).optional(),
    frequency: z.enum(['realtime', 'hourly', 'daily', 'weekly']).default('realtime'),
  }),
  // Security settings - required to match interface
  security: z.object({
    twoFactorEnabled: z.boolean().default(false),
    twoFactorMethod: z.enum(['app', 'sms', 'email']).optional(),
    sessionTimeout: z.number().default(30),
    ipWhitelist: z.array(z.string()).default([]),
    apiAccess: z.boolean().default(false),
    loginNotifications: z.boolean().default(true),
    activityAlerts: z.boolean().default(true),
    dataExportEnabled: z.boolean().default(true),
  }),
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

// Export types - ensure compatibility with TypeScript interface
export type SchemaUserSettings = z.infer<typeof UserSettingsSchema>
export type SupplierSettings = z.infer<typeof SupplierSettingsSchema>
export type BuyerSettings = z.infer<typeof BuyerSettingsSchema>
export type NetworkSettings = z.infer<typeof NetworkSettingsSchema>
export type AdminSettings = z.infer<typeof AdminSettingsSchema>
export type RoleSettings = z.infer<typeof RoleSettingsSchema>
export type SchemaSettingsState = z.infer<typeof SettingsStateSchema>
export type SchemaSettingsPersisted = z.infer<typeof SettingsPersistedSchema>

// Type compatibility check - ensure schema matches interface
// This will cause TypeScript error if schema and interface don't match
export type UserSettingsCompatibilityCheck = SchemaUserSettings extends import('../../../types/settings').UserSettings ? true : false

// Export UserSettings from both schema and interface for consistency
export type UserSettings = z.infer<typeof UserSettingsSchema>