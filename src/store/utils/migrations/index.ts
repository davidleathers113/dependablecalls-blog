/**
 * Migration Registry System for DCE Zustand Stores
 * Provides versioned state migrations with rollback capabilities
 */

import { z } from 'zod'

export interface Migration<TFrom = unknown, TTo = unknown> {
  version: number;
  targetVersion: number;
  storeName: string;
  description: string;
  createdAt: string;
  isBreaking: boolean;
  
  // Forward migration function
  up: (state: TFrom) => TTo;
  
  // Rollback migration function
  down: (state: TTo) => TFrom;
  
  // Validation schemas
  fromSchema?: z.ZodSchema<TFrom>;
  toSchema?: z.ZodSchema<TTo>;
}

export interface MigrationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  migrationsApplied: number[];
  version: number;
}

export interface MigrationHistory {
  storeName: string;
  currentVersion: number;
  appliedMigrations: number[];
  lastMigration: string; // timestamp
  rollbackHistory: Array<{
    fromVersion: number;
    toVersion: number;
    timestamp: string;
    reason?: string;
  }>;
}

/**
 * Global migration registry
 */
class MigrationRegistry {
  private migrations = new Map<string, Migration[]>();
  private history = new Map<string, MigrationHistory>();

  /**
   * Register a migration for a specific store
   */
  register<TFrom, TTo>(migration: Migration<TFrom, TTo>): void {
    const key = migration.storeName;
    
    if (!this.migrations.has(key)) {
      this.migrations.set(key, []);
    }
    
    const storeMigrations = this.migrations.get(key)!;
    
    // Check for duplicate version
    const existingMigration = storeMigrations.find(m => m.version === migration.version);
    if (existingMigration) {
      throw new Error(
        `Migration version ${migration.version} already exists for store ${key}`
      );
    }
    
    // Validate version sequence
    if (storeMigrations.length > 0) {
      const maxVersion = Math.max(...storeMigrations.map(m => m.version));
      if (migration.version !== maxVersion + 1) {
        console.warn(
          `Migration version ${migration.version} for ${key} is not sequential. Expected ${maxVersion + 1}`
        );
      }
    }
    
    storeMigrations.push(migration);
    storeMigrations.sort((a, b) => a.version - b.version);
  }

  /**
   * Get all migrations for a store
   */
  getMigrations(storeName: string): Migration[] {
    return this.migrations.get(storeName) || [];
  }

  /**
   * Get migrations needed to go from one version to another
   */
  getMigrationsPath(
    storeName: string, 
    fromVersion: number, 
    toVersion: number
  ): Migration[] {
    const allMigrations = this.getMigrations(storeName);
    
    if (fromVersion === toVersion) {
      return [];
    }
    
    if (fromVersion < toVersion) {
      // Forward migration
      return allMigrations.filter(
        m => m.version > fromVersion && m.version <= toVersion
      );
    } else {
      // Rollback migration
      return allMigrations
        .filter(m => m.version > toVersion && m.version <= fromVersion)
        .reverse();
    }
  }

  /**
   * Get the latest version for a store
   */
  getLatestVersion(storeName: string): number {
    const migrations = this.getMigrations(storeName);
    if (migrations.length === 0) return 1;
    return Math.max(...migrations.map(m => m.targetVersion));
  }

  /**
   * Check if migration path exists
   */
  canMigrate(storeName: string, fromVersion: number, toVersion: number): boolean {
    const path = this.getMigrationsPath(storeName, fromVersion, toVersion);
    return path.length >= Math.abs(toVersion - fromVersion);
  }

