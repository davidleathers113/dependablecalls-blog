/**
 * Phase 4 Performance Optimization: Enhanced TypeScript Definitions
 * 
 * This module provides improved TypeScript definitions to eliminate Json casts
 * and provide better type safety for database operations.
 */

import type { Json } from '../../../types/database-extended'

/**
 * Type-safe JSON serialization utilities
 */
export type JsonValue = string | number | boolean | null | JsonObject | JsonArray
export type JsonObject = Record<string, JsonValue>
export type JsonArray = Array<JsonValue>

/**
 * Safe JSON conversion with proper typing
 */
export const toJsonSafe = <T>(value: T): JsonValue => {
  if (value === null || value === undefined) {
    return null
  }
  
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  
  if (Array.isArray(value)) {
    return value.map(toJsonSafe) as JsonArray
  }
  
  if (typeof value === 'object') {
    const result: JsonObject = {}
    for (const [key, val] of Object.entries(value)) {
      result[key] = toJsonSafe(val)
    }
    return result
  }
  
  // Convert other types to string representation
  return String(value)
}

/**
 * Safe JSON parsing with validation
 */
export const fromJsonSafe = <T>(value: JsonValue, validator?: (val: unknown) => val is T): T | null => {
  if (value === null) {
    return null
  }
  
  if (validator && !validator(value)) {
    console.warn('JSON value failed validation:', value)
    return null
  }
  
  return value as T
}

/**
 * Enhanced database field types
 */
export interface DatabaseField<T> {
  value: T
  json: JsonValue
  isValid: boolean
  lastUpdated: Date
}

export const createDatabaseField = <T>(value: T): DatabaseField<T> => ({
  value,
  json: toJsonSafe(value),
  isValid: true,
  lastUpdated: new Date(),
})

/**
 * Settings field types with proper serialization
 */
export interface SerializableUserSettings {
  version: number
  updatedAt: string
  profile: {
    displayName: string
    avatar: string | null
    timezone: string
    locale: string
  }
  notifications: {
    email: boolean
    push: boolean
    sms: boolean
    frequency: 'realtime' | 'hourly' | 'daily' | 'weekly'
  }
  privacy: {
    profileVisibility: 'public' | 'private' | 'contacts'
    dataSharing: boolean
    analytics: boolean
  }
  preferences: {
    theme: 'light' | 'dark' | 'system'
    compactMode: boolean
    showTutorials: boolean
  }
}

export interface SerializableSupplierSettings {
  version: number
  updatedAt: string
  dashboard: {
    layout: 'compact' | 'detailed' | 'custom'
    defaultTimeRange: '24h' | '7d' | '30d' | '90d'
    showMetrics: string[]
    autoRefresh: boolean
    refreshInterval: number
  }
  inventory: {
    autoPublish: boolean
    qualityThreshold: number
    priceFloor: number
    maxDailyVolume: number
  }
  notifications: {
    lowInventory: boolean
    qualityAlerts: boolean
    paymentUpdates: boolean
    campaignStatus: boolean
  }
  integrations: {
    crm: {
      enabled: boolean
      provider: string | null
      settings: Record<string, JsonValue>
    }
    callTracking: {
      enabled: boolean
      provider: string | null
      settings: Record<string, JsonValue>
    }
  }
  qualitySettings: {
    enableFiltering: boolean
    minCallDuration: number
    blockGeolocations: string[]
    allowedSources: string[]
  }
}

export interface SerializableBuyerSettings {
  version: number
  updatedAt: string
  purchasing: {
    autoApprove: boolean
    budgetAlerts: boolean
    qualityFilters: {
      minRating: number
      excludeGeos: string[]
      allowedVerticals: string[]
    }
  }
  campaigns: {
    defaultBudget: number
    defaultBidding: 'auto' | 'manual'
    pauseOnBudget: boolean
    trackingSettings: {
      pixelId: string | null
      conversionTracking: boolean
      attributionWindow: number
    }
  }
  notifications: {
    budgetAlerts: boolean
    qualityIssues: boolean
    campaignUpdates: boolean
    performanceReports: boolean
  }
  integrations: {
    analytics: {
      enabled: boolean
      provider: string | null
      settings: Record<string, JsonValue>
    }
    attribution: {
      enabled: boolean
      provider: string | null
      settings: Record<string, JsonValue>
    }
  }
}

export interface SerializableNetworkSettings {
  version: number
  updatedAt: string
  commissions: {
    supplierRate: number
    buyerRate: number
    networkFee: number
    paymentTerms: {
      supplier: number
      buyer: number
    }
  }
  quality: {
    enableFiltering: boolean
    autoReject: boolean
    thresholds: {
      minCallDuration: number
      minQualityScore: number
      maxComplaintRate: number
    }
  }
  fraud: {
    enableDetection: boolean
    autoBlock: boolean
    riskThresholds: {
      duplicateRate: number
      velocityLimit: number
      geoRisk: number
    }
  }
  compliance: {
    tcpaCompliance: boolean
    dncCompliance: boolean
    recordingConsent: boolean
    dataRetention: number
  }
}

