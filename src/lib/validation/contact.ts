import { z } from 'zod'
import { emailSchema, phoneSchema, nameSchema, companyNameSchema, textAreaSchema, urlSchema } from './common'

/**
 * Contact and communication form validation schemas
 * Includes various contact forms, support tickets, and feedback
 */

// General contact form schema
export const contactFormSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema.optional(),
  company: companyNameSchema.optional(),
  subject: z.string()
    .min(5, 'Subject must be at least 5 characters')
    .max(200, 'Subject must be less than 200 characters'),
  message: textAreaSchema
    .min(20, 'Message must be at least 20 characters')
    .max(2000, 'Message must be less than 2000 characters'),
  contactReason: z.enum([
    'general_inquiry',
    'sales',
    'support',
    'partnership',
    'billing',
    'technical',
    'feedback',
    'other'
  ], {
    errorMap: () => ({ message: 'Please select a reason for contact' })
  }),
  preferredContact: z.enum(['email', 'phone', 'either']).default('email'),
  urgency: z.enum(['low', 'medium', 'high']).default('medium'),
  subscribeNewsletter: z.boolean().default(false)
})

// Support ticket schema
export const supportTicketSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  accountId: z.string().optional(),
  subject: z.string()
    .min(10, 'Subject must be at least 10 characters')
    .max(200, 'Subject must be less than 200 characters'),
  description: textAreaSchema
    .min(50, 'Description must be at least 50 characters')
    .max(5000, 'Description must be less than 5000 characters'),
  category: z.enum([
    'account',
    'billing',
    'technical',
    'campaign_setup',
    'call_tracking',
    'reporting',
    'api',
    'integration',
    'other'
  ], {
    errorMap: () => ({ message: 'Please select a support category' })
  }),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  affectedCampaigns: z.array(z.string()).optional().default([]),
  environment: z.enum(['production', 'staging', 'development']).default('production'),
  browserInfo: z.string().max(500).optional(),
  errorMessage: z.string().max(1000).optional(),
  stepsToReproduce: textAreaSchema.max(2000).optional(),
  attachments: z.array(z.object({
    name: z.string(),
    size: z.number().max(10485760, 'File size must be less than 10MB'), // 10MB
    type: z.string()
  })).max(5, 'Maximum 5 attachments allowed').optional().default([])
})

// Partnership inquiry schema
export const partnershipInquirySchema = z.object({
  contactName: nameSchema,
  email: emailSchema,
  phone: phoneSchema.optional(),
  companyName: companyNameSchema,
  website: urlSchema.optional(),
  companySize: z.enum([
    '1-10',
    '11-50',
    '51-200',
    '201-500',
    '501-1000',
    '1000+'
  ], {
    errorMap: () => ({ message: 'Please select your company size' })
  }),
  partnershipType: z.enum([
    'affiliate',
    'reseller',
    'technology',
    'strategic',
    'referral',
    'other'
  ], {
    errorMap: () => ({ message: 'Please select partnership type' })
  }),
  industry: z.enum([
    'marketing_agency',
    'call_center',
    'crm_platform',
    'lead_generation',
    'analytics',
    'telecommunications',
    'software_vendor',
    'other'
  ], {
    errorMap: () => ({ message: 'Please select your industry' })
  }),
  monthlyVolume: z.enum([
    'less_than_1000',
    '1000_5000',
    '5000_25000',
    '25000_100000',
    'more_than_100000'
  ], {
    errorMap: () => ({ message: 'Please select expected monthly call volume' })
  }),
  description: textAreaSchema
    .min(50, 'Please describe your partnership proposal (minimum 50 characters)')
    .max(2000, 'Description must be less than 2000 characters'),
  timeline: z.enum([
    'immediate',
    'within_month',
    'within_quarter',
    'within_year',
    'exploring'
  ]).default('exploring'),
  budget: z.enum([
    'less_than_10k',
    '10k_50k',
    '50k_100k',
    '100k_500k',
    'more_than_500k',
    'not_disclosed'
  ]).default('not_disclosed')
})

