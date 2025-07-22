# API Integration Patterns

# File Structure
```
integrations/
├── stripe/           # Stripe payment integration
├── supabase/         # Database and auth
├── sentry/           # Error monitoring
├── analytics/        # Tracking and analytics
└── webhooks/         # Webhook handlers
```

# API Client Pattern
```tsx
import axios, { AxiosInstance, AxiosError } from 'axios';

class ApiClient {
  private client: AxiosInstance;
  
  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    this.setupInterceptors();
  }
  
  private setupInterceptors() {
    // Request interceptor for auth
    this.client.interceptors.request.use((config) => {
      const token = getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
    
    // Response interceptor for errors
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        handleApiError(error);
        return Promise.reject(error);
      }
    );
  }
}
```

# Error Handling Strategy
```tsx
// Centralized error handling
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function handleApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 500;
    const message = error.response?.data?.message ?? 'Network error';
    const code = error.response?.data?.code;
    
    return new ApiError(message, status, code);
  }
  
  return new ApiError('Unknown error occurred', 500);
}
```

# Stripe Integration
- Use official Stripe libraries only
- Implement webhook verification
- Handle payment intents properly
- Secure API key management

```tsx
import { Stripe } from 'stripe';

export class StripeService {
  private stripe: Stripe;
  
  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-12-18.acacia',
    });
  }
  
  async createPaymentIntent(amount: number, currency = 'usd') {
    return await this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
    });
  }
}
```

# Supabase Integration
- Use typed clients
- Implement RLS policies
- Handle real-time subscriptions
- Proper error handling

```tsx
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

export const supabase: SupabaseClient<Database> = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Typed query helper
export async function fetchUser(id: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();
    
  if (error) throw new ApiError(error.message, 400);
  return data;
}
```

# Real-time Subscriptions
```tsx
export class RealtimeService {
  private subscriptions = new Map<string, RealtimeChannel>();
  
  subscribeToTable<T>(
    table: string,
    callback: (payload: RealtimePostgresChangesPayload<T>) => void
  ) {
    const channel = supabase
      .channel(`${table}-changes`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table },
        callback
      )
      .subscribe();
      
    this.subscriptions.set(table, channel);
    return channel;
  }
  
  unsubscribe(table: string) {
    const channel = this.subscriptions.get(table);
    if (channel) {
      supabase.removeChannel(channel);
      this.subscriptions.delete(table);
    }
  }
}
```

# Webhook Handling
```tsx
// Webhook verification
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  // Use crypto.timingSafeEqual for security
  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

# Secret Management
- ALL secrets in environment variables
- Different secrets for dev/staging/prod
- NO secrets in code or version control
- Use proper key rotation practices

```tsx
// Environment validation
const requiredEnvVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_STRIPE_PUBLIC_KEY',
] as const;

export function validateEnvironment() {
  for (const envVar of requiredEnvVars) {
    if (!import.meta.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
}
```

# Rate Limiting & Retry Logic
```tsx
import { retry } from '@/lib/retry';

export async function apiCallWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  return retry(fn, {
    retries: maxRetries,
    retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 30000),
    retryIf: (error) => {
      // Retry on network errors and 5xx responses
      return axios.isAxiosError(error) && 
             (!error.response || error.response.status >= 500);
    },
  });
}
```

# Type Safety for APIs
- Generate types from OpenAPI specs where possible
- Create proper TypeScript interfaces for all responses
- Use Zod for runtime validation of external API responses

# Testing Integrations
- Mock external services in tests
- Use test-specific API keys/endpoints
- Test error scenarios explicitly
- Integration tests with real services in CI

# DCE-Specific Integrations
- Call tracking APIs
- Fraud detection services
- Campaign management APIs
- Real-time analytics
- Billing and payout systems

# CRITICAL RULES
- NO regex in integration code
- NO any types in API responses
- ALWAYS validate external API responses
- ALWAYS handle network errors gracefully
- NEVER commit secrets or API keys
- ALWAYS use proper authentication
- ALWAYS implement proper error boundaries
- ALWAYS log integration failures for monitoring