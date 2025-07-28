# CSRF Protection Implementation

This document describes the comprehensive Cross-Site Request Forgery (CSRF) protection implementation for the DCE platform.

## Overview

The DCE platform implements a robust CSRF protection system using the double-submit cookie pattern with additional security enhancements. This prevents malicious websites from performing unauthorized actions on behalf of authenticated users.

## Architecture

### Core Components

1. **CSRF Token Generation** (`/src/lib/csrf.ts`)
   - Cryptographically secure token generation using UUID v4
   - Session-bound tokens with user ID validation
   - Time-based expiration (1 hour default)

2. **Double-Submit Pattern**
   - Tokens stored in secure `__Host-` prefixed cookies
   - Same tokens sent in `X-CSRF-Token` headers
   - Server validates both cookie and header match

3. **React Hook Integration** (`/src/hooks/useCsrf.ts`)
   - `useCsrf()` - General CSRF token management
   - `useCsrfForm()` - Form-specific CSRF integration
   - Automatic token refresh and lifecycle management

4. **Netlify Function Middleware** (`/netlify/functions/_shared/csrf-middleware.ts`)
   - Server-side CSRF validation for all state-changing endpoints
   - Configurable skip patterns for safe methods
   - Integration with existing auth middleware

## Security Features

### Token Generation
```typescript
// Cryptographically secure tokens
const token = generateCsrfToken() // UUID v4 without hyphens

// Session-bound tokens
const boundToken = await createCsrfToken() // Includes user ID binding
```

### Secure Cookie Attributes
```typescript
// __Host- prefix ensures maximum security
const cookieString = `__Host-csrf-token=${token}; Secure; Path=/; SameSite=Strict; Expires=${expires}`
```

### Double-Submit Validation
```typescript
// Both cookie and header must match
const headerToken = request.headers.get('X-CSRF-Token')
const cookieToken = extractCsrfFromCookieHeader(request.headers.get('cookie'))

if (headerToken !== cookieToken) {
  throw new Error('CSRF token mismatch')
}
```

## Implementation Guide

### Protected Forms

All forms that modify state must use CSRF protection:

```tsx
import { useCsrfForm } from '../hooks/useCsrf'

function MyForm() {
  const { submitWithCsrf } = useCsrfForm<FormData>()
  
  const onSubmit = submitWithCsrf(async (data) => {
    // data automatically includes csrfToken
    await submitToAPI(data)
  })
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* form fields */}
    </form>
  )
}
```

### Protected API Endpoints

All Netlify functions handling state changes use CSRF middleware:

```typescript
import { withCsrfProtection } from './_shared/csrf-middleware'

export const handler: Handler = async (event) => {
  return withCsrfProtection(event, async (event) => {
    // Your handler logic here
    // CSRF token has been validated
    return { statusCode: 200, body: 'Success' }
  })
}
```

### Manual API Calls

For manual API calls, include CSRF headers:

```typescript
import { useCsrf } from '../hooks/useCsrf'

function MyComponent() {
  const { addCsrfToHeaders } = useCsrf()
  
  const makeAPICall = async () => {
    const response = await fetch('/api/endpoint', {
      method: 'POST',
      headers: addCsrfToHeaders({
        'Content-Type': 'application/json'
      }),
      body: JSON.stringify(data)
    })
  }
}
```

## Protected Endpoints

The following endpoints have CSRF protection enabled:

### Authentication
- ✅ `/netlify/functions/auth-login`
- ✅ `/netlify/functions/auth-logout`
- ✅ `/netlify/functions/auth-signup`
- ✅ `/netlify/functions/auth-magic-link`
- ✅ `/netlify/functions/auth-reset-password`

### Campaigns
- ✅ `/netlify/functions/campaigns-create`
- ✅ `/netlify/functions/campaigns-update`

### Settings & Profile
- All settings update operations (handled client-side with CSRF tokens)

## Protected Forms

The following forms include CSRF protection:

### Authentication Forms
- ✅ Login Page (`/src/pages/auth/LoginPage.tsx`)
- ✅ Registration Page (`/src/pages/auth/RegisterPage.tsx`)
- ✅ Forgot Password Page (`/src/pages/auth/ForgotPasswordPage.tsx`)

### Settings Forms
- ✅ Profile Settings (`/src/pages/settings/ProfileSettingsPage.tsx`)
- ✅ Account Settings (`/src/pages/settings/AccountSettingsPage.tsx`)
- ✅ Security Settings (`/src/pages/settings/SecuritySettingsPage.tsx`)

### Campaign Forms
- ✅ Campaign Creation (`/src/pages/campaigns/CreateCampaignPage.tsx`)

## Security Considerations

### Token Security
- Tokens are cryptographically secure (UUID v4)
- Tokens are bound to user sessions
- Tokens expire after 1 hour
- Tokens are regularly cleaned up server-side

### Cookie Security
- Uses `__Host-` prefix for maximum security
- `Secure` flag requires HTTPS
- `SameSite=Strict` prevents cross-site usage
- `Path=/` restricts to domain root

### Defense in Depth
- CSRF protection works alongside:
  - Authentication middleware
  - CORS policies
  - Content Security Policy (CSP)
  - Rate limiting

## Testing

### Unit Tests
```bash
npm test src/tests/security/csrf-protection.test.ts
```

### Integration Tests
```bash
npm test src/tests/integration/csrf-user-flows.test.ts
```

### Manual Testing
1. Open browser dev tools
2. Find `__Host-csrf-token` cookie
3. Submit form and verify `X-CSRF-Token` header matches cookie
4. Try modifying token to see rejection

## Troubleshooting

### Common Issues

#### "CSRF token not found" Error
- Check that `__Host-csrf-token` cookie is set
- Verify the form is using `useCsrfForm` hook
- Ensure the page has loaded completely before form submission

#### "CSRF token mismatch" Error
- Cookie and header tokens don't match
- Possible token tampering or corruption
- Clear cookies and refresh the page

#### "Invalid or expired CSRF token" Error
- Token has expired (>1 hour old)
- User session has changed
- Refresh the page to get a new token

### Debugging

Enable CSRF debugging in development:

```typescript
// In src/lib/csrf.ts
const DEBUG = process.env.NODE_ENV === 'development'

if (DEBUG) {
  console.log('CSRF Token:', token)
  console.log('Cookie Token:', cookieToken)
  console.log('Header Token:', headerToken)
}
```

## Performance Considerations

- Tokens are cached in memory for validation
- Expired tokens are cleaned up every 5 minutes
- Cookie operations are minimal overhead
- Form submissions include one additional field

## Future Enhancements

### Planned Improvements
1. **Token Rotation**: Implement token rotation on sensitive operations
2. **Rate Limiting**: Add rate limiting for token generation
3. **Metrics**: Add CSRF attack detection and monitoring
4. **Mobile Support**: Optimize for mobile app integration

### Security Hardening
1. **Content Security Policy**: Enhance CSP rules
2. **Subresource Integrity**: Add SRI for external resources
3. **HTTP Security Headers**: Implement additional security headers

## Compliance

This CSRF implementation helps meet security requirements for:

- **OWASP Top 10**: Addresses A01:2021 – Broken Access Control
- **PCI DSS**: Requirement 6.2 - Protect against common vulnerabilities
- **SOC 2**: Security controls for data protection
- **GDPR**: Technical safeguards for personal data

## References

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [MDN: SameSite cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
- [RFC 6265: HTTP State Management Mechanism](https://tools.ietf.org/html/rfc6265)
- [Double Submit Cookie Pattern](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#double-submit-cookie)