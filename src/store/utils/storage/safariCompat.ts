/**
 * Safari Compatibility Layer
 * Handles Safari Private Mode and browser-specific storage quirks
 */

export interface SafeStorageResult {
  storage: Storage | null
  isAvailable: boolean
  isPrivateMode: boolean
  error?: string
}

/**
 * Safely test if storage is available without triggering SecurityError
 */
export function testStorageAvailability(storageType: 'localStorage' | 'sessionStorage'): SafeStorageResult {
  const result: SafeStorageResult = {
    storage: null,
    isAvailable: false,
    isPrivateMode: false
  }

  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      result.error = 'Not in browser environment'
      return result
    }

    // Get the storage object
    const storage = storageType === 'localStorage' ? window.localStorage : window.sessionStorage
    if (!storage) {
      result.error = `${storageType} not available`
      return result
    }

    // Test basic access without setting anything yet
    const testKey = `__${storageType}_test_${Date.now()}__`
    
    try {
      // This will throw SecurityError in Safari Private Mode
      storage.setItem(testKey, 'test_value')
      const retrieved = storage.getItem(testKey)
      storage.removeItem(testKey)
      
      if (retrieved === 'test_value') {
        result.storage = storage
        result.isAvailable = true
        return result
      } else {
        result.error = 'Storage test failed: retrieved value mismatch'
        return result
      }
    } catch (error) {
      // Check if this is Safari Private Mode
      if (error instanceof Error) {
        if (error.name === 'SecurityError' || 
            error.message.includes('The operation is insecure') ||
            error.message.includes('QuotaExceededError')) {
          
          result.isPrivateMode = true
          result.error = 'Safari Private Mode detected'
          
          // In Safari Private Mode, we can sometimes read but not write
          try {
            const existingKeys = storage.length // This sometimes works
            result.error = `Safari Private Mode: read-only access (${existingKeys} existing keys)`
          } catch {
            result.error = 'Safari Private Mode: no storage access'
          }
          
          return result
        }
        
        result.error = `Storage error: ${error.name} - ${error.message}`
      } else {
        result.error = 'Unknown storage error'
      }
      
      return result
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Storage initialization failed'
    return result
  }
}

/**
 * Create a safe storage wrapper that handles Safari Private Mode gracefully
 */
export function createSafeStorage(
  storageType: 'localStorage' | 'sessionStorage',
  fallbackToMemory: boolean = true
): Storage {
  const testResult = testStorageAvailability(storageType)
  
  if (testResult.isAvailable && testResult.storage) {
    // Wrap the storage to catch any runtime SecurityErrors
    return new SafeStorageWrapper(testResult.storage, storageType)
  }
  
  // Log the issue for monitoring
  if (process.env.NODE_ENV === 'development') {
    console.warn(`⚠️  ${storageType} not available: ${testResult.error}`)
    if (testResult.isPrivateMode) {
      console.warn('📱 Safari Private Mode detected - falling back to memory storage')
    }
  }
  
  if (fallbackToMemory) {
    return new MemoryStorageFallback(storageType)
  }
  
  throw new Error(`${storageType} not available: ${testResult.error}`)
}

/**
 * Wrapper that safely handles runtime storage errors
 */
class SafeStorageWrapper implements Storage {
  private readonly storage: Storage
  private readonly storageType: string
  private hasWarned = false

  constructor(storage: Storage, storageType: string) {
    this.storage = storage
    this.storageType = storageType
  }

  get length(): number {
    try {
      return this.storage.length
    } catch (error) {
      this.warnOnce('length access failed', error)
      return 0
    }
  }

  getItem(key: string): string | null {
    try {
      return this.storage.getItem(key)
    } catch (error) {
      this.warnOnce('getItem failed', error)
      return null
    }
  }

  setItem(key: string, value: string): void {
    try {
      this.storage.setItem(key, value)
    } catch (error) {
      this.warnOnce('setItem failed', error)
      // Don't throw - caller should handle gracefully
    }
  }

  removeItem(key: string): void {
    try {
      this.storage.removeItem(key)
    } catch (error) {
      this.warnOnce('removeItem failed', error)
    }
  }

  clear(): void {
    try {
      this.storage.clear()
    } catch (error) {
      this.warnOnce('clear failed', error)
    }
  }

  key(index: number): string | null {
    try {
      return this.storage.key(index)
    } catch (error) {
      this.warnOnce('key access failed', error)
      return null
    }
  }

  private warnOnce(operation: string, error: unknown): void {
    if (!this.hasWarned && process.env.NODE_ENV === 'development') {
      console.warn(`⚠️  ${this.storageType} ${operation}:`, error)
      this.hasWarned = true
    }
  }
}

/**
 * Memory-based storage fallback for when browser storage is unavailable
 */
class MemoryStorageFallback implements Storage {
  private data = new Map<string, string>()
  private readonly _storageType: string

  constructor(storageType: string) {
    this._storageType = storageType
    
    if (process.env.NODE_ENV === 'development') {
      console.info(`💾 Using memory fallback for ${storageType}`)
    }
  }

  get length(): number {
    return this.data.size
  }

  getItem(key: string): string | null {
    return this.data.get(key) || null
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }

  removeItem(key: string): void {
    this.data.delete(key)
  }

  clear(): void {
    this.data.clear()
  }

  key(index: number): string | null {
    const keys = Array.from(this.data.keys())
    return keys[index] || null
  }
}

/**
 * Check if we're likely in Safari Private Mode
 * This is a heuristic check that can be used before attempting storage operations
 */
export function isLikelySafariPrivateMode(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false
  }

  // Check if we're in Safari (NO REGEX - using string methods)
  const userAgent = navigator.userAgent.toLowerCase()
  const isSafari = userAgent.includes('safari') && 
                   !userAgent.includes('chrome') && 
                   !userAgent.includes('android')
  if (!isSafari) {
    return false
  }

  try {
    // In Safari Private Mode, localStorage is defined but throws on access
    window.localStorage.setItem('__safari_test__', 'test')
    window.localStorage.removeItem('__safari_test__')
    return false
  } catch {
    return true
  }
}

/**
 * Get comprehensive browser storage support information
 */
export function getBrowserStorageInfo(): {
  localStorage: SafeStorageResult
  sessionStorage: SafeStorageResult
  isPrivateMode: boolean
  browserInfo: {
    userAgent: string
    isSafari: boolean
    isChrome: boolean
    isFirefox: boolean
  }
} {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
  const userAgentLower = userAgent.toLowerCase()
  
  return {
    localStorage: testStorageAvailability('localStorage'),
    sessionStorage: testStorageAvailability('sessionStorage'),
    isPrivateMode: isLikelySafariPrivateMode(),
    browserInfo: {
      userAgent,
      isSafari: userAgentLower.includes('safari') && 
                !userAgentLower.includes('chrome') && 
                !userAgentLower.includes('android'),
      isChrome: userAgentLower.includes('chrome') && !userAgentLower.includes('edge'),
      isFirefox: userAgentLower.includes('firefox')
    }
  }
}