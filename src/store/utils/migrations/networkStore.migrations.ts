/**
 * Network Store Migrations - Phase 3.1b
 * MINIMAL IMPLEMENTATION: Network store has NO PERSISTENCE
 * This file exists for consistency and future extensibility
 */

import { z } from 'zod'
import { registerMigration, type Migration } from './index'

// ======================
// NO-OP MIGRATIONS (Network store is session-only)
// ======================

// All versions have empty persistence schema
const NetworkPersistedV1Schema = z.object({
  // No fields persisted - network store is session-only
})

const NetworkPersistedV2Schema = z.object({
  // Still no fields persisted
})

type NetworkPersistedV1 = z.infer<typeof NetworkPersistedV1Schema>
type NetworkPersistedV2 = z.infer<typeof NetworkPersistedV2Schema>

// Example migration V1 -> V2 (no-op but demonstrates the pattern)
const networkV1ToV2Migration: Migration<NetworkPersistedV1, NetworkPersistedV2> = {
  version: 1,
  targetVersion: 2,
  storeName: 'network-store',
  description: 'No-op migration - Network store has no persistence',
  createdAt: new Date().toISOString(),
  isBreaking: false,
  
  // Forward migration: V1 -> V2 (no-op)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  up: (_state: NetworkPersistedV1): NetworkPersistedV2 => {
    // Network store has no persisted data, so this is a no-op
    return {}
  },
  
  // Rollback migration: V2 -> V1 (no-op)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  down: (_state: NetworkPersistedV2): NetworkPersistedV1 => {
    // Network store has no persisted data, so this is a no-op
    return {}
  },
  
  // Validation schemas
  fromSchema: NetworkPersistedV1Schema,
  toSchema: NetworkPersistedV2Schema,
}

// ======================
// FUTURE EXTENSIBILITY EXAMPLE
// ======================

// If network store ever needs persistence, here's how it might look:
const NetworkPersistedV3Schema = z.object({
  // HYPOTHETICAL: If we ever add persistence, it might include:
  // selectedMode: z.enum(['network', 'supplier', 'buyer']).optional(),
  // viewPreferences: z.object({
  //   defaultDashboard: z.string(),
  //   compactView: z.boolean(),
  // }).optional(),
})

type NetworkPersistedV3 = z.infer<typeof NetworkPersistedV3Schema>

// Hypothetical migration V2 -> V3 (for future use)
const networkV2ToV3Migration: Migration<NetworkPersistedV2, NetworkPersistedV3> = {
  version: 2,
  targetVersion: 3,
  storeName: 'network-store',
  description: 'FUTURE: Add basic view preferences (currently no-op)',
  createdAt: new Date().toISOString(),
  isBreaking: false,
  
  // Forward migration: V2 -> V3
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  up: (_state: NetworkPersistedV2): NetworkPersistedV3 => {
    // Still no-op until network store needs persistence
    return {}
  },
  
  // Rollback migration: V3 -> V2
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  down: (_state: NetworkPersistedV3): NetworkPersistedV2 => {
    // Still no-op until network store needs persistence
    return {}
  },
  
  // Validation schemas
  fromSchema: NetworkPersistedV2Schema,
  toSchema: NetworkPersistedV3Schema,
}

// Register migrations (even though they're no-ops)
// This ensures the migration registry is aware of network store versions
registerMigration(networkV1ToV2Migration)
registerMigration(networkV2ToV3Migration)

// Export schemas for testing
export {
  NetworkPersistedV1Schema,
  NetworkPersistedV2Schema,
  NetworkPersistedV3Schema,
}

// Export types for testing
export type {
  NetworkPersistedV1,
  NetworkPersistedV2,
  NetworkPersistedV3,
}

// Export migrations for testing
export {
  networkV1ToV2Migration,
  networkV2ToV3Migration,
}

// Development utilities
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as unknown as { __dceNetworkMigrations: unknown }).__dceNetworkMigrations = {
    v1ToV2: networkV1ToV2Migration,
    v2ToV3: networkV2ToV3Migration,
    schemas: {
      v1: NetworkPersistedV1Schema,
      v2: NetworkPersistedV2Schema,
      v3: NetworkPersistedV3Schema,
    },
  }
  
  console.info('🌐 Network Store Migration Info:', {
    currentVersion: 1,
    hasPersistedData: false,
    migrationSupport: 'Ready for future persistence needs',
    note: 'Network store is session-only by design'
  })
}