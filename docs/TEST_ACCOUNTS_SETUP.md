# Test Accounts Setup Guide

This guide provides instructions for setting up test accounts in the DCE platform for development and testing purposes.

## 🔒 Security First Approach

This setup uses a secure, transactional approach to create test accounts:
- **Random password generation** - No hardcoded credentials
- **Transactional user creation** - Prevents orphaned records
- **One-time credential display** - Passwords shown only during setup
- **No credential storage** - Nothing sensitive written to files

## Quick Start

1. **Ensure environment variables are set**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local and add your Supabase credentials
   # NEVER commit .env.local to version control!
   ```

2. **Run the test account setup script**:
   ```bash
   npm run setup:test-accounts
   ```
   
   The script will:
   - Generate secure random passwords
   - Create accounts transactionally
   - Display credentials ONCE in the terminal
   - Update seed.sql with actual UUIDs

3. **Save the displayed credentials securely**:
   - Copy credentials from terminal output immediately
   - Store in a password manager or secure location
   - Never commit credentials to version control

4. **Reset database with seed data**:
   ```bash
   npx supabase db reset
   ```

## Test Account Profiles

### Admin Account
- **Purpose**: Full system administration and testing admin-only features
- **Email**: `admin@dce-test.com`
- **Access Level**: Super Admin with all permissions
- **Key Features**:
  - User management
  - Financial management
  - System configuration
  - View all data across the platform

### Supplier Account
- **Purpose**: Testing traffic provider functionality
- **Email**: `supplier@dce-test.com`
- **Company**: Test Traffic Co
- **Initial Credit**: $1,500.00
- **Key Features**:
  - Create and manage campaigns
  - View call analytics
  - Track earnings and payouts
  - Real-time call monitoring

### Buyer Account 1 (Standard)
- **Purpose**: Testing standard buyer functionality
- **Email**: `buyer@dce-test.com`
- **Company**: Insurance Plus LLC
- **Credit Limit**: $10,000.00
- **Current Balance**: $8,500.00
- **Key Features**:
  - Create buyer campaigns
  - Set targeting criteria
  - View and manage leads
  - Track spending

### Buyer Account 2 (Premium)
- **Purpose**: Testing premium buyer features
- **Email**: `buyer2@dce-test.com`
- **Company**: Premium Legal Services
- **Credit Limit**: $25,000.00
- **Current Balance**: $22,000.00
- **Key Features**:
  - Higher credit limits
  - Premium campaign features
  - Advanced analytics access

## Manual Test Account Creation

For CI/CD or manual testing, you can create accounts programmatically:

### 1. Using the Transactional Function

The safest way is to use the provided PostgreSQL function:

```sql
-- Create a test account with all related records in one transaction
SELECT create_full_user(
  p_email := 'test@example.com',
  p_password := 'GenerateSecurePasswordHere',
  p_first_name := 'Test',
  p_last_name := 'User',
  p_user_type := 'supplier',  -- 'admin', 'supplier', 'buyer', or 'network'
  p_company := 'Test Company',
  p_business_type := 'Technology'
);
```

### 2. For CI/CD Environments

Store credentials securely in your CI/CD system:

```bash
# GitHub Actions example
- name: Create test accounts
  env:
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
  run: npm run setup:test-accounts

# Store generated passwords as artifacts or in secret management
```

### 3. Security Best Practices

- **Never hardcode passwords** in scripts or documentation
- **Use environment variables** for service role keys
- **Generate unique passwords** for each test run
- **Clean up test data** after testing with:
  ```sql
  SELECT cleanup_test_users();
  ```

## Testing Different User Flows

### Supplier Flow
1. Log in with supplier credentials
2. Create a new campaign
3. Add tracking numbers
4. Monitor real-time calls
5. Check earnings dashboard

### Buyer Flow
1. Log in with buyer credentials
2. Create buyer campaigns
3. Set targeting criteria
4. View incoming leads
5. Track spending and ROI

### Admin Flow
1. Log in with admin credentials
2. Review pending user approvals
3. Monitor platform metrics
4. Manage user accounts
5. Configure system settings

## Troubleshooting

### Common Issues

1. **"User already exists" error**:
   - Delete existing user from Supabase Auth dashboard
   - Or use a different email address

2. **Missing environment variables**:
   - Ensure `VITE_SUPABASE_URL` is set
   - Ensure `SUPABASE_SERVICE_ROLE_KEY` is set

3. **Database schema mismatch**:
   - Run `npx supabase db reset` to ensure latest schema
   - Check migration files are up to date

4. **Authentication errors**:
   - Verify Supabase project is running
   - Check redirect URLs in Supabase dashboard
   - Ensure cookies are enabled in browser

### Resetting Test Data

To completely reset all test data:

```bash
# Reset database (removes all data)
npx supabase db reset

# Re-run test account setup
npm run setup:test-accounts

# Apply seed data again
npx supabase db reset
```

## 🔒 Security Notes

### Critical Security Requirements

⚠️ **PRODUCTION SAFETY**:
1. **Service Role Key Protection**
   - NEVER commit `SUPABASE_SERVICE_ROLE_KEY` to version control
   - Store only in CI/CD secrets or secure vaults
   - This key bypasses all Row Level Security!

2. **Password Management**
   - Script generates cryptographically secure random passwords
   - Passwords are displayed ONCE and never stored
   - Each run generates completely new passwords
   - No predictable patterns that could be exploited

3. **Test Data Isolation**
   - Test accounts are clearly marked with @dce-test.com domain
   - Use `cleanup_test_users()` function to remove all test data
   - Never reuse test account patterns in production

4. **Environment Separation**
   - Use `.env.local` for local development (gitignored)
   - Use CI/CD secrets for automated testing
   - Never share service role keys between environments

### Compliance Notes
- Meets OWASP A02:2021 (Cryptographic Failures) requirements
- Prevents CWE-798 (Use of Hard-coded Credentials)
- Implements defense against credential stuffing attacks

## Related Documentation

- [Authentication System](./auth/README.md)
- [Database Schema](../supabase/README.md)
- [User Roles and Permissions](./RBAC.md)
- [Local Development Setup](../README.md#local-development)