// Sales inquiry schema
export const salesInquirySchema = z.object({
  contactName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  companyName: companyNameSchema,
  jobTitle: z.string().max(100).optional(),
  website: urlSchema.optional(),
  userType: z.enum(['supplier', 'buyer', 'network'], {
    errorMap: () => ({ message: 'Please select your user type' })
  }),
  estimatedVolume: z.enum([
    'less_than_100',
    '100_500',
    '500_2000',
    '2000_10000',
    'more_than_10000'
  ], {
    errorMap: () => ({ message: 'Please estimate your monthly call volume' })
  }),
  budget: z.enum([
    'less_than_5k',
    '5k_20k',
    '20k_50k',
    '50k_100k',
    'more_than_100k',
    'not_sure'
  ], {
    errorMap: () => ({ message: 'Please select your monthly budget range' })
  }),
  industry: z.enum([
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
    errorMap: () => ({ message: 'Please select your industry' })
  }),
  timeline: z.enum([
    'asap',
    'within_week',
    'within_month',
    'within_quarter',
    'just_researching'
  ]).default('just_researching'),
  currentProvider: z.string().max(100).optional(),
  specificNeeds: textAreaSchema
    .min(20, 'Please describe your specific needs (minimum 20 characters)')
    .max(1500, 'Description must be less than 1500 characters'),
  requestDemo: z.boolean().default(false),
  meetingPreference: z.enum(['phone', 'video', 'in_person', 'no_preference']).default('no_preference')
})

// Feedback schema
export const feedbackSchema = z.object({
  name: nameSchema.optional(),
  email: emailSchema.optional(),
  userType: z.enum(['supplier', 'buyer', 'network', 'visitor']).default('visitor'),
  feedbackType: z.enum([
    'bug_report',
    'feature_request',
    'general_feedback',
    'usability',
    'performance',
    'suggestion',
    'complaint'
  ], {
    errorMap: () => ({ message: 'Please select feedback type' })
  }),
  rating: z.number()
    .min(1, 'Please provide a rating')
    .max(5, 'Rating must be between 1 and 5'),
  subject: z.string()
    .min(5, 'Subject must be at least 5 characters')
    .max(150, 'Subject must be less than 150 characters'),
  feedback: textAreaSchema
    .min(10, 'Feedback must be at least 10 characters')
    .max(2000, 'Feedback must be less than 2000 characters'),
  page: z.string().max(200).optional(),
  browser: z.string().max(200).optional(),
  anonymous: z.boolean().default(false),
  allowFollowup: z.boolean().default(true)
}).refine(
  (data) => data.anonymous || (data.name && data.email),
  {
    message: 'Name and email are required unless submitting anonymously',
    path: ['email']
  }
)

// Newsletter subscription schema
export const newsletterSubscriptionSchema = z.object({
  email: emailSchema,
  firstName: nameSchema.optional(),
  interests: z.array(z.enum([
    'product_updates',
    'industry_news',
    'best_practices',
    'case_studies',
    'webinars',
    'special_offers'
  ])).min(1, 'Please select at least one interest'),
  frequency: z.enum(['daily', 'weekly', 'monthly']).default('weekly'),
  source: z.enum([
    'website',
    'social_media',
    'referral',
    'event',
    'advertisement',
    'other'
  ]).optional(),
  agreedToTerms: z.boolean().refine(
    (val) => val === true,
    { message: 'You must agree to receive marketing emails' }
  )
})

// Request demo schema
export const requestDemoSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  company: companyNameSchema,
  jobTitle: z.string().max(100).optional(),
  companySize: z.enum([
    '1-10',
    '11-50',
    '51-200',
    '201-500',
    '501-1000',
    '1000+'
  ], {
    errorMap: () => ({ message: 'Please select your company size' })
  }),
  userType: z.enum(['supplier', 'buyer', 'network'], {
    errorMap: () => ({ message: 'Please select your user type' })
  }),
  currentCallVolume: z.enum([
    'none',
    'less_than_100',
    '100_500',
    '500_2000',
    '2000_10000',
    'more_than_10000'
  ], {
    errorMap: () => ({ message: 'Please select your current call volume' })
  }),
  demoType: z.enum(['live', 'recorded', 'trial']).default('live'),
  preferredTime: z.enum([
    'morning_et',
    'afternoon_et',
    'evening_et',
    'flexible'
  ]).default('flexible'),
  specificQuestions: textAreaSchema.max(500).optional(),
  currentChallenges: textAreaSchema.max(500).optional(),
  followUpConsent: z.boolean().refine(
    (val) => val === true,
    { message: 'Consent is required to schedule a demo' }
  )
})

// Type exports for form integration
export type ContactFormData = z.infer<typeof contactFormSchema>
export type SupportTicketFormData = z.infer<typeof supportTicketSchema>
export type PartnershipInquiryFormData = z.infer<typeof partnershipInquirySchema>
export type SalesInquiryFormData = z.infer<typeof salesInquirySchema>
export type FeedbackFormData = z.infer<typeof feedbackSchema>
export type NewsletterSubscriptionFormData = z.infer<typeof newsletterSubscriptionSchema>
export type RequestDemoFormData = z.infer<typeof requestDemoSchema>

// Legacy exports for backward compatibility
export { contactFormSchema as contactSchema }