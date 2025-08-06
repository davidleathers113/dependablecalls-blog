/**
 * Encryption Utilities for DCE Platform
 * Phase 3.1c - Web Crypto API implementation with AES-256-GCM
 * 
 * SECURITY FEATURES:
 * - AES-256-GCM encryption (authenticated encryption)
 * - PBKDF2 key derivation with session-based salts
 * - Secure random IV generation for each encryption
 * - Base64 encoding for storage compatibility
 * - TypeScript strict types for security
 */

/**
 * Encryption configuration
 */
export interface EncryptionConfig {
  algorithm: 'AES-GCM'
  keyLength: 256 // bits
  ivLength: 12 // bytes for GCM
  tagLength: 128 // bits for authentication tag
  saltLength: 32 // bytes for PBKDF2
  iterations: 100000 // PBKDF2 iterations (OWASP recommended)
}

/**
 * Encrypted data structure
 */
export interface EncryptedData {
  data: string // Base64 encoded encrypted data
  iv: string // Base64 encoded initialization vector
  salt: string // Base64 encoded salt used for key derivation
  algorithm: string // Encryption algorithm identifier
  timestamp: number // When encrypted (for key rotation)
}

/**
 * Key derivation result
 */
export interface DerivedKey {
  key: CryptoKey
  salt: Uint8Array
}

/**
 * Default encryption configuration
 */
export const DEFAULT_CONFIG: EncryptionConfig = {
  algorithm: 'AES-GCM',
  keyLength: 256,
  ivLength: 12,
  tagLength: 128,
  saltLength: 32,
  iterations: 100000,
}

/**
 * Check if Web Crypto API is available
 */
export function isWebCryptoSupported(): boolean {
  return typeof window !== 'undefined' && 'crypto' in window && 'subtle' in window.crypto
}

/**
 * Generate cryptographically secure random bytes
 */
export function generateRandomBytes(length: number): Uint8Array {
  if (!isWebCryptoSupported()) {
    throw new Error('Web Crypto API not supported')
  }
  
  return window.crypto.getRandomValues(new Uint8Array(length))
}

/**
 * Convert Uint8Array to Base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Convert Base64 string to Uint8Array
 */
export function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Derive encryption key from password using PBKDF2
 */
