/**
 * Supplier Store Migrations - Phase 3.1b
 * Handles migrations for supplier store schema changes
 * Focus: Enhanced lead source tracking and quality scoring
 */

import { z } from 'zod'
import { registerMigration, type Migration } from './index'
import { 
  CallListingSchema,
  LeadSourceSchema,
} from '../schemas/supplierStore.schema'

// ======================
// VERSION 1 -> VERSION 2
// ======================

// V1 Schema (initial - basic listings and lead sources)
const SupplierPersistedV1Schema = z.object({
  listings: z.array(CallListingSchema),
  leadSources: z.array(LeadSourceSchema),
})

// V2 Schema (adds enhanced tracking and quality metrics)
const SupplierPersistedV2Schema = z.object({
  listings: z.array(CallListingSchema.extend({
    // NEW: Enhanced performance tracking
    _analytics: z.object({
      conversionRate: z.number().default(0),
      averageCallDuration: z.number().default(0),
      qualityTrend: z.enum(['improving', 'stable', 'declining']).default('stable'),
      lastOptimized: z.string().optional(),
    }).optional(),
    
    // NEW: A/B testing support
    _testing: z.object({
      variants: z.array(z.object({
        id: z.string(),
        name: z.string(),
        trafficSplit: z.number(), // 0-100 percentage
        isActive: z.boolean(),
      })),
      currentVariant: z.string().optional(),
    }).optional(),
  })),
  
  leadSources: z.array(LeadSourceSchema.extend({
    // NEW: Enhanced source attribution
    _attribution: z.object({
      utmParameters: z.record(z.string()),
      referrerDomain: z.string().optional(),
      firstTouchDate: z.string().optional(),
      touchpointCount: z.number(),
    }).optional(),
    
    // NEW: Quality scoring history
    _qualityHistory: z.array(z.object({
      date: z.string(),
      score: z.number(),
      factors: z.array(z.string()),
      notes: z.string().optional(),
    })),
  })),
})

type SupplierPersistedV1 = z.infer<typeof SupplierPersistedV1Schema>
type SupplierPersistedV2 = z.infer<typeof SupplierPersistedV2Schema>

// Migration from V1 to V2: Add analytics and attribution tracking
const supplierV1ToV2Migration: Migration<SupplierPersistedV1, SupplierPersistedV2> = {
  version: 1,
  targetVersion: 2,
  storeName: 'supplier-store',
  description: 'Add analytics tracking and source attribution for listings and lead sources',
  createdAt: new Date().toISOString(),
  isBreaking: false,
  
  // Forward migration: V1 -> V2
  up: (state: SupplierPersistedV1): SupplierPersistedV2 => {
    return {
      listings: state.listings.map(listing => ({
        ...listing,
        _analytics: {
          conversionRate: 0,            // Initialize with zero
          averageCallDuration: 0,       // Initialize with zero
          qualityTrend: 'stable' as const,
          lastOptimized: undefined,
        },
        _testing: {
          variants: [],                 // No variants initially
          currentVariant: undefined,
        },
      })),
      
      leadSources: state.leadSources.map(source => ({
        ...source,
        _attribution: {
          utmParameters: {},            // Empty initially
          referrerDomain: undefined,
          firstTouchDate: source.created_at, // Use creation date as first touch
          touchpointCount: 1,           // Default single touchpoint
        },
        _qualityHistory: [
          // Initialize with current quality score
          {
            date: new Date().toISOString(),
            score: source.quality_score,
            factors: ['initial_assessment'],
            notes: 'Initial quality score from V1 migration',
          },
        ],
      })),
    }
  },
  
  // Rollback migration: V2 -> V1
  down: (state: SupplierPersistedV2): SupplierPersistedV1 => {
    return {
      listings: state.listings.map(listing => {
         
        const { _analytics, _testing, ...rest } = listing
        return rest
      }),
      leadSources: state.leadSources.map(source => {
         
        const { _attribution, _qualityHistory, ...rest } = source
        return rest
      }),
    }
  },
  
  // Validation schemas
  fromSchema: SupplierPersistedV1Schema,
  toSchema: SupplierPersistedV2Schema,
}

