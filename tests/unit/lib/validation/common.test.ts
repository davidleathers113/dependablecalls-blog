import { describe, it, expect } from 'vitest'
import {
  emailSchema,
  phoneSchema,
  passwordSchema,
  urlSchema,
  nameSchema,
  companyNameSchema,
  currencyAmountSchema,
  percentageSchema,
  zipCodeSchema,
  stateCodeSchema,
  timeSchema,
  timezoneSchema,
  userRoleSchema,
  campaignStatusSchema,
  verticalSchema
} from '../../../../src/lib/validation/common'

describe('Common Validation Schemas', () => {
  describe('emailSchema', () => {
    it('should validate correct email addresses', () => {
      const validEmails = [
        'user@example.com',
        'test.email+tag@example.co.uk',
        'valid@subdomain.example.org'
      ]

      validEmails.forEach(email => {
        const result = emailSchema.safeParse(email)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user..double.dot@example.com',
        ''
      ]

      invalidEmails.forEach(email => {
        const result = emailSchema.safeParse(email)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('phoneSchema', () => {
    it('should validate and transform US phone numbers', () => {
      const validNumbers = [
        '5551234567',
        '(555) 123-4567',
        '555-123-4567',
        '555 123 4567'
      ]

      validNumbers.forEach(phone => {
        const result = phoneSchema.safeParse(phone)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid phone numbers', () => {
      const invalidNumbers = [
        '123',
        'abc123def',
        '555-123-456', // too short
        '',
        '555-123-45678' // too long for US
      ]

      invalidNumbers.forEach(phone => {
        const result = phoneSchema.safeParse(phone)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('passwordSchema', () => {
    it('should validate strong passwords', () => {
      const validPasswords = [
        'SecurePass123',
        'MyStr0ngP@ssw0rd',
        'C0mpl3xPassword'
      ]

      validPasswords.forEach(password => {
        const result = passwordSchema.safeParse(password)
        expect(result.success).toBe(true)
      })
    })

    it('should reject weak passwords', () => {
      const invalidPasswords = [
        'weak',
        'password',
        '12345678',
        'PASSWORD',
        'Password', // no number
        'password123' // no uppercase
      ]

      invalidPasswords.forEach(password => {
        const result = passwordSchema.safeParse(password)
        expect(result.success).toBe(false)
      })
    })

    it('should enforce length requirements', () => {
      const tooShort = passwordSchema.safeParse('Abc123')
      expect(tooShort.success).toBe(false)

      const tooLong = passwordSchema.safeParse('A'.repeat(75) + 'bc123')
      expect(tooLong.success).toBe(false)
    })
  })

  describe('urlSchema', () => {
    it('should validate correct URLs', () => {
      const validUrls = [
        'https://example.com',
        'http://subdomain.example.org/path',
        'https://example.com/path?query=value#fragment'
      ]

      validUrls.forEach(url => {
        const result = urlSchema.safeParse(url)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://example.com', // unsupported protocol
        'example.com', // missing protocol
        '',
        'javascript:alert(1)' // dangerous protocol
      ]

      invalidUrls.forEach(url => {
        const result = urlSchema.safeParse(url)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('nameSchema', () => {
    it('should validate names', () => {
      const validNames = [
        'John',
        'Mary Jane',
        "O'Connor",
        'Jean-Pierre'
      ]

      validNames.forEach(name => {
        const result = nameSchema.safeParse(name)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid names', () => {
      const invalidNames = [
        '',
        ' ', // just whitespace
        'A'.repeat(101) // too long
      ]

      invalidNames.forEach(name => {
        const result = nameSchema.safeParse(name)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('companyNameSchema', () => {
    it('should validate company names', () => {
      const validNames = [
        'Acme Corp',
        'Tech Solutions Inc.',
        'ABC Company & Associates'
      ]

      validNames.forEach(name => {
        const result = companyNameSchema.safeParse(name)
        expect(result.success).toBe(true)
      })
    })

    it('should reject empty or too long company names', () => {
      const result1 = companyNameSchema.safeParse('')
      expect(result1.success).toBe(false)

      const result2 = companyNameSchema.safeParse('A'.repeat(201))
      expect(result2.success).toBe(false)
    })
  })

  describe('currencyAmountSchema', () => {
    it('should validate currency amounts', () => {
      const validAmounts = [0.01, 100, 999.99, 50000]

      validAmounts.forEach(amount => {
        const result = currencyAmountSchema.safeParse(amount)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid amounts', () => {
      const invalidAmounts = [0, -10, 1000001, 10.001]

      invalidAmounts.forEach(amount => {
        const result = currencyAmountSchema.safeParse(amount)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('percentageSchema', () => {
    it('should validate percentages', () => {
      const validPercentages = [0, 50, 100, 25.5]

      validPercentages.forEach(percentage => {
        const result = percentageSchema.safeParse(percentage)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid percentages', () => {
      const invalidPercentages = [-1, 101, 150]

      invalidPercentages.forEach(percentage => {
        const result = percentageSchema.safeParse(percentage)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('zipCodeSchema', () => {
    it('should validate US ZIP codes', () => {
      const validZips = ['12345', '12345-6789', '90210']

      validZips.forEach(zip => {
        const result = zipCodeSchema.safeParse(zip)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid ZIP codes', () => {
      const invalidZips = ['123', '123456', 'ABCDE']

      invalidZips.forEach(zip => {
        const result = zipCodeSchema.safeParse(zip)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('stateCodeSchema', () => {
    it('should validate US state codes', () => {
      const validStates = ['CA', 'NY', 'TX', 'FL']

      validStates.forEach(state => {
        const result = stateCodeSchema.safeParse(state)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid state codes', () => {
      const invalidStates = ['ZZ', 'California', '12', '']

      invalidStates.forEach(state => {
        const result = stateCodeSchema.safeParse(state)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('timeSchema', () => {
    it('should validate time format', () => {
      const validTimes = ['09:30', '14:45', '00:00', '23:59', '9:30']

      validTimes.forEach(time => {
        const result = timeSchema.safeParse(time)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid time format', () => {
      const invalidTimes = ['25:00', '12:60', 'invalid', '9:5', '']

      invalidTimes.forEach(time => {
        const result = timeSchema.safeParse(time)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('timezoneSchema', () => {
    it('should validate supported timezones', () => {
      const validTimezones = [
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles'
      ]

      validTimezones.forEach(timezone => {
        const result = timezoneSchema.safeParse(timezone)
        expect(result.success).toBe(true)
      })
    })

    it('should reject unsupported timezones', () => {
      const invalidTimezones = ['EST', 'UTC', 'Invalid/Timezone']

      invalidTimezones.forEach(timezone => {
        const result = timezoneSchema.safeParse(timezone)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('userRoleSchema', () => {
    it('should validate user roles', () => {
      const validRoles = ['supplier', 'buyer', 'network', 'admin']

      validRoles.forEach(role => {
        const result = userRoleSchema.safeParse(role)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid roles', () => {
      const invalidRoles = ['user', 'guest', 'invalid']

      invalidRoles.forEach(role => {
        const result = userRoleSchema.safeParse(role)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('campaignStatusSchema', () => {
    it('should validate campaign statuses', () => {
      const validStatuses = ['draft', 'active', 'paused', 'completed']

      validStatuses.forEach(status => {
        const result = campaignStatusSchema.safeParse(status)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid statuses', () => {
      const invalidStatuses = ['running', 'stopped', 'invalid']

      invalidStatuses.forEach(status => {
        const result = campaignStatusSchema.safeParse(status)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('verticalSchema', () => {
    it('should validate industry verticals', () => {
      const validVerticals = [
        'home_improvement',
        'insurance',
        'legal',
        'financial',
        'healthcare',
        'automotive',
        'real_estate',
        'solar',
        'pest_control',
        'security',
        'other'
      ]

      validVerticals.forEach(vertical => {
        const result = verticalSchema.safeParse(vertical)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid verticals', () => {
      const invalidVerticals = ['unknown', 'invalid', 'custom']

      invalidVerticals.forEach(vertical => {
        const result = verticalSchema.safeParse(vertical)
        expect(result.success).toBe(false)
      })
    })
  })
})