export interface SerializableAdminSettings {
  version: number
  updatedAt: string
  permissions: {
    fullAccess: boolean
    modules: string[]
    dataAccess: 'full' | 'limited' | 'read-only'
    userManagement: boolean
    systemConfiguration: boolean
    billingAccess: boolean
  }
  systemConfig: {
    platformSettings: {
      siteName: string
      siteUrl: string
      supportEmail: string
      timezone: string
      maintenanceMode: boolean
    }
    securityPolicies: Array<{
      id: string
      name: string
      enabled: boolean
      config: Record<string, JsonValue>
    }>
    integrationSettings: {
      providers: Record<string, JsonValue>
      limits: Record<string, number>
      defaults: Record<string, JsonValue>
    }
    featureFlags: Array<{
      name: string
      enabled: boolean
      rollout: number
      conditions: Record<string, JsonValue>
    }>
    rateLimits: Array<{
      endpoint: string
      limit: number
      window: number
      scope: 'global' | 'user' | 'ip'
    }>
  }
  auditLog: {
    enabled: boolean
    retention: number
    logLevel: 'debug' | 'info' | 'warn' | 'error'
    includeReadOperations: boolean
    sensitiveDataMasking: boolean
    exportFormat: 'json' | 'csv' | 'xml'
  }
  monitoring: {
    healthChecks: Array<{
      name: string
      endpoint: string
      interval: number
      timeout: number
      enabled: boolean
    }>
    alertChannels: Array<{
      type: 'email' | 'slack' | 'webhook'
      config: Record<string, JsonValue>
      enabled: boolean
    }>
    performanceMetrics: {
      sampleRate: number
      metrics: string[]
      thresholds: Record<string, number>
    }
    errorTracking: {
      provider: string
      projectId: string
      environment: string
      sampleRate: number
    }
    uptimeMonitoring: {
      monitors: Array<{
        name: string
        url: string
        interval: number
        enabled: boolean
      }>
      statusPage: boolean
    }
  }
  maintenance: {
    maintenanceWindow: {
      dayOfWeek: number
      startHour: number
      duration: number
      timezone: string
    }
    backupSchedule: {
      frequency: 'hourly' | 'daily' | 'weekly'
      retention: number
      location: string
      encryption: boolean
    }
    updatePolicy: {
      autoUpdate: boolean
      schedule: 'immediate' | 'maintenance' | 'manual'
      testing: boolean
      rollback: boolean
    }
    disasterRecovery: {
      rpo: number
      rto: number
      backupRegions: string[]
      testFrequency: 'monthly' | 'quarterly' | 'yearly'
    }
  }
}

/**
 * Type guards for settings validation
 */
export const isSerializableUserSettings = (value: unknown): value is SerializableUserSettings => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    'profile' in value &&
    'notifications' in value &&
    'privacy' in value &&
    'preferences' in value
  )
}

export const isSerializableSupplierSettings = (value: unknown): value is SerializableSupplierSettings => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    'dashboard' in value &&
    'inventory' in value &&
    'notifications' in value &&
    'integrations' in value &&
    'qualitySettings' in value
  )
}

export const isSerializableBuyerSettings = (value: unknown): value is SerializableBuyerSettings => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    'purchasing' in value &&
    'campaigns' in value &&
    'notifications' in value &&
    'integrations' in value
  )
}

export const isSerializableNetworkSettings = (value: unknown): value is SerializableNetworkSettings => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    'commissions' in value &&
    'quality' in value &&
    'fraud' in value &&
    'compliance' in value
  )
}

export const isSerializableAdminSettings = (value: unknown): value is SerializableAdminSettings => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    'permissions' in value &&
    'systemConfig' in value &&
    'auditLog' in value &&
    'monitoring' in value &&
    'maintenance' in value
  )
}

/**
 * Database conversion utilities
 */
export const settingsToJson = <TSettings>(
  settings: TSettings,
  validator?: (val: TSettings) => boolean
): JsonValue => {
  if (validator && !validator(settings)) {
    throw new Error('Settings validation failed before JSON conversion')
  }
  
  return toJsonSafe(settings)
}

export const settingsFromJson = <TSettings>(
  json: Json | null,
  validator: (val: unknown) => val is TSettings
): TSettings | null => {
  if (!json) return null
  
  try {
    if (validator(json)) {
      return json
    } else {
      console.warn('Settings failed validation after JSON parsing:', json)
      return null
    }
  } catch (error) {
    console.error('Error parsing settings from JSON:', error)
    return null
  }
}

/**
 * Performance optimized type checking
 */
export const createTypeValidator = <T>(
  validator: (value: unknown) => value is T,
  cacheDuration = 5000
) => {
  const cache = new Map<unknown, { result: boolean; timestamp: number }>()
  
  return (value: unknown): value is T => {
    const cached = cache.get(value)
    const now = Date.now()
    
    if (cached && now - cached.timestamp < cacheDuration) {
      return cached.result as boolean
    }
    
    const result = validator(value)
    cache.set(value, { result, timestamp: now })
    
    // Clean old cache entries
    if (cache.size > 100) {
      const cutoff = now - cacheDuration
      for (const [key, entry] of cache.entries()) {
        if (entry.timestamp < cutoff) {
          cache.delete(key)
        }
      }
    }
    
    return result
  }
}

/**
 * Optimized validators with caching
 */
export const isValidUserSettings = createTypeValidator(isSerializableUserSettings)
export const isValidSupplierSettings = createTypeValidator(isSerializableSupplierSettings)
export const isValidBuyerSettings = createTypeValidator(isSerializableBuyerSettings)
export const isValidNetworkSettings = createTypeValidator(isSerializableNetworkSettings)
export const isValidAdminSettings = createTypeValidator(isSerializableAdminSettings)