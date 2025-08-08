import { describe, it, expect } from 'vitest'
import {
  loginSchema,
  registerSchema,
  magicLinkLoginSchema,
  magicLinkRegisterSchema,
  resetPasswordSchema,
  changePasswordSchema,
  mfaSetupSchema,
  mfaVerifySchema,
  updateProfileSchema
} from '../../../../src/lib/validation/auth'

describe('Auth Validation Schemas', () => {
  describe('loginSchema', () => {
    it('should validate correct login data', () => {
      const validData = {
        email: 'user@example.com',
        password: 'SecurePass123',
        rememberMe: true
      }
      
      const result = loginSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.email).toBe('user@example.com')
        expect(result.data.rememberMe).toBe(true)
      }
    })

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'not-an-email',
        password: 'SecurePass123'
      }
      
      const result = loginSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('email')
      }
    })

    it('should reject weak password', () => {
      const invalidData = {
        email: 'user@example.com',
        password: 'weak'
      }
      
      const result = loginSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('password')
      }
    })

    it('should have optional rememberMe field', () => {
      const validData = {
        email: 'user@example.com',
        password: 'SecurePass123'
      }
      
      const result = loginSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.rememberMe).toBe(false)
      }
    })
  })

  describe('registerSchema', () => {
    it('should validate correct registration data', () => {
      const validData = {
        email: 'newuser@example.com',
        password: 'SecurePass123',
        confirmPassword: 'SecurePass123',
        firstName: 'John',
        lastName: 'Doe',
        company: 'Acme Corp',
        role: 'supplier' as const,
        acceptTerms: true,
        acceptPrivacy: true
      }
      
      const result = registerSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should reject mismatched passwords', () => {
      const invalidData = {
        email: 'newuser@example.com',
        password: 'SecurePass123',
        confirmPassword: 'DifferentPass123',
        firstName: 'John',
        lastName: 'Doe',
        role: 'supplier' as const,
        acceptTerms: true
      }
      
      const result = registerSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('confirmPassword')
      }
    })

    it('should reject if terms not accepted', () => {
      const invalidData = {
        email: 'newuser@example.com',
        password: 'SecurePass123',
        confirmPassword: 'SecurePass123',
        firstName: 'John',
        lastName: 'Doe',
        role: 'supplier' as const,
        acceptTerms: false
      }
      
      const result = registerSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('acceptTerms')
      }
    })

    it('should require valid role', () => {
      const invalidData = {
        email: 'newuser@example.com',
        password: 'SecurePass123',
        confirmPassword: 'SecurePass123',
        firstName: 'John',
        lastName: 'Doe',
        role: 'invalid' as const,
        acceptTerms: true
      }
      
      const result = registerSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('role')
      }
    })
  })

  describe('magicLinkLoginSchema', () => {
    it('should validate email-only login', () => {
      const validData = {
        email: 'user@example.com'
      }
      
      const result = magicLinkLoginSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should reject invalid email format', () => {
      const invalidData = {
        email: 'invalid-email'
      }
      
      const result = magicLinkLoginSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('magicLinkRegisterSchema', () => {
    it('should validate magic link registration', () => {
      const validData = {
        email: 'newuser@example.com',
        role: 'buyer' as const,
        acceptTerms: true
      }
      
      const result = magicLinkRegisterSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should require terms acceptance', () => {
      const invalidData = {
        email: 'newuser@example.com',
        role: 'buyer' as const,
        acceptTerms: false
      }
      
      const result = magicLinkRegisterSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('changePasswordSchema', () => {
    it('should validate password change', () => {
      const validData = {
        currentPassword: 'OldPass123',
        newPassword: 'NewPass123',
        confirmNewPassword: 'NewPass123'
      }
      
      const result = changePasswordSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should reject mismatched new passwords', () => {
      const invalidData = {
        currentPassword: 'OldPass123',
        newPassword: 'NewPass123',
        confirmNewPassword: 'DifferentPass123'
      }
      
      const result = changePasswordSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should reject same current and new password', () => {
      const invalidData = {
        currentPassword: 'SamePass123',
        newPassword: 'SamePass123',
        confirmNewPassword: 'SamePass123'
      }
      
      const result = changePasswordSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('mfaSetupSchema', () => {
    it('should validate TOTP setup', () => {
      const validData = {
        method: 'totp' as const,
        backupCodes: ['code1', 'code2']
      }
      
      const result = mfaSetupSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should require phone for SMS method', () => {
      const invalidData = {
        method: 'sms' as const
      }
      
      const result = mfaSetupSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should validate SMS setup with phone', () => {
      const validData = {
        method: 'sms' as const,
        phoneNumber: '5551234567'
      }
      
      const result = mfaSetupSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })
  })

  describe('mfaVerifySchema', () => {
    it('should validate 6-digit code', () => {
      const validData = {
        code: '123456'
      }
      
      const result = mfaVerifySchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should reject non-numeric code', () => {
      const invalidData = {
        code: 'abc123'
      }
      
      const result = mfaVerifySchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should reject wrong length code', () => {
      const invalidData = {
        code: '12345'
      }
      
      const result = mfaVerifySchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('updateProfileSchema', () => {
    it('should validate profile update', () => {
      const validData = {
        firstName: 'Jane',
        lastName: 'Smith',
        company: 'New Company',
        email: 'jane.smith@example.com'
      }
      
      const result = updateProfileSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should require minimum name lengths', () => {
      const invalidData = {
        firstName: 'J',
        lastName: 'S',
        email: 'j.s@example.com'
      }
      
      const result = updateProfileSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('resetPasswordSchema', () => {
    it('should validate reset request', () => {
      const validData = {
        email: 'user@example.com'
      }
      
      const result = resetPasswordSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'not-valid-email'
      }
      
      const result = resetPasswordSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })
})