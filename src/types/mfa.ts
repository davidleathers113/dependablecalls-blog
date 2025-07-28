/**
 * Multi-Factor Authentication Types
 * 
 * Comprehensive type definitions for the DCE MFA system including
 * TOTP, SMS backup, device trust, and security monitoring.
 */

export type UserRole = 'supplier' | 'buyer' | 'admin' | 'network'
export type MFAMethod = 'totp' | 'sms' | 'backup_code'

export interface MFASecret {
  id: string
  user_id: string
  secret_encrypted: string // Base32 TOTP secret, encrypted at rest
  backup_codes_encrypted: string[] // Single-use recovery codes, encrypted
  is_active: boolean
  verified_at: string | null
  created_at: string
  updated_at: string
}

export interface MFATrustedDevice {
  id: string
  user_id: string
  device_fingerprint: string // Hash of browser/device characteristics
  device_name: string // User-friendly device name
  trusted_until: string // Device expiration timestamp
  last_used_at: string
  ip_address: string
  user_agent: string
  is_active: boolean
  created_at: string
}

export interface MFABackupCode {
  id: string
  user_id: string
  code_hash: string // Hashed backup code for verification
  used_at: string | null
  created_at: string
}

export interface MFAAttempt {
  id: string
  user_id: string
  method: 'totp' | 'sms' | 'backup_code'
  success: boolean
  ip_address: string
  user_agent: string
  error_code: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface SMSVerification {
  id: string
  user_id: string
  phone_number_encrypted: string // User's phone number, encrypted
  verification_code_hash: string // Hashed 6-digit code
  expires_at: string
  attempts: number
  verified_at: string | null
  created_at: string
}

export interface MFASettings {
  user_id: string
  totp_enabled: boolean
  sms_backup_enabled: boolean
  backup_codes_generated: boolean
  require_mfa: boolean // Role-based requirement
  trusted_devices_enabled: boolean
  sms_rate_limit_count: number
  sms_rate_limit_reset_at: string
  last_backup_codes_viewed: string | null
  created_at: string
  updated_at: string
}

// Client-side types (no sensitive data)
export interface MFAStatus {
  enabled: boolean
  methods: {
    totp: boolean
    sms: boolean
    backupCodes: boolean
  }
  required: boolean
  trustedDevice: boolean
  setupComplete: boolean
}

export interface TOTPSetupData {
  secret: string // Base32 secret for QR code generation
  qrCodeUrl: string
  backupCodes: string[] // Only shown once during setup
}

export interface MFAVerificationRequest {
  method: 'totp' | 'sms' | 'backup_code'
  code: string
  trustDevice?: boolean
}

export interface MFAVerificationResponse {
  success: boolean
  error?: string
  deviceTrusted?: boolean
  backupCodesRemaining?: number
}

export interface DeviceTrustCookie {
  userId: string
  deviceId: string
  fingerprint: string
  expiresAt: number
  signature: string // HMAC signature for verification
}

// Rate limiting for SMS
export interface SMSRateLimit {
  count: number
  resetAt: Date
  blocked: boolean
}

// Audit log entry
export interface MFAAuditLog {
  id: string
  user_id: string
  action: 'setup' | 'verify' | 'disable' | 'backup_code_used' | 'device_trusted' | 'rate_limited'
  method: 'totp' | 'sms' | 'backup_code' | 'device_trust' | null
  success: boolean
  ip_address: string
  user_agent: string
  details: Record<string, unknown>
  risk_score: number // 0-100, higher = more suspicious
  created_at: string
}

// Configuration
export interface MFAConfig {
  totp: {
    issuer: string
    algorithm: 'SHA1' | 'SHA256' | 'SHA512'
    digits: number
    period: number
  }
  sms: {
    provider: 'twilio'
    rateLimit: {
      maxAttempts: number
      windowMinutes: number
    }
    codeLength: number
    codeExpiryMinutes: number
  }
  backupCodes: {
    count: number
    length: number
  }
  deviceTrust: {
    expiryDays: number
    cookieName: string
  }
  security: {
    maxFailedAttempts: number
    lockoutMinutes: number
    suspiciousThreshold: number
  }
}

// Role-based MFA requirements
export type MFARequirement = 'disabled' | 'optional' | 'required'

export interface RoleMFAPolicy {
  supplier: MFARequirement
  buyer: MFARequirement  
  admin: MFARequirement
  network: MFARequirement
}

// Error types
export class MFAError extends Error {
  code: string
  statusCode: number
  
  constructor(
    message: string,
    code: string,
    statusCode: number = 400
  ) {
    super(message)
    this.name = 'MFAError'
    this.code = code
    this.statusCode = statusCode
  }
}

export class MFARateLimitError extends MFAError {
  constructor(resetAt: Date) {
    super(
      `Rate limit exceeded. Try again after ${resetAt.toISOString()}`,
      'MFA_RATE_LIMITED',
      429
    )
  }
}

export class MFASetupRequiredError extends MFAError {
  constructor() {
    super(
      'Multi-factor authentication setup is required for your account',
      'MFA_SETUP_REQUIRED', 
      403
    )
  }
}

export class MFAVerificationRequiredError extends MFAError {
  constructor() {
    super(
      'Multi-factor authentication verification is required',
      'MFA_VERIFICATION_REQUIRED',
      403
    )
  }
}