// ======================
// VERSION 2 -> VERSION 3
// ======================

// V3 Schema (adds compliance and fraud prevention)
const SupplierPersistedV3Schema = z.object({
  listings: z.array(CallListingSchema.extend({
    _analytics: z.object({
      conversionRate: z.number().default(0),
      averageCallDuration: z.number().default(0),
      qualityTrend: z.enum(['improving', 'stable', 'declining']).default('stable'),
      lastOptimized: z.string().optional(),
    }).optional(),
    _testing: z.object({
      variants: z.array(z.object({
        id: z.string(),
        name: z.string(),
        trafficSplit: z.number(),
        isActive: z.boolean(),
      })),
      currentVariant: z.string().optional(),
    }).optional(),
    
    // NEW: Compliance tracking
    _compliance: z.object({
      tcpaCompliant: z.boolean().default(true),
      dncScrubbed: z.boolean().default(false),
      lastComplianceCheck: z.string().optional(),
      complianceNotes: z.string().optional(),
    }).optional(),
  })),
  
  leadSources: z.array(LeadSourceSchema.extend({
    _attribution: z.object({
      utmParameters: z.record(z.string()),
      referrerDomain: z.string().optional(),
      firstTouchDate: z.string().optional(),
      touchpointCount: z.number(),
    }).optional(),
    _qualityHistory: z.array(z.object({
      date: z.string(),
      score: z.number(),
      factors: z.array(z.string()),
      notes: z.string().optional(),
    })),
    
    // NEW: Fraud prevention
    _fraudPrevention: z.object({
      riskScore: z.number(), // 0-100 risk score
      lastFraudCheck: z.string().optional(),
      flaggedReasons: z.array(z.string()),
      whiteListed: z.boolean(),
      quarantined: z.boolean(),
    }).optional(),
  })),
  
  // NEW: Supplier-level compliance settings
  _supplierCompliance: z.object({
    tcpaConsent: z.boolean(),
    dncListProvider: z.string().optional(),
    lastAuditDate: z.string().optional(),
    certifications: z.array(z.string()),
    complianceContact: z.string().optional(),
  }).optional(),
})

type SupplierPersistedV3 = z.infer<typeof SupplierPersistedV3Schema>

// Migration from V2 to V3: Add compliance and fraud prevention
const supplierV2ToV3Migration: Migration<SupplierPersistedV2, SupplierPersistedV3> = {
  version: 2,
  targetVersion: 3,
  storeName: 'supplier-store',
  description: 'Add compliance tracking and fraud prevention features',
  createdAt: new Date().toISOString(),
  isBreaking: false,
  
  // Forward migration: V2 -> V3
  up: (state: SupplierPersistedV2): SupplierPersistedV3 => {
    return {
      listings: state.listings.map(listing => ({
        ...listing,
        _compliance: {
          tcpaCompliant: true,          // Default to compliant
          dncScrubbed: false,           // Default to not scrubbed
          lastComplianceCheck: undefined,
          complianceNotes: undefined,
        },
      })),
      
      leadSources: state.leadSources.map(source => ({
        ...source,
        _fraudPrevention: {
          riskScore: 0,                 // Default low risk
          lastFraudCheck: undefined,
          flaggedReasons: [],           // No flags initially
          whiteListed: false,           // Default not whitelisted
          quarantined: false,           // Default not quarantined
        },
      })),
      
      _supplierCompliance: {
        tcpaConsent: false,             // Must be explicitly granted
        dncListProvider: undefined,
        lastAuditDate: undefined,
        certifications: [],             // No certifications initially
        complianceContact: undefined,
      },
    }
  },
  
  // Rollback migration: V3 -> V2
  down: (state: SupplierPersistedV3): SupplierPersistedV2 => {
    return {
      listings: state.listings.map(listing => {
         
        const { _compliance, ...rest } = listing
        return rest
      }),
      leadSources: state.leadSources.map(source => {
         
        const { _fraudPrevention, ...rest } = source
        return rest
      }),
    }
  },
  
  // Validation schemas
  fromSchema: SupplierPersistedV2Schema,
  toSchema: SupplierPersistedV3Schema,
}

