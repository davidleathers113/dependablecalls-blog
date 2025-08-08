# DCE Platform Form Validation System

Comprehensive form validation for the Dependable Calls Exchange platform using Zod schemas and validator.js (NO regex patterns).

## 🚨 CRITICAL RULES

- **NEVER use regex patterns** - Use Zod + validator.js only
- **NEVER use 'any' types** - Always specify proper TypeScript types
- **ALWAYS use flat ESLint config** (eslint.config.js)
- **90% test coverage minimum** for all validation schemas
- **Follow DCE security patterns** for all forms

## Architecture Overview

```
src/lib/validation/
├── index.ts              # Main exports
├── auth.ts              # Authentication forms
├── campaigns.ts         # Campaign creation/management
├── contact.ts           # Contact and communication forms
├── settings.ts          # User/system settings
├── common.ts            # Shared validation schemas
├── utils.ts             # Validation utilities
├── form-integration.tsx # React Hook Form integration
└── README.md            # This documentation
```

## Quick Start

### 1. Import Validation Schemas

```typescript
import {
  // Authentication
  loginSchema,
  registerSchema,
  
  // Campaigns
  createCampaignSchema,
  campaignBasicInfoSchema,
  
  // Contact
  contactFormSchema,
  supportTicketSchema,
  
  // Settings
  accountSettingsSchema,
  payoutSettingsSchema
} from '@/lib/validation'
```

### 2. Use with React Hook Form

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, LoginFormData } from '@/lib/validation'

function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange'
  })

  const onSubmit = (data: LoginFormData) => {
    console.log('Valid data:', data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} type="email" />
      {errors.email && <p>{errors.email.message}</p>}
      
      <input {...register('password')} type="password" />
      {errors.password && <p>{errors.password.message}</p>}
      
      <button type="submit">Login</button>
    </form>
  )
}
```

### 3. Use Form Integration Components

```typescript
import {
  FormWrapper,
  FormInput,
  FormSubmit
} from '@/lib/validation/form-integration'

function ContactForm() {
  const handleSubmit = (data: ContactFormData) => {
    console.log('Contact data:', data)
  }

  return (
    <FormWrapper 
      schema={contactFormSchema} 
      onSubmit={handleSubmit}
    >
      <FormInput
        name="name"
        label="Full Name"
        required
      />
      
      <FormInput
        name="email"
        label="Email Address"
        type="email"
        required
      />
      
      <FormSubmit>Send Message</FormSubmit>
    </FormWrapper>
  )
}
```

## Validation Categories

### Authentication Forms

Handles user registration, login, password management, and MFA.

```typescript
import {
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  mfaSetupSchema,
  changePasswordSchema
} from '@/lib/validation/auth'
```

**Available schemas:**
- `loginSchema` - Email/password login
- `magicLinkLoginSchema` - Passwordless login
- `registerSchema` - Traditional registration
- `magicLinkRegisterSchema` - Passwordless registration
- `resetPasswordSchema` - Password reset request
- `newPasswordSchema` - Setting new password
- `changePasswordSchema` - Changing existing password
- `mfaSetupSchema` - Multi-factor authentication setup
- `updateProfileSchema` - Profile updates

### Campaign Management

Multi-step campaign creation with comprehensive validation.

```typescript
import {
  createCampaignSchema,
  campaignBasicInfoSchema,
  campaignTargetingSchema,
  campaignBudgetScheduleSchema,
  campaignCallHandlingSchema
} from '@/lib/validation/campaigns'
```

**Step-by-step schemas:**
1. `campaignBasicInfoSchema` - Name, description, vertical
2. `campaignTargetingSchema` - Geographic and demographic targeting
3. `campaignBudgetScheduleSchema` - Budget, bidding, scheduling
4. `campaignCallHandlingSchema` - Call routing, quality filters
5. `campaignReviewSchema` - Final review and launch

### Contact and Communication

Various contact forms, support tickets, and feedback.

```typescript
import {
  contactFormSchema,
  supportTicketSchema,
  partnershipInquirySchema,
  feedbackSchema
} from '@/lib/validation/contact'
```

### Settings and Configuration

Account, billing, notification, and system settings.

```typescript
import {
  accountSettingsSchema,
  securitySettingsSchema,
  payoutSettingsSchema,
  notificationSettingsSchema
} from '@/lib/validation/settings'
```

## Common Patterns

### 1. Email Validation (NO regex)

```typescript
import validator from 'validator'

export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
```

### 2. Phone Validation (NO regex)

```typescript
export const phoneSchema = z
  .string()
  .min(1, 'Phone number is required')
  .transform(val => val.replace(/\D/g, ''))
  .refine(
    (val) => validator.isMobilePhone(val, 'en-US'),
    { message: 'Please enter a valid US phone number' }
  )
```

### 3. URL Validation (NO regex)

```typescript
export const urlSchema = z
  .string()
  .min(1, 'URL is required')
  .refine(
    (val) => validator.isURL(val, { protocols: ['http', 'https'] }),
    { message: 'Please enter a valid URL' }
  )
```

### 4. Password Strength (NO regex)

```typescript
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine(
    (val) => validator.isStrongPassword(val, {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 0
    }),
    { message: 'Password must contain uppercase, lowercase, and number' }
  )
```

### 5. Currency Validation

```typescript
export const currencyAmountSchema = z
  .number()
  .positive('Amount must be positive')
  .max(1000000, 'Amount cannot exceed $1,000,000')
  .multipleOf(0.01, 'Amount must be a valid currency value')