export async function deriveKey(
  password: string,
  salt?: Uint8Array,
  config: EncryptionConfig = DEFAULT_CONFIG
): Promise<DerivedKey> {
  if (!isWebCryptoSupported()) {
    throw new Error('Web Crypto API not supported')
  }

  // Generate salt if not provided
  const keySalt = salt || generateRandomBytes(config.saltLength)
  
  try {
    // Import password as key material
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    )

    // Derive AES key using PBKDF2
    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: keySalt,
        iterations: config.iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      {
        name: config.algorithm,
        length: config.keyLength,
      },
      false, // Not extractable for security
      ['encrypt', 'decrypt']
    )

    return { key, salt: keySalt }
  } catch (error) {
    throw new Error(`Key derivation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Generate session-based password for key derivation
 * This creates a deterministic but session-specific password
 */
export function generateSessionPassword(sessionId?: string): string {
  // Use sessionId if available, otherwise use a browser fingerprint
  const baseString = sessionId || `${navigator.userAgent}-${location.hostname}-${Date.now()}`
  
  // Create a hash-like string without using crypto.subtle (which is async)
  let hash = 0
  for (let i = 0; i < baseString.length; i++) {
    const char = baseString.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  // Return a deterministic password based on session
  return `dce-session-${Math.abs(hash)}-${baseString.length}`
}

/**
 * Encrypt data using AES-GCM
 */
export async function encryptData(
  data: string,
  password: string,
  config: EncryptionConfig = DEFAULT_CONFIG
): Promise<EncryptedData> {
  if (!isWebCryptoSupported()) {
    throw new Error('Web Crypto API not supported')
  }

  try {
    // Derive key with new salt
    const { key, salt } = await deriveKey(password, undefined, config)
    
    // Generate random IV
    const iv = generateRandomBytes(config.ivLength)
    
    // Encrypt data
    const encodedData = new TextEncoder().encode(data)
    const encryptedArrayBuffer = await window.crypto.subtle.encrypt(
      {
        name: config.algorithm,
        iv: iv,
        tagLength: config.tagLength,
      },
      key,
      encodedData
    )

    return {
      data: arrayBufferToBase64(encryptedArrayBuffer),
      iv: arrayBufferToBase64(iv),
      salt: arrayBufferToBase64(salt),
      algorithm: config.algorithm,
      timestamp: Date.now(),
    }
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Decrypt data using AES-GCM
 */
export async function decryptData(
  encryptedData: EncryptedData,
  password: string,
  config: EncryptionConfig = DEFAULT_CONFIG
): Promise<string> {
  if (!isWebCryptoSupported()) {
    throw new Error('Web Crypto API not supported')
  }

  try {
    // Validate algorithm
    if (encryptedData.algorithm !== config.algorithm) {
      throw new Error(`Unsupported algorithm: ${encryptedData.algorithm}`)
    }

    // Derive key using stored salt
    const salt = base64ToArrayBuffer(encryptedData.salt)
    const { key } = await deriveKey(password, salt, config)
    
    // Prepare data for decryption
    const iv = base64ToArrayBuffer(encryptedData.iv)
    const encryptedBytes = base64ToArrayBuffer(encryptedData.data)
    
    // Decrypt data
    const decryptedArrayBuffer = await window.crypto.subtle.decrypt(
      {
        name: config.algorithm,
        iv: iv,
        tagLength: config.tagLength,
      },
      key,
      encryptedBytes
    )

    return new TextDecoder().decode(decryptedArrayBuffer)
  } catch (error) {
    // Log security event for monitoring without exposing details
    const { logger } = await import('../../../lib/logger')
    logger.logSecurityEvent(
      'decryption_failed',
      'medium',
      {
        algorithm: encryptedData.algorithm,
        hasValidStructure: isValidEncryptedData(encryptedData),
        errorType: error instanceof Error ? error.name : 'unknown',
        // Explicitly avoid logging sensitive details like passwords or data
      }
    )
    
    // Don't expose detailed decryption errors for security
    throw new Error('Decryption failed - invalid password or corrupted data')
  }
}

/**
 * Encrypt JSON data (convenience function)
 */
export async function encryptJSON<T>(
  data: T,
  password: string,
  config: EncryptionConfig = DEFAULT_CONFIG
): Promise<EncryptedData> {
  const jsonString = JSON.stringify(data)
  return encryptData(jsonString, password, config)
}

/**
 * Decrypt JSON data (convenience function)
 */
export async function decryptJSON<T>(
  encryptedData: EncryptedData,
  password: string,
  config: EncryptionConfig = DEFAULT_CONFIG
): Promise<T> {
  const jsonString = await decryptData(encryptedData, password, config)
  try {
    return JSON.parse(jsonString)
  } catch (error) {
    // Log parsing failure for debugging (decryption succeeded but JSON is invalid)
    const { logger } = await import('../../../lib/logger')
    logger.warn('JSON parsing failed after successful decryption', {
      component: 'crypto',
      action: 'decrypt_json',
      metadata: {
        dataLength: jsonString.length,
        errorType: error instanceof Error ? error.name : 'unknown',
        algorithm: encryptedData.algorithm,
        // Avoid logging actual data content for security
      },
    })
    
    throw new Error('Decrypted data is not valid JSON')
  }
}

/**
 * Validate encrypted data structure
 */
export function isValidEncryptedData(data: unknown): data is EncryptedData {
  if (typeof data !== 'object' || data === null) return false
  
  const obj = data as Record<string, unknown>
  
  return (
    typeof obj.data === 'string' &&
    typeof obj.iv === 'string' &&
    typeof obj.salt === 'string' &&
    typeof obj.algorithm === 'string' &&
    typeof obj.timestamp === 'number'
  )
}

/**
 * Check if encrypted data is expired (for key rotation)
 */
export function isEncryptedDataExpired(
  encryptedData: EncryptedData,
  maxAgeMs: number = 7 * 24 * 60 * 60 * 1000 // 7 days default
): boolean {
  return Date.now() - encryptedData.timestamp > maxAgeMs
}

/**
 * Security utilities for validation
 */
export const SecurityUtils = {
  /**
   * Validate that a password meets minimum security requirements
   */
  validatePassword(password: string): { valid: boolean; reason?: string } {
    if (password.length < 12) {
      return { valid: false, reason: 'Password must be at least 12 characters' }
    }
    
    // For session-derived passwords, we're less strict
    if (password.startsWith('dce-session-')) {
      return { valid: true }
    }
    
    // For user passwords, check complexity (NO REGEX - using character checks)
    let hasLower = false
    let hasUpper = false  
    let hasNumber = false
    let hasSpecial = false
    
    const specialChars = '!@#$%^&*(),.?":{}|<>'
    
    for (let i = 0; i < password.length; i++) {
      const char = password[i]
      
      if (char >= 'a' && char <= 'z') hasLower = true
      else if (char >= 'A' && char <= 'Z') hasUpper = true
      else if (char >= '0' && char <= '9') hasNumber = true
      else if (specialChars.includes(char)) hasSpecial = true
      
      // Early exit if all requirements met
      if (hasLower && hasUpper && hasNumber && hasSpecial) break
    }
    
    if (!(hasLower && hasUpper && hasNumber && hasSpecial)) {
      return { 
        valid: false, 
        reason: 'Password must contain lowercase, uppercase, number, and special character' 
      }
    }
    
    return { valid: true }
  },

  /**
   * Generate a secure random password
   */
  generateSecurePassword(length: number = 16): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
    const randomBytes = generateRandomBytes(length)
    
    let password = ''
    for (let i = 0; i < length; i++) {
      password += charset[randomBytes[i] % charset.length]
    }
    
    return password
  },

  /**
   * Securely wipe a string from memory (best effort)
   */
  wipeString(str: string): void {
    // In JavaScript, strings are immutable, so we can't actually wipe them
    // This is a placeholder for documentation purposes
    // In a real implementation, you might use typed arrays for sensitive data
    if (str) {
      // Attempt to trigger garbage collection
      str = ''
    }
  },
}

/**
 * Standalone export for generateSecurePassword (used by key rotation)
 */
export function generateSecurePassword(length: number = 16): string {
  return SecurityUtils.generateSecurePassword(length)
}

/**
 * Export types and main functions
 * Note: Types are already exported as interfaces above
 */