// ======================
// VERSION 3 -> VERSION 4
// ======================

// V4 Schema (adds performance optimization and AI insights)
const SupplierPersistedV4Schema = z.object({
  listings: z.array(CallListingSchema.extend({
    _analytics: z.object({
      conversionRate: z.number().default(0),
      averageCallDuration: z.number().default(0),
      qualityTrend: z.enum(['improving', 'stable', 'declining']).default('stable'),
      lastOptimized: z.string().optional(),
    }).optional(),
    _testing: z.object({
      variants: z.array(z.object({
        id: z.string(),
        name: z.string(),
        trafficSplit: z.number(),
        isActive: z.boolean(),
      })),
      currentVariant: z.string().optional(),
    }).optional(),
    _compliance: z.object({
      tcpaCompliant: z.boolean().default(true),
      dncScrubbed: z.boolean().default(false),
      lastComplianceCheck: z.string().optional(),
      complianceNotes: z.string().optional(),
    }).optional(),
    
    // NEW: AI-powered optimization
    _aiInsights: z.object({
      performancePrediction: z.number().optional(), // Predicted performance score
      optimizationSuggestions: z.array(z.string()),
      marketTrends: z.array(z.object({
        trend: z.string(),
        impact: z.enum(['positive', 'negative', 'neutral']),
        confidence: z.number(), // 0-1 confidence score
      })),
      lastAnalysis: z.string().optional(),
    }).optional(),
  })),
  
  leadSources: z.array(LeadSourceSchema.extend({
    _attribution: z.object({
      utmParameters: z.record(z.string()),
      referrerDomain: z.string().optional(),
      firstTouchDate: z.string().optional(),
      touchpointCount: z.number(),
    }).optional(),
    _qualityHistory: z.array(z.object({
      date: z.string(),
      score: z.number(),
      factors: z.array(z.string()),
      notes: z.string().optional(),
    })),
    _fraudPrevention: z.object({
      riskScore: z.number().default(0),
      lastFraudCheck: z.string().optional(),
      flaggedReasons: z.array(z.string()).default([]),
      whiteListed: z.boolean().default(false),
      quarantined: z.boolean().default(false),
    }).optional(),
    
    // NEW: Predictive analytics
    _predictiveAnalytics: z.object({
      expectedVolume: z.number().optional(),
      qualityForecast: z.number().optional(),
      seasonalityFactors: z.array(z.object({
        period: z.string(),
        multiplier: z.number(),
      })),
      lastPrediction: z.string().optional(),
    }).optional(),
  })),
  
  _supplierCompliance: z.object({
    tcpaConsent: z.boolean(),
    dncListProvider: z.string().optional(),
    lastAuditDate: z.string().optional(),
    certifications: z.array(z.string()),
    complianceContact: z.string().optional(),
  }).optional(),
  
  // NEW: Performance optimization settings
  _optimization: z.object({
    autoOptimizationEnabled: z.boolean(),
    optimizationGoals: z.array(z.enum(['volume', 'quality', 'revenue', 'compliance'])),
    lastOptimizationRun: z.string().optional(),
    optimizationHistory: z.array(z.object({
      date: z.string(),
      changes: z.array(z.string()),
      impact: z.object({
        volumeChange: z.number(),
        qualityChange: z.number(),
        revenueChange: z.number(),
      }),
    })),
  }).optional(),
})

type SupplierPersistedV4 = z.infer<typeof SupplierPersistedV4Schema>

