/**
 * Buyer Store Migrations - Phase 3.1b
 * CRITICAL: Addresses security issues found in Phase 3.1a audit
 * - Removes financial data from persistence
 * - Adds encrypted storage preparation for remaining sensitive data
 */

import { z } from 'zod'
import { registerMigration, type Migration } from './index'
import { 
  CampaignSchema,
  SavedSearchSchema
} from '../schemas/buyerStore.schema'

// ======================
// VERSION 1 -> VERSION 2 (SECURITY CRITICAL)
// ======================

// V1 Schema (INSECURE - includes financial data)
const BuyerPersistedV1Schema = z.object({
  currentBalance: z.number(),        // ❌ SECURITY ISSUE: Financial data persisted
  creditLimit: z.number(),           // ❌ SECURITY ISSUE: Financial data persisted
  campaigns: z.array(CampaignSchema),
  savedSearches: z.array(SavedSearchSchema),
})

// V2 Schema (SECURE - removes financial data, adds encryption readiness)
const BuyerPersistedV2Schema = z.object({
  // Financial data REMOVED from persistence (fetched from server on auth)
  campaigns: z.array(CampaignSchema),
  savedSearches: z.array(SavedSearchSchema),
  
  // NEW: Metadata for encryption (Phase 3.1c)
  _encryptionMetadata: z.object({
    version: z.number().default(1),
    encryptedFields: z.array(z.string()).default([]),
    lastUpdated: z.string().default(() => new Date().toISOString()),
  }).optional(),
})

type BuyerPersistedV1 = z.infer<typeof BuyerPersistedV1Schema>
type BuyerPersistedV2 = z.infer<typeof BuyerPersistedV2Schema>

// CRITICAL Migration from V1 to V2: Remove financial data for security
const buyerV1ToV2Migration: Migration<BuyerPersistedV1, BuyerPersistedV2> = {
  version: 1,
  targetVersion: 2,
  storeName: 'buyer-store',
  description: 'SECURITY: Remove financial data from persistence (currentBalance, creditLimit)',
  createdAt: new Date().toISOString(),
  isBreaking: true, // This is breaking - financial data will be lost from persistence
  
  // Forward migration: V1 -> V2
  up: (state: BuyerPersistedV1): BuyerPersistedV2 => {
    // WARNING: Financial data (currentBalance, creditLimit) is intentionally dropped
    // This data should be fetched from the server after authentication
    console.warn('🚨 Buyer Store Migration V1->V2: Financial data removed from persistence for security')
    
    return {
      campaigns: state.campaigns,
      savedSearches: state.savedSearches,
      _encryptionMetadata: {
        version: 1,
        encryptedFields: [], // Will be populated in Phase 3.1c
        lastUpdated: new Date().toISOString(),
      },
    }
  },
  
  // Rollback migration: V2 -> V1
  down: (state: BuyerPersistedV2): BuyerPersistedV1 => {
    // WARNING: Financial data cannot be restored - will default to 0
    console.error('🚨 Buyer Store Rollback V2->V1: Financial data cannot be restored, defaulting to 0')
    
    return {
      currentBalance: 0,              // ⚠️ Data loss - defaults to 0
      creditLimit: 0,                 // ⚠️ Data loss - defaults to 0
      campaigns: state.campaigns,
      savedSearches: state.savedSearches,
    }
  },
  
  // Validation schemas
  fromSchema: BuyerPersistedV1Schema,
  toSchema: BuyerPersistedV2Schema,
}

// ======================
// VERSION 2 -> VERSION 3 (CAMPAIGN PRIVACY)
// ======================

// V3 Schema (adds privacy controls for campaigns)
const BuyerPersistedV3Schema = z.object({
  campaigns: z.array(CampaignSchema.extend({
    // NEW: Privacy controls for campaign data
    _privacy: z.object({
      sharePerformanceData: z.boolean().default(false),
      shareWithNetwork: z.boolean().default(true),
      anonymizeInReports: z.boolean().default(false),
    }).optional(),
  })),
  savedSearches: z.array(SavedSearchSchema),
  _encryptionMetadata: z.object({
    version: z.number().default(1),
    encryptedFields: z.array(z.string()).default([]),
    lastUpdated: z.string().default(() => new Date().toISOString()),
  }).optional(),
})

type BuyerPersistedV3 = z.infer<typeof BuyerPersistedV3Schema>

// Migration from V2 to V3: Add privacy controls to campaigns
const buyerV2ToV3Migration: Migration<BuyerPersistedV2, BuyerPersistedV3> = {
  version: 2,
  targetVersion: 3,
  storeName: 'buyer-store',
  description: 'Add privacy controls for campaign data sharing',
  createdAt: new Date().toISOString(),
  isBreaking: false,
  
  // Forward migration: V2 -> V3
  up: (state: BuyerPersistedV2): BuyerPersistedV3 => {
    return {
      campaigns: state.campaigns.map(campaign => ({
        ...campaign,
        _privacy: {
          sharePerformanceData: false,    // Conservative default
          shareWithNetwork: true,         // Required for platform functionality
          anonymizeInReports: false,      // Default to non-anonymous
        },
      })),
      savedSearches: state.savedSearches,
      _encryptionMetadata: state._encryptionMetadata,
    }
  },
  
  // Rollback migration: V3 -> V2
  down: (state: BuyerPersistedV3): BuyerPersistedV2 => {
    return {
      campaigns: state.campaigns.map(campaign => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _privacy, ...rest } = campaign
        return rest
      }),
      savedSearches: state.savedSearches,
      _encryptionMetadata: state._encryptionMetadata,
    }
  },
  
  // Validation schemas
  fromSchema: BuyerPersistedV2Schema,
  toSchema: BuyerPersistedV3Schema,
}

