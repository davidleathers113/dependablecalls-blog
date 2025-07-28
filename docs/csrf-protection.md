# CSRF Protection Implementation

This document describes the CSRF (Cross-Site Request Forgery) protection implemented in the DCE website.

## Overview

The implementation uses the **Double Submit Cookie** pattern with the following security features:
- Cryptographically secure token generation using UUID v4
- Token binding to user sessions
- Time-based token expiration (1 hour)
- Secure cookie with `__Host-` prefix
- Automatic token refresh

## Components

### 1. Core CSRF Library (`src/lib/csrf.ts`)

Provides the following functions:
- `generateCsrfToken()` - Creates a secure random token
- `createCsrfToken()` - Creates and stores a new CSRF token
- `validateCsrfToken()` - Validates a token server-side
- `verifyCsrfToken()` - Middleware helper for edge functions
- `addCsrfHeader()` - Adds CSRF token to request headers

### 2. React Hook (`src/hooks/useCsrf.ts`)

Three hooks for React components:
- `useCsrf()` - Basic hook for CSRF token management
- `useCsrfForm()` - Hook for forms with automatic CSRF integration
- `withCsrfProtection()` - HOC for components needing CSRF tokens

### 3. Edge Function Middleware (`netlify/functions/_shared/csrf-middleware.ts`)

Provides `withCsrfProtection()` wrapper for Netlify edge functions.

### 4. API Client (`src/lib/api-client.ts`)

Axios-based API client that automatically includes CSRF tokens in state-changing requests.

## Usage Examples

### In Forms (with React Hook Form)

```tsx
import { useCsrfForm } from '@/hooks/useCsrf'

function MyForm() {
  const { csrfToken, submitWithCsrf } = useCsrfForm<FormData>()
  
  const onSubmit = submitWithCsrf(async (data) => {
    // data.csrfToken is automatically included
    await api.post('/api/submit', data)
  })
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* form fields */}
    </form>
  )
}
```

### In API Calls

```tsx
import { api } from '@/lib/api-client'

// CSRF token is automatically included
await api.post('/api/users', { name: 'John' })
await api.put('/api/users/123', { name: 'Jane' })
await api.delete('/api/users/123')
```

### In Edge Functions

```ts
import { withCsrfProtection } from './_shared/csrf-middleware'

export const handler: Handler = async (event) => {
  return withCsrfProtection(event, async (event) => {
    // Your handler logic - CSRF is already validated
  })
}
```

## Security Considerations

1. **Token Storage**: Tokens are stored in secure cookies with:
   - `Secure` flag (HTTPS only)
   - `SameSite=Strict` (prevents CSRF via third-party sites)
   - `__Host-` prefix (additional security constraints)

2. **Token Lifetime**: Tokens expire after 1 hour and are automatically refreshed

3. **User Binding**: Tokens are bound to the authenticated user session

4. **Safe Methods**: GET, HEAD, and OPTIONS requests don't require CSRF tokens

## Implementation Checklist

- [x] Core CSRF library
- [x] React hooks for token management
- [x] Form integration (LoginPage, RegisterPage, etc.)
- [x] Edge function middleware
- [x] API client with automatic CSRF headers
- [x] CORS headers updated to allow X-CSRF-Token

## Testing CSRF Protection

1. Verify tokens are included in requests:
   - Check Network tab for `X-CSRF-Token` header
   - Verify `__Host-csrf-token` cookie is set

2. Test token validation:
   - Try request without token (should fail with 403)
   - Try request with invalid token (should fail with 403)
   - Try request with expired token (should fail with 403)

3. Test token refresh:
   - Tokens should auto-refresh before expiration
   - New tokens should be generated on login

## Troubleshooting

1. **"CSRF token not found" error**
   - Ensure cookies are enabled
   - Check if on HTTPS (required for Secure cookies)
   - Verify user is authenticated

2. **"CSRF validation failed" error**
   - Token may be expired - refresh the page
   - Check if token in header matches cookie
   - Verify edge function has CSRF middleware

3. **Tokens not being sent**
   - Ensure `withCredentials: true` in API client
   - Check CORS configuration allows credentials
   - Verify cookie domain matches request domain