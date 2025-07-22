# TypeScript Conventions

# File Organization
```
types/
├── database.ts       # Supabase generated types
├── api.ts           # API request/response types
├── auth.ts          # Authentication types
├── billing.ts       # Payment/billing types
├── campaign.ts      # Campaign management types
├── call.ts          # Call tracking types
├── common.ts        # Shared/utility types
└── index.ts         # Export all types
```

# Database Type Generation
- Use Supabase CLI to generate types
- NEVER manually write database types
- Regenerate after schema changes

```bash
# Generate database types
npx supabase gen types typescript --project-id=your-project > src/types/database.ts
```

# Type Definition Patterns
```tsx
// Base entity interface
interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
}

// Extend base for specific entities
interface User extends BaseEntity {
  email: string;
  role: UserRole;
  profile: UserProfile;
}

// Union types for enums
type UserRole = 'supplier' | 'buyer' | 'admin';
type CallStatus = 'pending' | 'active' | 'completed' | 'failed';
```

# API Response Types
```tsx
// Generic API response wrapper
interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

// Paginated response
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Error response
interface ApiError {
  message: string;
  code?: string;
  field?: string;
}
```

# Form & Validation Types
```tsx
// Form data types
interface LoginFormData {
  email: string;
  password: string;
}

// Validation schemas with Zod
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginFormData = z.infer<typeof loginSchema>;
```

# Utility Types
```tsx
// Make specific fields optional
type PartialUser = Partial<Pick<User, 'name' | 'phone'>>;

// Omit sensitive fields
type PublicUser = Omit<User, 'password' | 'apiKey'>;

// Extract enum values from const objects
const CALL_STATUSES = {
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
} as const;

type CallStatus = typeof CALL_STATUSES[keyof typeof CALL_STATUSES];
```

# React Component Types
```tsx
// Props interface
interface ComponentProps {
  title: string;
  isVisible?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

// Event handlers
type ClickHandler = (event: React.MouseEvent<HTMLButtonElement>) => void;
type ChangeHandler = (event: React.ChangeEvent<HTMLInputElement>) => void;

// Ref types
type InputRef = React.RefObject<HTMLInputElement>;
```

# Hook Return Types
```tsx
// Custom hook return types
interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Generic hook type
type UseApiHook<T> = (endpoint: string) => UseApiResult<T>;
```

# DCE-Specific Types

## Campaign Types
```tsx
interface Campaign extends BaseEntity {
  name: string;
  buyer_id: string;
  status: CampaignStatus;
  target_cpa: number;
  daily_budget: number;
  filters: CampaignFilters;
}

interface CampaignFilters {
  states?: string[];
  age_range?: [number, number];
  time_restrictions?: TimeRestriction[];
}
```

## Call Types
```tsx
interface Call extends BaseEntity {
  campaign_id: string;
  supplier_id: string;
  phone_number: string;
  duration: number;
  status: CallStatus;
  quality_score: number;
  payout_amount: number;
}
```

## Billing Types
```tsx
interface Transaction extends BaseEntity {
  amount: number;
  currency: string;
  type: TransactionType;
  status: PaymentStatus;
  stripe_payment_intent_id?: string;
}

type TransactionType = 'payout' | 'charge' | 'refund';
type PaymentStatus = 'pending' | 'succeeded' | 'failed';
```

# Type Guards
```tsx
// Runtime type checking
export function isUser(obj: unknown): obj is User {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'email' in obj &&
    'role' in obj
  );
}

// API response type guards
export function isApiError(response: unknown): response is ApiError {
  return (
    typeof response === 'object' &&
    response !== null &&
    'message' in response
  );
}
```

# Environment Variable Types
```tsx
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_STRIPE_PUBLIC_KEY: string;
  readonly VITE_SENTRY_DSN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

# Type Export Strategy
```tsx
// index.ts - Central type exports
export type { User, UserRole } from './auth';
export type { Campaign, CampaignFilters } from './campaign';
export type { Call, CallStatus } from './call';
export type { ApiResponse, PaginatedResponse } from './api';

// Re-export database types
export type { Database } from './database';
```

# CRITICAL RULES
- NO any types anywhere
- NO regex in type definitions
- ALWAYS use strict TypeScript settings
- ALWAYS generate database types
- NEVER use unknown without type guards
- ALWAYS export types for reuse
- ALWAYS use proper generic constraints
- STRICT null checks enabled
- NO implicit any allowed
- USE exact types, avoid loose objects