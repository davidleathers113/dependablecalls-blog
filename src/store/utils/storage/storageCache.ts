/**
 * Storage Cache for Performance Optimization
 * Caches namespaced keys to eliminate O(n) storage scans
 */

export interface CacheEntry {
  keys: string[]
  lastUpdated: number
  version: number
}

/**
 * High-performance cache for storage key enumeration
 */
export class StorageCache {
  private cache = new Map<string, CacheEntry>()
  private readonly cacheTtlMs: number

  constructor(cacheTtlMs: number = 60000) { // 1 minute default TTL
    this.cacheTtlMs = cacheTtlMs
  }

  /**
   * Get cached keys for a namespace
   */
  get(namespace: string): string[] | null {
    const entry = this.cache.get(namespace)
    if (!entry) return null

    // Check if cache is expired
    if (Date.now() - entry.lastUpdated > this.cacheTtlMs) {
      this.cache.delete(namespace)
      return null
    }

    return entry.keys
  }

  /**
   * Set cached keys for a namespace
   */
  set(namespace: string, keys: string[]): void {
    this.cache.set(namespace, {
      keys: [...keys], // Deep copy
      lastUpdated: Date.now(),
      version: this.getCacheVersion(namespace) + 1
    })
  }

  /**
   * Invalidate cache for a namespace
   */
  invalidate(namespace: string): void {
    this.cache.delete(namespace)
  }

  /**
   * Add a key to the cache (when item is set)
   */
  addKey(namespace: string, key: string): void {
    const entry = this.cache.get(namespace)
    if (entry && !entry.keys.includes(key)) {
      entry.keys.push(key)
      entry.lastUpdated = Date.now()
      entry.version++
    }
  }

  /**
   * Remove a key from the cache (when item is removed)
   */
  removeKey(namespace: string, key: string): void {
    const entry = this.cache.get(namespace)
    if (entry) {
      const index = entry.keys.indexOf(key)
      if (index >= 0) {
        entry.keys.splice(index, 1)
        entry.lastUpdated = Date.now()
        entry.version++
      }
    }
  }

  /**
   * Clear all cached keys for a namespace (when storage is cleared)
   */
  clear(namespace: string): void {
    const entry = this.cache.get(namespace)
    if (entry) {
      entry.keys = []
      entry.lastUpdated = Date.now()
      entry.version++
    }
  }

  /**
   * Get cache version (for debugging/monitoring)
   */
  private getCacheVersion(namespace: string): number {
    return this.cache.get(namespace)?.version ?? 0
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    totalNamespaces: number
    totalCachedKeys: number
    averageKeysPerNamespace: number
    memoryUsageEstimate: number
  } {
    const totalNamespaces = this.cache.size
    const totalCachedKeys = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.keys.length, 0)
    
    const averageKeysPerNamespace = totalNamespaces > 0 
      ? Math.round(totalCachedKeys / totalNamespaces) 
      : 0

    // Rough memory estimate (strings + overhead)
    const memoryUsageEstimate = Array.from(this.cache.entries())
      .reduce((total, [namespace, entry]) => {
        const namespaceSize = namespace.length * 2 // UTF-16
        const keysSize = entry.keys.reduce((sum, key) => sum + key.length * 2, 0)
        const metadataSize = 24 // timestamp + version + array overhead
        return total + namespaceSize + keysSize + metadataSize
      }, 0)

    return {
      totalNamespaces,
      totalCachedKeys,
      averageKeysPerNamespace,
      memoryUsageEstimate
    }
  }

  /**
   * Force refresh all caches (for testing)
   */
  refreshAll(): void {
    this.cache.clear()
  }
}

/**
 * Global cache instance
 */
export const globalStorageCache = new StorageCache()