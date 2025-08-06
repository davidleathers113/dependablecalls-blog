/**
 * Phase 3.1d - Namespace Isolation System
 * 
 * Prevents key conflicts and provides isolated storage contexts
 * Supports multi-tenant scenarios and feature flag isolation
 */

import { storageManager, StorageConfig } from './storageManager'

// Namespace configuration
export interface NamespaceConfig {
  name: string
  description?: string
  isolated?: boolean // If true, cannot access other namespaces
  parent?: string // For hierarchical namespaces
  maxSize?: number // Storage size limit in bytes
  ttl?: number // Time-to-live in milliseconds
}

// Namespace context for scoped operations
export interface NamespaceContext {
  namespace: string
  isolated: boolean
  parent?: string
  path: string[] // Full namespace path
}

// Storage isolation levels
export enum IsolationLevel {
  NONE = 'none',           // No isolation
  NAMESPACE = 'namespace', // Basic namespace isolation
  STRICT = 'strict',       // Cannot access other namespaces
  HIERARCHICAL = 'hierarchical' // Respects parent-child relationships
}

// Namespace registry
interface NamespaceRegistry {
  [namespace: string]: NamespaceConfig
}

// Namespace isolation manager
export class NamespaceIsolationManager {
  private static instance: NamespaceIsolationManager
  private registry: NamespaceRegistry = {}
  private activeContext: NamespaceContext | null = null
  private isolationLevel: IsolationLevel = IsolationLevel.NAMESPACE

  private constructor() {
    // Initialize default namespaces
    this.initializeDefaultNamespaces()
  }

  static getInstance(): NamespaceIsolationManager {
    if (!NamespaceIsolationManager.instance) {
      NamespaceIsolationManager.instance = new NamespaceIsolationManager()
    }
    return NamespaceIsolationManager.instance
  }

  /**
   * Initialize default namespaces for different contexts
   */
  private initializeDefaultNamespaces(): void {
    // User-specific namespace
    this.registerNamespace({
      name: 'user',
      description: 'User-specific settings and preferences',
      isolated: false
    })

    // Feature flag namespace
    this.registerNamespace({
      name: 'features',
      description: 'Feature flag configurations',
      isolated: true
    })

    // Testing namespace
    this.registerNamespace({
      name: 'test',
      description: 'Testing and development data',
      isolated: true,
      ttl: 24 * 60 * 60 * 1000 // 24 hours
    })

    // Admin namespace
    this.registerNamespace({
      name: 'admin',
      description: 'Administrative settings and configurations',
      isolated: true
    })

    // Environment-specific namespaces
    this.registerNamespace({
      name: 'dev',
      description: 'Development environment data',
      isolated: true,
      parent: 'test'
    })

    this.registerNamespace({
      name: 'staging',
      description: 'Staging environment data',
      isolated: true
    })

    // Multi-tenant support
    this.registerNamespace({
      name: 'tenant',
      description: 'Multi-tenant isolated storage',
      isolated: true
    })
  }

  /**
   * Register a new namespace
   */
  registerNamespace(config: NamespaceConfig): void {
    if (this.registry[config.name]) {
      console.warn(`Namespace ${config.name} already exists`)
      return
    }

    this.registry[config.name] = config
  }

  /**
   * Create namespace context
   */
  createContext(namespace: string, isolated: boolean = false): NamespaceContext {
    const config = this.registry[namespace]
    if (!config) {
      throw new Error(`Namespace ${namespace} not registered`)
    }

    const path = this.buildNamespacePath(namespace)
    
    return {
      namespace,
      isolated: isolated || config.isolated || false,
      parent: config.parent,
      path
    }
  }

  /**
   * Set active namespace context
   */
  setActiveContext(namespace: string, isolated: boolean = false): void {
    this.activeContext = this.createContext(namespace, isolated)
  }

  /**
   * Clear active namespace context
   */
  clearActiveContext(): void {
    this.activeContext = null
  }

  /**
   * Get current namespace context
   */
  getCurrentContext(): NamespaceContext | null {
    return this.activeContext
  }

  /**
   * Build full namespace path for hierarchical namespaces
   */
  private buildNamespacePath(namespace: string): string[] {
    const path: string[] = []
    let current = namespace

    while (current) {
      path.unshift(current)
      const config = this.registry[current]
      current = config?.parent || ''
    }

    return path
  }

  /**
   * Create namespaced storage configuration
   */
  createNamespacedConfig(storeName: string, namespace?: string, options?: Partial<StorageConfig>): StorageConfig {
    const targetNamespace = namespace || this.activeContext?.namespace
    
    if (!targetNamespace) {
      return { storeName, ...options }
    }

    // Check isolation permissions
    if (this.activeContext?.isolated && namespace && namespace !== this.activeContext.namespace) {
      throw new Error(`Isolated context cannot access namespace: ${namespace}`)
    }

    return {
      storeName,
      namespace: targetNamespace,
      ...options
    }
  }

  /**
   * Get data with namespace isolation
   */
  async getData<T>(storeName: string, namespace?: string): Promise<T | null> {
    const config = this.createNamespacedConfig(storeName, namespace)
    return storageManager.getData<T>(config)
  }

  /**
   * Set data with namespace isolation
   */
  async setData<T>(storeName: string, data: T, namespace?: string): Promise<boolean> {
    const config = this.createNamespacedConfig(storeName, namespace)
    
    // Check namespace size limits
    if (namespace && this.registry[namespace]?.maxSize) {
      const currentSize = await this.getNamespaceSize(namespace)
      const dataSize = new Blob([JSON.stringify(data)]).size
      
      if (currentSize + dataSize > this.registry[namespace].maxSize!) {
        console.error(`Namespace ${namespace} size limit exceeded`)
        return false
      }
    }

    return storageManager.setData(config, data)
  }

