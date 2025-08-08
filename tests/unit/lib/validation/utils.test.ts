import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  safeValidate,
  formatValidationErrors,
  getFieldError,
  hasFieldError,
  sanitizeInput,
  sanitizeEmail,
  formatPhoneNumber,
  normalizeUrl,
  createPartialSchema,
  mergeValidationResults,
  validateArray,
  passwordStrengthRefinement,
  fileValidationUtils,
  dateValidationUtils
} from '../../../../src/lib/validation/utils'

describe('Validation Utils', () => {
  describe('safeValidate', () => {
    const testSchema = z.object({
      name: z.string().min(1),
      age: z.number().min(0)
    })

    it('should return success for valid data', () => {
      const validData = { name: 'John', age: 25 }
      const result = safeValidate(testSchema, validData)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validData)
      }
    })

    it('should return error for invalid data', () => {
      const invalidData = { name: '', age: -1 }
      const result = safeValidate(testSchema, invalidData)
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors).toBeDefined()
        expect(result.errors.issues.length).toBeGreaterThan(0)
      }
    })
  })

  describe('formatValidationErrors', () => {
    it('should format Zod errors into user-friendly format', () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(18)
      })
      
      const result = schema.safeParse({ email: 'invalid', age: 15 })
      
      if (!result.success) {
        const formattedErrors = formatValidationErrors(result.error)
        expect(formattedErrors).toHaveProperty('email')
        expect(formattedErrors).toHaveProperty('age')
        expect(typeof formattedErrors.email).toBe('string')
      }
    })

    it('should handle multiple errors for same field', () => {
      const schema = z.object({
        password: z.string().min(8).regex(/\d/)
      })
      
      const result = schema.safeParse({ password: 'short' })
      
      if (!result.success) {
        const formattedErrors = formatValidationErrors(result.error)
        expect(formattedErrors).toHaveProperty('password')
      }
    })
  })

  describe('getFieldError', () => {
    const errors = {
      email: 'Invalid email',
      password: ['Too short', 'No uppercase'],
      name: ''
    }

    it('should return first error for field', () => {
      expect(getFieldError(errors, 'email')).toBe('Invalid email')
      expect(getFieldError(errors, 'password')).toBe('Too short')
    })

    it('should return undefined for non-existent field', () => {
      expect(getFieldError(errors, 'nonexistent')).toBeUndefined()
    })
  })

  describe('hasFieldError', () => {
    const errors = {
      email: 'Invalid email',
      password: ['Too short']
    }

    it('should return true for fields with errors', () => {
      expect(hasFieldError(errors, 'email')).toBe(true)
      expect(hasFieldError(errors, 'password')).toBe(true)
    })

    it('should return false for fields without errors', () => {
      expect(hasFieldError(errors, 'name')).toBe(false)
    })
  })

  describe('sanitizeInput', () => {
    it('should escape HTML entities', () => {
      const maliciousInput = '<script>alert("xss")</script>'
      const sanitized = sanitizeInput(maliciousInput)
      
      expect(sanitized).not.toContain('<script>')
      // HTML entities are escaped but content remains
      expect(sanitized).toContain('&lt;script&gt;')
    })

    it('should trim whitespace', () => {
      const input = '  spaced content  '
      const sanitized = sanitizeInput(input)
      
      expect(sanitized).toBe('spaced content')
    })
  })

  describe('sanitizeEmail', () => {
    it('should normalize email addresses', () => {
      const emails = [
        ' USER@EXAMPLE.COM ',
        'user@Example.com',
        'User+tag@example.COM'
      ]

      emails.forEach(email => {
        const sanitized = sanitizeEmail(email)
        expect(sanitized).toBe(sanitized.toLowerCase().trim())
      })
    })

    it('should handle invalid emails gracefully', () => {
      const invalidEmail = 'not-an-email'
      const sanitized = sanitizeEmail(invalidEmail)
      
      expect(sanitized).toBe('not-an-email')
    })
  })

  describe('formatPhoneNumber', () => {
    it('should format US phone numbers', () => {
      const phoneNumber = '5551234567'
      const formatted = formatPhoneNumber(phoneNumber)
      
      expect(formatted).toBe('(555) 123-4567')
    })

    it('should handle invalid phone numbers', () => {
      const invalidPhone = '123'
      const formatted = formatPhoneNumber(invalidPhone)
      
      expect(formatted).toBe('123')
    })
  })

  describe('normalizeUrl', () => {
    it('should add https protocol when missing', () => {
      const url = 'example.com'
      const normalized = normalizeUrl(url)
      
      expect(normalized).toBe('https://example.com')
    })

    it('should preserve existing protocol', () => {
      const url = 'http://example.com'
      const normalized = normalizeUrl(url)
      
      expect(normalized).toBe('http://example.com')
    })

    it('should handle empty URLs', () => {
      const normalized = normalizeUrl('')
      expect(normalized).toBe('')
    })
  })

  describe('createPartialSchema', () => {
    it('should make all fields optional', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number()
      })

      const partialSchema = createPartialSchema(schema)
      const result = partialSchema.safeParse({})
      
      expect(result.success).toBe(true)
    })

    it('should still validate provided fields', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number()
      })

      const partialSchema = createPartialSchema(schema)
      const result = partialSchema.safeParse({ age: 'invalid' })
      
      expect(result.success).toBe(false)
    })
  })

  describe('mergeValidationResults', () => {
    const schema1 = z.object({ name: z.string() })
    const schema2 = z.object({ age: z.number() })

    it('should merge successful validations', () => {
      const result1 = safeValidate(schema1, { name: 'John' })
      const result2 = safeValidate(schema2, { age: 25 })
      
      const merged = mergeValidationResults(result1, result2)
      
      expect(merged.success).toBe(true)
      if (merged.success) {
        expect(merged.data).toEqual({ name: 'John', age: 25 })
      }
    })

    it('should merge errors from failed validations', () => {
      const result1 = safeValidate(schema1, { name: '' })
      const result2 = safeValidate(schema2, { age: 'invalid' })
      
      const merged = mergeValidationResults(result1, result2)
      
      expect(merged.success).toBe(false)
      if (!merged.success) {
        expect(merged.errors.issues.length).toBeGreaterThan(0)
      }
    })
  })

  describe('validateArray', () => {
    const itemSchema = z.object({
      id: z.number(),
      name: z.string()
    })

    it('should validate array of valid items', () => {
      const items = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' }
      ]

      const result = validateArray(items, itemSchema)
      
      expect(result.success).toBe(true)
      expect(result.data).toEqual(items)
      expect(result.errors).toHaveLength(0)
    })

    it('should track individual item errors', () => {
      const items = [
        { id: 1, name: 'Item 1' },
        { id: 'invalid', name: '' }, // invalid
        { id: 3, name: 'Item 3' }
      ]

      const result = validateArray(items, itemSchema)
      
      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].index).toBe(1)
    })
  })

  describe('passwordStrengthRefinement', () => {
    it('should analyze strong password', () => {
      const strongPassword = 'SecurePass123'
      const analysis = passwordStrengthRefinement(strongPassword)
      
      expect(analysis.strength.hasLowercase).toBe(true)
      expect(analysis.strength.hasUppercase).toBe(true)
      expect(analysis.strength.hasNumbers).toBe(true)
      expect(analysis.strength.hasMinLength).toBe(true)
      expect(analysis.score).toBeGreaterThan(3)
    })

    it('should analyze weak password', () => {
      const weakPassword = 'password'
      const analysis = passwordStrengthRefinement(weakPassword)
      
      expect(analysis.strength.hasUppercase).toBe(false)
      expect(analysis.strength.hasNumbers).toBe(false)
      expect(analysis.score).toBeLessThan(3)
    })
  })

  describe('fileValidationUtils', () => {
    describe('isValidImageType', () => {
      it('should validate image MIME types', () => {
        expect(fileValidationUtils.isValidImageType('image/jpeg')).toBe(true)
        expect(fileValidationUtils.isValidImageType('image/png')).toBe(true)
        expect(fileValidationUtils.isValidImageType('image/gif')).toBe(true)
        expect(fileValidationUtils.isValidImageType('image/webp')).toBe(true)
        expect(fileValidationUtils.isValidImageType('text/plain')).toBe(false)
      })
    })

    describe('isValidDocumentType', () => {
      it('should validate document MIME types', () => {
        expect(fileValidationUtils.isValidDocumentType('application/pdf')).toBe(true)
        expect(fileValidationUtils.isValidDocumentType('text/plain')).toBe(true)
        expect(fileValidationUtils.isValidDocumentType('image/jpeg')).toBe(false)
      })
    })

    describe('formatFileSize', () => {
      it('should format file sizes correctly', () => {
        expect(fileValidationUtils.formatFileSize(0)).toBe('0 Bytes')
        expect(fileValidationUtils.formatFileSize(1024)).toBe('1 KB')
        expect(fileValidationUtils.formatFileSize(1048576)).toBe('1 MB')
      })
    })
  })

  describe('dateValidationUtils', () => {
    describe('isBusinessDay', () => {
      it('should identify business days', () => {
        // Using a known Monday and Saturday from 2024
        const monday = new Date('2024-01-08') // Monday (day 1)
        const saturday = new Date('2024-01-13') // Saturday (day 6)
        
        expect(dateValidationUtils.isBusinessDay(monday)).toBe(true)
        expect(dateValidationUtils.isBusinessDay(saturday)).toBe(false)
      })
    })

    describe('isWithinBusinessHours', () => {
      it('should identify business hours', () => {
        const businessHour = new Date('2023-12-04 10:00:00')
        const afterHours = new Date('2023-12-04 20:00:00')
        
        expect(dateValidationUtils.isWithinBusinessHours(businessHour)).toBe(true)
        expect(dateValidationUtils.isWithinBusinessHours(afterHours)).toBe(false)
      })
    })

    describe('addBusinessDays', () => {
      it('should add business days correctly', () => {
        const friday = new Date('2024-01-12') // Friday (day 5)
        const nextBusinessDay = dateValidationUtils.addBusinessDays(friday, 1)
        
        // Should skip weekend and land on Monday
        expect(nextBusinessDay.getDay()).toBe(1) // Monday
      })
    })
  })
})