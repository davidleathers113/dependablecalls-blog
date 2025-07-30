# Forms Components Directory

This directory contains reusable form components and form-related utilities for the DCE platform.

## Directory Purpose
- Houses form input components
- Provides form validation logic
- Manages form state handling
- Ensures consistent form UX

## Form Components
- **Input.tsx** - Text input fields
- **Select.tsx** - Dropdown selections
- **Checkbox.tsx** - Checkbox inputs
- **Radio.tsx** - Radio button groups
- **TextArea.tsx** - Multi-line text
- **FileUpload.tsx** - File upload handling
- **DatePicker.tsx** - Date selection
- **FormField.tsx** - Field wrapper with labels
- **FormError.tsx** - Error message display
- **SubmitButton.tsx** - Form submission button

## React Hook Form Integration
```tsx
// FormField.tsx
interface FormFieldProps {
  name: string;
  label: string;
  required?: boolean;
  error?: FieldError;
  children: React.ReactNode;
}

export function FormField({ name, label, required, error, children }: FormFieldProps) {
  return (
    <div className="form-field">
      <label htmlFor={name}>
        {label} {required && <span className="required">*</span>}
      </label>
      {children}
      {error && <FormError message={error.message} />}
    </div>
  );
}
```

## Validation with Zod
```typescript
// schemas/campaign.ts
import { z } from 'zod';

export const campaignSchema = z.object({
  name: z.string().min(3).max(100),
  budget: z.number().positive(),
  startDate: z.date(),
  endDate: z.date(),
  targetGeo: z.array(z.string()).min(1),
});

export type CampaignFormData = z.infer<typeof campaignSchema>;
```

## Form Patterns
### Basic Form Setup
```tsx
export function CampaignForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
  });
  
  const onSubmit = async (data: CampaignFormData) => {
    await createCampaign(data);
  };
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FormField name="name" label="Campaign Name" error={errors.name}>
        <Input {...register('name')} />
      </FormField>
      {/* More fields */}
    </form>
  );
}
```

## Input Components
### Controlled Input
```tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'form-input',
          error && 'border-red-500',
          className
        )}
        {...props}
      />
    );
  }
);
```

## Accessibility Features
- Proper label associations
- ARIA error announcements
- Keyboard navigation
- Focus management
- Screen reader support

## Form States
- Loading states during submission
- Disabled states for readonly
- Error states with messages
- Success feedback
- Progress indicators

## Complex Forms
- Multi-step forms
- Dynamic field arrays
- Conditional fields
- File uploads with preview
- Rich text editors

## Error Handling
```tsx
// FormError.tsx
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  
  return (
    <p className="text-red-500 text-sm mt-1" role="alert">
      {message}
    </p>
  );
}
```

## Performance Optimization
- Debounced validation
- Lazy validation triggers
- Optimistic UI updates
- Form data persistence
- Minimal re-renders

## Security Considerations
- Input sanitization
- CSRF protection
- Rate limiting awareness
- XSS prevention
- SQL injection prevention

## CRITICAL RULES
- NO regex validation - use Zod
- ALWAYS validate on server too
- HANDLE all error states
- ENSURE accessibility
- TEST form submissions
- SANITIZE all inputs