  /**
   * Remove data with namespace isolation
   */
  async removeData(storeName: string, namespace?: string): Promise<boolean> {
    const config = this.createNamespacedConfig(storeName, namespace)
    return storageManager.removeData(config)
  }

  /**
   * Get all keys in a namespace
   */
  getNamespaceKeys(namespace: string): string[] {
    const keys: string[] = []
    const prefix = `dce-`
    const namespacePattern = `-${namespace}`

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix) && key.includes(namespacePattern)) {
        keys.push(key)
      }
    }

    return keys
  }

  /**
   * Calculate total size of data in a namespace
   */
  async getNamespaceSize(namespace: string): Promise<number> {
    const keys = this.getNamespaceKeys(namespace)
    let totalSize = 0

    for (const key of keys) {
      const data = localStorage.getItem(key)
      if (data) {
        totalSize += new Blob([data]).size
      }
    }

    return totalSize
  }

  /**
   * Clear all data in a namespace
   */
  async clearNamespace(namespace: string): Promise<boolean> {
    try {
      const keys = this.getNamespaceKeys(namespace)
      
      for (const key of keys) {
        localStorage.removeItem(key)
      }

      console.log(`Cleared namespace ${namespace}: ${keys.length} keys removed`)
      return true

    } catch (error) {
      console.error(`Failed to clear namespace ${namespace}:`, error)
      return false
    }
  }

  /**
   * Export namespace data
   */
  async exportNamespace(namespace: string): Promise<Record<string, unknown>> {
    const keys = this.getNamespaceKeys(namespace)
    const data: Record<string, unknown> = {}

    for (const key of keys) {
      const value = localStorage.getItem(key)
      if (value) {
        try {
          data[key] = JSON.parse(value)
        } catch {
          data[key] = value // Store as string if not JSON
        }
      }
    }

    return data
  }

  /**
   * Import namespace data
   */
  async importNamespace(namespace: string, data: Record<string, unknown>): Promise<boolean> {
    try {
      for (const [key, value] of Object.entries(data)) {
        if (key.includes(`-${namespace}`)) {
          const serializedValue = typeof value === 'string' ? value : JSON.stringify(value)
          localStorage.setItem(key, serializedValue)
        }
      }

      console.log(`Imported namespace ${namespace}: ${Object.keys(data).length} keys`)
      return true

    } catch (error) {
      console.error(`Failed to import namespace ${namespace}:`, error)
      return false
    }
  }

  /**
   * Check if namespace can access another namespace
   */
  canAccessNamespace(from: string, to: string): boolean {
    const fromConfig = this.registry[from]
    const toConfig = this.registry[to]

    if (!fromConfig || !toConfig) return false

    // If from namespace is isolated, it can only access itself
    if (fromConfig.isolated && from !== to) return false

    // Check hierarchical relationships
    if (this.isolationLevel === IsolationLevel.HIERARCHICAL) {
      const fromPath = this.buildNamespacePath(from)
      const toPath = this.buildNamespacePath(to)

      // Can access parent or child namespaces
      return fromPath.some(ns => toPath.includes(ns)) || toPath.some(ns => fromPath.includes(ns))
    }

    return true
  }

  /**
   * Set isolation level
   */
  setIsolationLevel(level: IsolationLevel): void {
    this.isolationLevel = level
  }

  /**
   * Get all registered namespaces
   */
  getRegisteredNamespaces(): NamespaceRegistry {
    return { ...this.registry }
  }

  /**
   * Clean up expired namespace data based on TTL
   */
  async cleanupExpiredData(): Promise<number> {
    let cleanedCount = 0
    const now = Date.now()

    for (const [namespaceName, config] of Object.entries(this.registry)) {
      if (!config.ttl) continue

      const keys = this.getNamespaceKeys(namespaceName)
      
      for (const key of keys) {
        const data = localStorage.getItem(key)
        if (!data) continue

        try {
          const parsed = JSON.parse(data)
          const timestamp = parsed._timestamp || 0
          
          if (now - timestamp > config.ttl) {
            localStorage.removeItem(key)
            cleanedCount++
          }
        } catch {
          // If we can't parse or find timestamp, assume it's old and remove it
          localStorage.removeItem(key)
          cleanedCount++
        }
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired namespace entries`)
    }

    return cleanedCount
  }

}

// Export singleton instance
export const namespaceIsolation = NamespaceIsolationManager.getInstance()

// Convenience functions for common namespace operations
export function withNamespace<T>(namespace: string, operation: () => Promise<T>): Promise<T> {
  const manager = NamespaceIsolationManager.getInstance()
  const previousContext = manager.getCurrentContext()
  
  manager.setActiveContext(namespace)
  
  return operation().finally(() => {
    if (previousContext) {
      manager.setActiveContext(previousContext.namespace, previousContext.isolated)
    } else {
      manager.clearActiveContext()
    }
  })
}

export function createIsolatedContext(namespace: string): {
  getData: <T>(storeName: string) => Promise<T | null>
  setData: <T>(storeName: string, data: T) => Promise<boolean>
  removeData: (storeName: string) => Promise<boolean>
  clearAll: () => Promise<boolean>
} {
  const manager = NamespaceIsolationManager.getInstance()
  
  return {
    getData: <T>(storeName: string) => manager.getData<T>(storeName, namespace),
    setData: <T>(storeName: string, data: T) => manager.setData(storeName, data, namespace),
    removeData: (storeName: string) => manager.removeData(storeName, namespace),
    clearAll: () => manager.clearNamespace(namespace)
  }
}