  /**
   * Execute migrations from one version to another
   */
  async migrate<T>(
    storeName: string,
    data: T,
    fromVersion: number,
    toVersion: number
  ): Promise<MigrationResult<T>> {
    try {
      const path = this.getMigrationsPath(storeName, fromVersion, toVersion);
      
      if (path.length === 0) {
        return {
          success: true,
          data,
          migrationsApplied: [],
          version: toVersion
        };
      }

      let currentData = data;
      const appliedMigrations: number[] = [];
      
      for (const migration of path) {
        try {
          // Validate input if schema provided
          if (migration.fromSchema) {
            migration.fromSchema.parse(currentData);
          }
          
          // Apply migration
          if (fromVersion < toVersion) {
            currentData = migration.up(currentData);
          } else {
            currentData = migration.down(currentData);
          }
          
          // Validate output if schema provided
          if (migration.toSchema) {
            migration.toSchema.parse(currentData);
          }
          
          appliedMigrations.push(migration.version);
          
        } catch (migrationError) {
          return {
            success: false,
            error: `Migration ${migration.version} failed: ${migrationError}`,
            migrationsApplied: appliedMigrations,
            version: fromVersion + appliedMigrations.length
          };
        }
      }

      // Update history
      this.updateHistory(storeName, toVersion, appliedMigrations);

      return {
        success: true,
        data: currentData,
        migrationsApplied: appliedMigrations,
        version: toVersion
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Migration failed: ${error}`,
        migrationsApplied: [],
        version: fromVersion
      };
    }
  }

  /**
   * Update migration history
   */
  private updateHistory(
    storeName: string, 
    version: number, 
    appliedMigrations: number[]
  ): void {
    const existing = this.history.get(storeName);
    
    const newHistory: MigrationHistory = {
      storeName,
      currentVersion: version,
      appliedMigrations: existing ? 
        [...existing.appliedMigrations, ...appliedMigrations] : 
        appliedMigrations,
      lastMigration: new Date().toISOString(),
      rollbackHistory: existing?.rollbackHistory || []
    };
    
    this.history.set(storeName, newHistory);
  }

  /**
   * Record rollback in history
   */
  recordRollback(
    storeName: string, 
    fromVersion: number, 
    toVersion: number, 
    reason?: string
  ): void {
    const history = this.history.get(storeName);
    if (history) {
      history.rollbackHistory.push({
        fromVersion,
        toVersion,
        timestamp: new Date().toISOString(),
        reason
      });
      history.currentVersion = toVersion;
      this.history.set(storeName, history);
    }
  }

  /**
   * Get migration history for a store
   */
  getHistory(storeName: string): MigrationHistory | undefined {
    return this.history.get(storeName);
  }

  /**
   * Get all registered stores
   */
  getRegisteredStores(): string[] {
    return Array.from(this.migrations.keys());
  }

  /**
   * Development utility: inspect registry
   */
  inspect(): Record<string, Migration[]> {
    const result: Record<string, Migration[]> = {};
    for (const [storeName, migrations] of this.migrations.entries()) {
      result[storeName] = migrations;
    }
    return result;
  }

  /**
   * Development utility: clear all migrations (testing only)
   */
  clear(): void {
    this.migrations.clear();
    this.history.clear();
  }
}

// Global migration registry instance
export const globalMigrationRegistry = new MigrationRegistry();

// Convenience functions
export function registerMigration<TFrom, TTo>(migration: Migration<TFrom, TTo>): void {
  globalMigrationRegistry.register(migration);
}

export function getMigrations(storeName: string): Migration[] {
  return globalMigrationRegistry.getMigrations(storeName);
}

export function getLatestMigrationVersion(storeName: string): number {
  return globalMigrationRegistry.getLatestVersion(storeName);
}

export function canMigrate(storeName: string, fromVersion: number, toVersion: number): boolean {
  return globalMigrationRegistry.canMigrate(storeName, fromVersion, toVersion);
}

export async function migrate<T>(
  storeName: string,
  data: T,
  fromVersion: number,
  toVersion: number
): Promise<MigrationResult<T>> {
  return globalMigrationRegistry.migrate(storeName, data, fromVersion, toVersion);
}

export function getMigrationHistory(storeName: string): MigrationHistory | undefined {
  return globalMigrationRegistry.getHistory(storeName);
}

export function inspectMigrationRegistry(): Record<string, Migration[]> {
  return globalMigrationRegistry.inspect();
}

// Development utilities interface
interface DCEMigrationDevTools {
  inspect: () => Record<string, Migration[]>;
  getHistory: (storeName: string) => MigrationHistory | undefined;
  canMigrate: (storeName: string, fromVersion: number, toVersion: number) => boolean;
  getLatestVersion: (storeName: string) => number;
  registry: MigrationRegistry;
}

// Extend Window interface for development utilities
declare global {
  interface Window {
    __dceMigrations?: DCEMigrationDevTools;
  }
}

// Development utilities for console
if (typeof window !== 'undefined') {
  window.__dceMigrations = {
    inspect: inspectMigrationRegistry,
    getHistory: getMigrationHistory,
    canMigrate,
    getLatestVersion: getLatestMigrationVersion,
    registry: globalMigrationRegistry
  };
}