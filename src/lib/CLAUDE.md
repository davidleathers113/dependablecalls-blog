# Utility Functions & Libraries

# File Organization
```
lib/
├── supabase.ts        # Supabase client config
├── validators.ts      # Zod validation schemas
├── formatters.ts      # Data formatting utilities
├── constants.ts       # App-wide constants
├── api.ts            # API helpers
├── auth.ts           # Auth utilities
├── utils.ts          # General utilities
└── types.ts          # Shared utility types
```

# Validation Patterns
- ALWAYS use Zod for validation
- NO regex patterns - use Zod string validators
- Create reusable schemas

```tsx
import { z } from 'zod';

export const phoneSchema = z.string()
  .min(10, 'Phone number must be at least 10 digits')
  .transform(val => val.replace(/\D/g, '')); // Remove non-digits

export const emailSchema = z.string().email('Invalid email format');
```

# External Library Usage
- Check if library exists before adding new ones
- Use existing project dependencies:
  - axios for HTTP requests
  - zod for validation
  - date-fns for date manipulation
  - lodash for utility functions (if needed)

# API Helpers
```tsx
// Use axios instance with proper typing
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Typed API functions
export async function fetchUser(id: string): Promise<User> {
  const response = await api.get<User>(`/users/${id}`);
  return response.data;
}
```

# Error Handling Patterns
```tsx
// Custom error types
export class ValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Error handling utilities
export function handleApiError(error: unknown): string {
  if (error instanceof ValidationError) {
    return `Validation error: ${error.message}`;
  }
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? 'Network error';
  }
  return 'An unexpected error occurred';
}
```

# Data Formatting
```tsx
// Currency formatting
export function formatCurrency(
  amount: number, 
  currency = 'USD'
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

// Date formatting
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US').format(new Date(date));
}
```

# Secret Management
- Use environment variables for all secrets
- NO hardcoded API keys or passwords
- Use proper typing for env vars

```tsx
// Environment variable typing
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_STRIPE_PUBLIC_KEY: string;
}
```

# Performance Utilities
```tsx
// Debounce for search inputs
export function debounce<T extends unknown[]>(
  fn: (...args: T) => void,
  delay: number
): (...args: T) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: T) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
```

# DCE-Specific Utilities
- Call duration calculation
- Commission rate calculations
- Traffic quality scoring
- Fraud detection helpers
- Real-time connection utilities

# Type Safety Requirements
- ALL functions must have proper TypeScript types
- Use generics for flexible utilities
- Export types alongside functions
- NO any types allowed

# Testing Utilities
- Create test helpers in lib/__tests__/
- Mock external dependencies
- Use fixtures for test data

# CRITICAL RULES
- NO regex patterns anywhere
- NO any types in utility functions
- ALWAYS validate inputs with Zod
- ALWAYS handle errors explicitly
- ALWAYS use proper TypeScript typing
- NO direct external API calls - use abstractions