import { z } from 'zod'
import validator from 'validator'

/**
 * Common validation schemas used across forms
 * NO regex patterns - using validator.js and Zod only
 */

// Basic field validations
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')

export const phoneSchema = z
  .string()
  .min(1, 'Phone number is required')
  .transform(val => val.replace(/\D/g, ''))
  .refine(
    (val) => val.length === 10,
    { message: 'Phone number must be 10 digits' }
  )

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be less than 72 characters')
  .refine(
    (val) => validator.isStrongPassword(val, {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 0
    }),
    { message: 'Password must contain at least 1 uppercase, 1 lowercase, and 1 number' }
  )

export const urlSchema = z
  .string()
  .min(1, 'URL is required')
  .refine(
    (val) => {
      try {
        const url = new URL(val)
        return url.protocol === 'http:' || url.protocol === 'https:'
      } catch {
        return false
      }
    },
    { message: 'Please enter a valid URL starting with http:// or https://' }
  )

export const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name must be less than 100 characters')
  .refine(
    (val) => validator.isLength(val.trim(), { min: 1 }),
    { message: 'Name cannot be empty' }
  )

export const companyNameSchema = z
  .string()
  .min(1, 'Company name is required')
  .max(200, 'Company name must be less than 200 characters')
  .refine(
    (val) => validator.isLength(val.trim(), { min: 1 }),
    { message: 'Company name cannot be empty' }
  )

export const textAreaSchema = z
  .string()
  .min(1, 'This field is required')
  .max(5000, 'Text must be less than 5000 characters')

export const descriptionSchema = z
  .string()
  .max(1000, 'Description must be less than 1000 characters')
  .optional()

// Currency and financial validations
export const currencyAmountSchema = z
  .number()
  .positive('Amount must be positive')
  .max(1000000, 'Amount cannot exceed $1,000,000')
  .multipleOf(0.01, 'Amount must be a valid currency value')

export const percentageSchema = z
  .number()
  .min(0, 'Percentage cannot be negative')
  .max(100, 'Percentage cannot exceed 100%')

// Geographic validations
export const zipCodeSchema = z
  .string()
  .min(5, 'ZIP code must be at least 5 digits')
  .refine(
    (val) => validator.isPostalCode(val, 'US'),
    { message: 'Please enter a valid US ZIP code' }
  )

export const stateCodeSchema = z
  .string()
  .length(2, 'State code must be 2 characters')
  .refine(
    (val) => US_STATES.some(state => state.code === val.toUpperCase()),
    { message: 'Please enter a valid US state code' }
  )

// Time and schedule validations (NO regex - using string validation)
export const timeSchema = z
  .string()
  .min(3, 'Time must be in H:MM or HH:MM format')
  .max(5, 'Time must be in H:MM or HH:MM format')
  .refine(
    (val) => {
      // Validate time format without regex - allows both H:MM and HH:MM
      const parts = val.split(':')
      if (parts.length !== 2) return false
      
      const hours = parseInt(parts[0], 10)
      const minutes = parseInt(parts[1], 10)
      
      return !isNaN(hours) && !isNaN(minutes) && 
             hours >= 0 && hours <= 23 &&
             minutes >= 0 && minutes <= 59 &&
             parts[1].length === 2 // Minutes must be 2 digits
    },
    { message: 'Please enter time in H:MM or HH:MM format (e.g., 9:30 or 09:30)' }
  )

export const timezoneSchema = z
  .string()
  .min(1, 'Timezone is required')
  .refine(
    (val) => TIMEZONES.includes(val as typeof TIMEZONES[number]),
    { message: 'Please select a valid timezone' }
  )

// Selection validations
export const userRoleSchema = z.enum(['supplier', 'buyer', 'network', 'admin'], {
  errorMap: () => ({ message: 'Please select a valid user role' })
})

export const campaignStatusSchema = z.enum(['draft', 'active', 'paused', 'completed'], {
  errorMap: () => ({ message: 'Please select a valid campaign status' })
})

export const verticalSchema = z.enum([
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
], {
  errorMap: () => ({ message: 'Please select a valid industry vertical' })
})

// Validation data constants
export const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' }
] as const

export const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu'
] as const

export const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' }
] as const

export const CAMPAIGN_VERTICALS = [
  { value: 'home_improvement', label: 'Home Improvement' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'legal', label: 'Legal Services' },
  { value: 'financial', label: 'Financial Services' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'solar', label: 'Solar/Energy' },
  { value: 'pest_control', label: 'Pest Control' },
  { value: 'security', label: 'Home Security' },
  { value: 'other', label: 'Other' }
] as const