```

### 6. Conditional Validation

```typescript
export const payoutSettingsSchema = z.object({
  method: z.enum(['bank_transfer', 'paypal']),
  bankDetails: z.object({
    routing: z.string(),
    account: z.string()
  }).optional()
}).refine(
  (data) => {
    if (data.method === 'bank_transfer') {
      return data.bankDetails // Required for bank transfers
    }
    return true
  },
  {
    message: 'Bank details required for bank transfers',
    path: ['bankDetails']
  }
)
```

## Utilities

### Safe Validation

```typescript
import { safeValidate } from '@/lib/validation/utils'

const result = safeValidate(loginSchema, formData)
if (result.success) {
  console.log('Valid data:', result.data)
} else {
  console.error('Validation errors:', result.errors)
}
```

### Format Validation Errors

```typescript
import { formatValidationErrors } from '@/lib/validation/utils'

const formattedErrors = formatValidationErrors(zodError)
// Returns: { email: 'Invalid email', password: 'Too short' }
```

### Sanitization

```typescript
import { sanitizeInput, sanitizeEmail } from '@/lib/validation/utils'

const cleanName = sanitizeInput(userInput)
const cleanEmail = sanitizeEmail(emailInput)
```

## Advanced Usage

### Multi-Step Forms

For complex forms like campaign creation:

```typescript
const [currentStep, setCurrentStep] = useState(1)
const [formData, setFormData] = useState({})

const stepSchemas = [
  campaignBasicInfoSchema,
  campaignTargetingSchema,
  campaignBudgetScheduleSchema,
  campaignCallHandlingSchema,
  campaignReviewSchema
]

const handleStepSubmit = (stepData: unknown) => {
  const schema = stepSchemas[currentStep - 1]
  const result = safeValidate(schema, stepData)
  
  if (result.success) {
    setFormData(prev => ({ ...prev, ...result.data }))
    setCurrentStep(prev => prev + 1)
  }
}
```

### Custom Validation Hooks

```typescript
import { useValidatedForm } from '@/lib/validation/form-integration'

function MyForm() {
  const {
    register,
    handleSubmit,
    errors,
    isValid
  } = useValidatedForm(contactFormSchema, {
    onSubmit: (data) => console.log('Valid:', data),
    onError: (errors) => console.error('Invalid:', errors)
  })

  // Use register, handleSubmit, etc.
}
```

## Testing Validation

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest'
import { loginSchema } from '@/lib/validation/auth'

describe('Login Validation', () => {
  it('should validate correct login data', () => {
    const validData = {
      email: 'user@example.com',
      password: 'SecurePass123'
    }
    
    const result = loginSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('should reject invalid email', () => {
    const invalidData = {
      email: 'not-an-email',
      password: 'SecurePass123'
    }
    
    const result = loginSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toContain('email')
  })
})
```

### Integration Tests

```typescript
import { render, fireEvent, waitFor } from '@testing-library/react'
import { LoginForm } from './LoginForm'

test('should show validation errors for invalid form', async () => {
  const { getByLabelText, getByText } = render(<LoginForm />)
  
  fireEvent.change(getByLabelText(/email/i), {
    target: { value: 'invalid-email' }
  })
  
  fireEvent.submit(getByRole('button'))
  
  await waitFor(() => {
    expect(getByText(/invalid email/i)).toBeInTheDocument()
  })
})
```

## Migration Guide

### From Legacy Validation

If migrating from the legacy validation.ts file:

```typescript
// OLD (deprecated)
import { loginSchema } from '@/lib/validation'

// NEW
import { loginSchema } from '@/lib/validation/auth'
```

### Adding New Validation

1. Choose appropriate category (auth, campaigns, contact, settings)
2. Add schema to relevant file
3. Export from index.ts
4. Add TypeScript types
5. Write tests
6. Update this documentation

## Performance Considerations

- Validation runs on every form change (mode: 'onChange')
- Use debounced validation for expensive operations
- Consider using 'onBlur' mode for large forms
- Memoize validation schemas in components

## Security Notes

- All inputs are sanitized using validator.js
- No regex patterns (prevents ReDoS attacks)
- XSS protection via input escaping
- CSRF tokens handled separately
- File uploads validated for type and size

## Best Practices

1. **Always use TypeScript types** - Never use 'any'
2. **Validate on client AND server** - Client validation is UX, server is security
3. **Provide clear error messages** - User-friendly feedback
4. **Test edge cases** - Empty values, boundary conditions
5. **Keep schemas composable** - Reuse common validations
6. **Document custom refinements** - Complex validation logic
7. **Consider accessibility** - ARIA labels and descriptions

## Common Issues

### Issue: "Cannot find module" error
```bash
# Solution: Check import path
import { loginSchema } from '@/lib/validation/auth' // Correct
import { loginSchema } from '@/lib/validation'      // Legacy
```

### Issue: Type errors with React Hook Form
```typescript
// Solution: Use proper type imports
import { LoginFormData } from '@/lib/validation/auth'
const form = useForm<LoginFormData>() // Properly typed
```

### Issue: Validation not triggering
```typescript
// Solution: Ensure resolver is set
const form = useForm({
  resolver: zodResolver(schema), // Required
  mode: 'onChange'              // Optional but recommended
})
```

## Support

For questions about the validation system:
1. Check this documentation
2. Look at examples in form-integration.tsx
3. Review test files for usage patterns
4. Check TypeScript types for available options

Remember: This validation system enforces DCE's zero-tolerance policy for regex patterns and 'any' types. All validation must use Zod + validator.js only.