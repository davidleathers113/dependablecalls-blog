# Multi-Factor Authentication (MFA) Implementation

## Overview

The DCE platform implements a comprehensive Multi-Factor Authentication system that provides secure, user-friendly protection for all account types with role-based requirements and advanced security features.

## Architecture

### Core Components

1. **TOTP Authentication** - Time-based One-Time Passwords using industry-standard TOTP
2. **SMS Backup** - SMS-based verification with fraud protection and rate limiting  
3. **Device Trust** - Trusted device system using secure signed cookies
4. **Backup Codes** - Single-use recovery codes for account recovery
5. **Audit Logging** - Comprehensive security monitoring and forensics

### Security Features

- **Encrypted Storage** - All secrets encrypted at rest using AES-GCM
- **Rate Limiting** - SMS and verification attempt rate limiting
- **Fraud Detection** - Risk scoring for SMS requests and login attempts
- **Device Fingerprinting** - Browser-based device identification
- **Audit Trail** - Complete logging of all MFA events
- **Role-Based Enforcement** - Different MFA requirements by user type

## Database Schema

### Core Tables

```sql
-- MFA secrets (encrypted TOTP secrets and backup codes)
mfa_secrets (
    id, user_id, secret_encrypted, backup_codes_encrypted,
    is_active, verified_at, created_at, updated_at
)

-- Trusted devices with expiration
mfa_trusted_devices (
    id, user_id, device_fingerprint, device_name, trusted_until,
    last_used_at, ip_address, user_agent, is_active, created_at
)

-- Single-use backup codes
mfa_backup_codes (
    id, user_id, code_hash, used_at, created_at
)

-- SMS verification codes
mfa_sms_verifications (
    id, user_id, phone_number_encrypted, verification_code_hash,
    expires_at, attempts, verified_at, created_at
)

-- User MFA settings and preferences
mfa_settings (
    user_id, totp_enabled, sms_backup_enabled, backup_codes_generated,
    require_mfa, trusted_devices_enabled, sms_rate_limit_count,
    sms_rate_limit_reset_at, last_backup_codes_viewed, created_at, updated_at
)

-- Security audit logs
mfa_audit_logs (
    id, user_id, action, method, success, ip_address, user_agent,
    details, risk_score, created_at
)
```

## Role-Based MFA Policy

### MFA Requirements by User Type

- **Admin Users**: MFA Required (mandatory setup and verification)
- **Buyer Users**: MFA Required (mandatory setup and verification)  
- **Supplier Users**: MFA Optional (can enable if desired)
- **Network Users**: MFA Required (mandatory setup and verification)

### Enforcement Logic

```typescript
const MFA_ROLE_POLICY: RoleMFAPolicy = {
  admin: 'required',    // Must use MFA
  buyer: 'required',    // Must use MFA  
  supplier: 'optional', // Optional MFA
  network: 'required'   // Must use MFA
}
```

## API Endpoints

### MFA Setup

```
POST /api/mfa/setup
GET /api/mfa/status
```

**Setup TOTP**
```json
{
  "action": "setup_totp"
}
```

**Verify TOTP Setup**
```json
{
  "action": "verify_totp_setup",
  "code": "123456"
}
```

**Setup SMS Backup**
```json
{
  "action": "setup_sms", 
  "phoneNumber": "+15551234567"
}
```

### MFA Verification

```
POST /api/mfa/verify
```

```json
{
  "method": "totp|sms|backup_code",
  "code": "123456",
  "trustDevice": true
}
```

## Security Implementation

### TOTP Security

- **Algorithm**: HMAC-SHA1 (RFC 6238 standard)
- **Code Length**: 6 digits
- **Time Window**: 30 seconds
- **Clock Skew**: ±1 period tolerance
- **Secret Storage**: AES-GCM encrypted with application key

### SMS Security

- **Code Length**: 6 digits (numeric only)
- **Expiration**: 10 minutes
- **Rate Limiting**: 5 SMS per hour per user
- **Fraud Detection**: Phone number validation, pattern detection
- **Storage**: Phone numbers encrypted, codes hashed

### Device Trust Security

- **Cookie Security**: HttpOnly, Secure, SameSite=Strict
- **Signature**: HMAC-SHA256 signed cookies
- **Expiration**: 30 days default
- **Fingerprinting**: Browser characteristics, WebGL, Canvas
- **Revocation**: Server-side device management

### Backup Codes Security

- **Format**: 8-character alphanumeric (XXXX-XXXX)
- **Quantity**: 10 codes generated
- **Usage**: Single-use only
- **Storage**: SHA-256 hashed
- **Display**: Only shown once during setup