// ======================
// VERSION 3 -> VERSION 4 (GDPR COMPLIANCE)
// ======================

// V4 Schema (adds GDPR compliance fields)
const BuyerPersistedV4Schema = z.object({
  campaigns: z.array(CampaignSchema.extend({
    _privacy: z.object({
      sharePerformanceData: z.boolean().default(false),
      shareWithNetwork: z.boolean().default(true),
      anonymizeInReports: z.boolean().default(false),
    }).optional(),
  })),
  savedSearches: z.array(SavedSearchSchema.extend({
    // NEW: GDPR compliance for saved searches
    _gdpr: z.object({
      consentGiven: z.boolean().default(false),
      consentDate: z.string().optional(),
      dataRetentionDays: z.number().default(365),
      purposeLimitation: z.array(z.string()).default(['campaign_management']),
    }).optional(),
  })),
  _encryptionMetadata: z.object({
    version: z.number().default(1),
    encryptedFields: z.array(z.string()).default([]),
    lastUpdated: z.string().default(() => new Date().toISOString()),
  }).optional(),
  
  // NEW: Overall GDPR compliance tracking
  _gdprCompliance: z.object({
    consentVersion: z.string().default('1.0'),
    consentDate: z.string().optional(),
    dataProcessingPurposes: z.array(z.string()).default([
      'campaign_management', 
      'performance_analytics',
      'billing_processing'
    ]),
    retentionPeriod: z.number().default(2555), // 7 years default
    rightToBeFororgotten: z.boolean().default(false),
  }).optional(),
})

type BuyerPersistedV4 = z.infer<typeof BuyerPersistedV4Schema>

// Migration from V3 to V4: Add GDPR compliance
const buyerV3ToV4Migration: Migration<BuyerPersistedV3, BuyerPersistedV4> = {
  version: 3,
  targetVersion: 4,
  storeName: 'buyer-store',
  description: 'Add GDPR compliance tracking and data retention policies',
  createdAt: new Date().toISOString(),
  isBreaking: false,
  
  // Forward migration: V3 -> V4
  up: (state: BuyerPersistedV3): BuyerPersistedV4 => {
    return {
      campaigns: state.campaigns,
      savedSearches: state.savedSearches.map(search => ({
        ...search,
        _gdpr: {
          consentGiven: false,           // Must be explicitly granted
          consentDate: undefined,
          dataRetentionDays: 365,        // 1 year default
          purposeLimitation: ['campaign_management'],
        },
      })),
      _encryptionMetadata: state._encryptionMetadata,
      _gdprCompliance: {
        consentVersion: '1.0',
        consentDate: undefined,         // Must be set when user grants consent
        dataProcessingPurposes: [
          'campaign_management', 
          'performance_analytics',
          'billing_processing'
        ],
        retentionPeriod: 2555,          // 7 years
        rightToBeFororgotten: false,
      },
    }
  },
  
  // Rollback migration: V4 -> V3
  down: (state: BuyerPersistedV4): BuyerPersistedV3 => {
    return {
      campaigns: state.campaigns,
      savedSearches: state.savedSearches.map(search => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _gdpr, ...rest } = search
        return rest
      }),
      _encryptionMetadata: state._encryptionMetadata,
    }
  },
  
  // Validation schemas
  fromSchema: BuyerPersistedV3Schema,
  toSchema: BuyerPersistedV4Schema,
}

// Register all migrations
registerMigration(buyerV1ToV2Migration)
registerMigration(buyerV2ToV3Migration)
registerMigration(buyerV3ToV4Migration)

// Export schemas for testing
export {
  BuyerPersistedV1Schema,
  BuyerPersistedV2Schema,
  BuyerPersistedV3Schema,
  BuyerPersistedV4Schema,
}

// Export types for testing
export type {
  BuyerPersistedV1,
  BuyerPersistedV2,
  BuyerPersistedV3,
  BuyerPersistedV4,
}

// Export migrations for testing
export {
  buyerV1ToV2Migration,
  buyerV2ToV3Migration,
  buyerV3ToV4Migration,
}

// Window interface for development utilities
interface WindowWithBuyerMigrations extends Window {
  __dceBuyerMigrations?: {
    v1ToV2: typeof buyerV1ToV2Migration
    v2ToV3: typeof buyerV2ToV3Migration
    v3ToV4: typeof buyerV3ToV4Migration
    schemas: {
      v1: typeof BuyerPersistedV1Schema
      v2: typeof BuyerPersistedV2Schema
      v3: typeof BuyerPersistedV3Schema
      v4: typeof BuyerPersistedV4Schema
    }
  }
}

// Development utilities and security warnings
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as WindowWithBuyerMigrations).__dceBuyerMigrations = {
    v1ToV2: buyerV1ToV2Migration,
    v2ToV3: buyerV2ToV3Migration,
    v3ToV4: buyerV3ToV4Migration,
    schemas: {
      v1: BuyerPersistedV1Schema,
      v2: BuyerPersistedV2Schema,
      v3: BuyerPersistedV3Schema,
      v4: BuyerPersistedV4Schema,
    },
  }
  
  // Security warning for developers
  console.warn(`
🔒 BUYER STORE SECURITY NOTICE:
- V1->V2 migration removes financial data from persistence
- Financial data (balance, credit limit) must be fetched from server
- Phase 3.1c will add encryption for remaining sensitive data
- GDPR compliance fields added in V4
`)
}