// Migration from V3 to V4: Add AI insights and optimization
const supplierV3ToV4Migration: Migration<SupplierPersistedV3, SupplierPersistedV4> = {
  version: 3,
  targetVersion: 4,
  storeName: 'supplier-store',
  description: 'Add AI insights and performance optimization features',
  createdAt: new Date().toISOString(),
  isBreaking: false,
  
  // Forward migration: V3 -> V4
  up: (state: SupplierPersistedV3): SupplierPersistedV4 => {
    return {
      listings: state.listings.map(listing => ({
        ...listing,
        _aiInsights: {
          performancePrediction: undefined,  // Will be calculated by AI
          optimizationSuggestions: [],      // Will be populated by AI
          marketTrends: [],                  // Will be populated by AI
          lastAnalysis: undefined,
        },
      })),
      
      leadSources: state.leadSources.map(source => ({
        ...source,
        _predictiveAnalytics: {
          expectedVolume: undefined,         // Will be predicted by AI
          qualityForecast: undefined,        // Will be predicted by AI
          seasonalityFactors: [],            // Will be calculated by AI
          lastPrediction: undefined,
        },
      })),
      
      _supplierCompliance: state._supplierCompliance,
      
      _optimization: {
        autoOptimizationEnabled: false,      // Default disabled
        optimizationGoals: ['quality'],      // Conservative default
        lastOptimizationRun: undefined,
        optimizationHistory: [],             // Empty history
      },
    }
  },
  
  // Rollback migration: V4 -> V3
  down: (state: SupplierPersistedV4): SupplierPersistedV3 => {
    return {
      listings: state.listings.map(listing => {
         
        const { _aiInsights, ...rest } = listing
        return rest
      }),
      leadSources: state.leadSources.map(source => {
         
        const { _predictiveAnalytics, ...rest } = source
        return rest
      }),
      _supplierCompliance: state._supplierCompliance,
    }
  },
  
  // Validation schemas
  fromSchema: SupplierPersistedV3Schema,
  toSchema: SupplierPersistedV4Schema,
}

// Register all migrations
registerMigration(supplierV1ToV2Migration)
registerMigration(supplierV2ToV3Migration)
registerMigration(supplierV3ToV4Migration)

// Export schemas for testing
export {
  SupplierPersistedV1Schema,
  SupplierPersistedV2Schema,
  SupplierPersistedV3Schema,
  SupplierPersistedV4Schema,
}

// Export types for testing
export type {
  SupplierPersistedV1,
  SupplierPersistedV2,
  SupplierPersistedV3,
  SupplierPersistedV4,
}

// Export migrations for testing
export {
  supplierV1ToV2Migration,
  supplierV2ToV3Migration,
  supplierV3ToV4Migration,
}

// Development utilities interface
interface WindowWithSupplierMigrations extends Window {
  __dceSupplierMigrations?: {
    v1ToV2: Migration<SupplierPersistedV1, SupplierPersistedV2>
    v2ToV3: Migration<SupplierPersistedV2, SupplierPersistedV3>
    v3ToV4: Migration<SupplierPersistedV3, SupplierPersistedV4>
    schemas: {
      v1: typeof SupplierPersistedV1Schema
      v2: typeof SupplierPersistedV2Schema
      v3: typeof SupplierPersistedV3Schema
      v4: typeof SupplierPersistedV4Schema
    }
  }
}

// Development utilities
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as WindowWithSupplierMigrations).__dceSupplierMigrations = {
    v1ToV2: supplierV1ToV2Migration,
    v2ToV3: supplierV2ToV3Migration,
    v3ToV4: supplierV3ToV4Migration,
    schemas: {
      v1: SupplierPersistedV1Schema,
      v2: SupplierPersistedV2Schema,
      v3: SupplierPersistedV3Schema,
      v4: SupplierPersistedV4Schema,
    },
  }
}