## User Experience

### Setup Flow

1. **Overview Screen** - Explains MFA benefits and requirements
2. **TOTP Setup** - QR code generation and app instructions
3. **TOTP Verification** - Code verification to activate
4. **Backup Codes** - Display and secure storage instructions
5. **SMS Setup** (Optional) - Phone number verification
6. **Completion** - Summary and next steps

### Verification Flow

1. **Method Selection** - Choose TOTP/SMS/Backup Code
2. **Code Entry** - User-friendly input with validation
3. **Device Trust** - Option to trust device for 30 days
4. **Success/Error** - Clear feedback and alternative methods

### Management Interface

- **Status Dashboard** - Current MFA configuration
- **Method Management** - Enable/disable methods
- **Trusted Devices** - View and revoke trusted devices
- **Backup Codes** - Generate new codes (with warnings)
- **Audit Log** - Recent authentication events

## Error Handling

### Client-Side Errors

```typescript
interface MFAError {
  code: string
  message: string
  statusCode: number
}

// Common error codes
'MFA_SETUP_REQUIRED' | 'MFA_VERIFICATION_REQUIRED' |
'INVALID_CODE' | 'RATE_LIMITED' | 'DEVICE_NOT_TRUSTED'
```

### Server-Side Protection

- **Rate Limiting**: Exponential backoff for failed attempts
- **Account Lockout**: Temporary lockout after multiple failures  
- **Anomaly Detection**: Unusual patterns trigger additional verification
- **Audit Alerts**: High-risk events logged for review

## Testing Strategy

### Unit Tests

- TOTP generation and verification
- SMS code generation and validation
- Device fingerprinting and verification
- Backup code creation and usage
- Rate limiting logic
- Encryption/decryption functions

### Integration Tests

- Complete setup flows
- Verification workflows
- Database operations
- API endpoint functionality
- Error handling scenarios

### Security Tests

- Timing attack resistance
- Cryptographic security
- Rate limiting effectiveness
- Device trust validation
- Audit logging completeness

## Deployment Considerations

### Environment Variables

```bash
# Encryption
MFA_ENCRYPTION_KEY=<32-byte-hex-key>

# SMS (Twilio)
TWILIO_ACCOUNT_SID=<account-sid>
TWILIO_AUTH_TOKEN=<auth-token>
TWILIO_FROM_NUMBER=<phone-number>

# Device Trust
DEVICE_TRUST_SIGNING_KEY=<hmac-key>

# Security
MFA_MAX_FAILED_ATTEMPTS=5
MFA_LOCKOUT_MINUTES=30
SMS_RATE_LIMIT_WINDOW=60
```

### Database Setup

1. Run migration: `007_mfa_system.sql`
2. Verify RLS policies are active
3. Grant appropriate permissions
4. Set up data retention policies

### Monitoring

- **Metrics**: Setup rates, verification success rates
- **Alerts**: High failure rates, anomalous patterns
- **Logs**: All MFA events with risk scores
- **Performance**: Response times, database load

## Compliance and Standards

### Standards Compliance

- **RFC 6238**: TOTP implementation
- **RFC 4226**: HOTP base standard  
- **NIST SP 800-63B**: Digital identity guidelines
- **OWASP**: Secure coding practices

### Privacy Considerations

- **Data Minimization**: Only collect necessary data
- **Encryption**: All sensitive data encrypted
- **Retention**: Automatic cleanup of expired data
- **Consent**: Clear privacy notices and controls

## Maintenance

### Regular Tasks

- **Secret Rotation**: Rotate encryption keys annually
- **Cleanup**: Remove expired verification codes and trusted devices
- **Monitoring**: Review audit logs for suspicious activity
- **Updates**: Keep cryptographic libraries current

### Troubleshooting

Common issues and solutions:

1. **Clock Skew**: Verify server time synchronization
2. **SMS Delivery**: Check Twilio logs and number formatting
3. **Device Trust**: Validate cookie signatures and expiration
4. **Rate Limiting**: Monitor and adjust limits based on usage

## Future Enhancements

### Planned Features

- **WebAuthn Support**: Hardware security key integration
- **Push Notifications**: Mobile app push verification
- **Risk-Based Auth**: Adaptive authentication based on context
- **Admin Override**: Emergency access procedures
- **Bulk Management**: Admin tools for user MFA management

### Security Roadmap

- **FIDO2 Integration**: Hardware authenticator support  
- **Behavioral Analytics**: Advanced fraud detection
- **Zero-Trust**: Continuous verification model
- **Quantum Resistance**: Post-quantum cryptography preparation