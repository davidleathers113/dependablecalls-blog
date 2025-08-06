/**
 * Store Schema Registry - Phase 3.1b
 * Centralized registry for all store schemas with version tracking
 */

import { z } from 'zod'

// Schema version type for tracking schema evolution
export interface SchemaVersion {
  version: number
  createdAt: string
  description: string
  isBreaking: boolean
}

// Base schema interface that all store schemas must implement
export interface StoreSchema<T = unknown> {
  version: number
  schema: z.ZodSchema<T>
  metadata: SchemaVersion
  persistedFields?: Array<keyof T>
}

// Registry for all store schemas
export interface SchemaRegistry {
  [storeName: string]: {
    [version: number]: StoreSchema
  }
}

// Global schema registry
const globalSchemaRegistry: SchemaRegistry = {}

/**
 * Register a schema for a specific store and version
 */
export function registerSchema<T>(
  storeName: string,
  version: number,
  schema: z.ZodSchema<T>,
  metadata: Omit<SchemaVersion, 'version'>,
  persistedFields?: Array<keyof T>
): void {
  if (!globalSchemaRegistry[storeName]) {
    globalSchemaRegistry[storeName] = {}
  }

  globalSchemaRegistry[storeName][version] = {
    version,
    schema,
    metadata: { ...metadata, version },
    persistedFields,
  } as StoreSchema
}

/**
 * Get schema for a specific store and version
 */
export function getSchema<T = unknown>(
  storeName: string,
  version: number
): StoreSchema<T> | null {
  return (globalSchemaRegistry[storeName]?.[version] as StoreSchema<T>) || null
}

/**
 * Get the latest schema version for a store
 */
export function getLatestSchemaVersion(storeName: string): number {
  const storeSchemas = globalSchemaRegistry[storeName]
  if (!storeSchemas) return 0

  return Math.max(...Object.keys(storeSchemas).map(Number))
}

/**
 * Get latest schema for a store
 */
export function getLatestSchema<T = unknown>(storeName: string): StoreSchema<T> | null {
  const latestVersion = getLatestSchemaVersion(storeName)
  if (latestVersion === 0) return null

  return getSchema<T>(storeName, latestVersion)
}

/**
 * Get schema by specific version (alias for getSchema for clarity)
 * Used by runtime validation middleware
 */
export function getSchemaByVersion<T = unknown>(
  storeName: string,
  version: number
): StoreSchema<T> | null {
  return getSchema<T>(storeName, version)
}

/**
 * Get all versions for a store
 */
export function getSchemaVersions(storeName: string): SchemaVersion[] {
  const storeSchemas = globalSchemaRegistry[storeName]
  if (!storeSchemas) return []

  return Object.values(storeSchemas).map(s => s.metadata).sort((a, b) => a.version - b.version)
}

/**
 * Validate data against a schema
 */
export function validateWithSchema<T>(
  storeName: string,
  version: number,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const storeSchema = getSchema<T>(storeName, version)
  if (!storeSchema) {
    return {
      success: false,
      error: new z.ZodError([
        {
          code: 'custom',
          message: `Schema not found for ${storeName} version ${version}`,
          path: [],
        },
      ]),
    }
  }

  const result = storeSchema.schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  } else {
    return { success: false, error: result.error }
  }
}

/**
 * Check if data is compatible with a schema version
 */
export function isCompatibleWithSchema(
  storeName: string,
  version: number,
  data: unknown
): boolean {
  const result = validateWithSchema(storeName, version, data)
  return result.success
}

/**
 * Get all registered store names
 */
export function getRegisteredStores(): string[] {
  return Object.keys(globalSchemaRegistry)
}

/**
 * Get all breaking changes between two versions
 */
export function getBreakingChanges(
  storeName: string,
  fromVersion: number,
  toVersion: number
): SchemaVersion[] {
  const versions = getSchemaVersions(storeName)
  return versions.filter(
    v => v.version > fromVersion && v.version <= toVersion && v.isBreaking
  )
}

/**
 * Development utility to inspect registry
 */
export function inspectRegistry(): SchemaRegistry {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('inspectRegistry is only available in development')
  }
  return globalSchemaRegistry
}

// Re-export individual store schemas
export * from './authStore.schema'
export * from './buyerStore.schema'
export * from './supplierStore.schema'
export * from './settingsStore.schema'
export * from './networkStore.schema'
export * from './blogStore.schema'