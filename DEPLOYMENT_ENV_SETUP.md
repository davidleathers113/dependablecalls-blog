# Environment Variables Setup for DCE Platform

## 🚨 CRITICAL: Never Hardcode Keys in Source Code

Following 2025 security best practices, ALL environment variables must be configured through your deployment platform (Netlify), NOT hardcoded in source files.

## Why This Matters

1. **Security**: Even "public" keys should never be in source code
2. **Key Rotation**: Update keys without code changes
3. **Environment Isolation**: Different keys for dev/staging/prod
4. **Compliance**: Meets security audit requirements
5. **Best Practices**: Follows OWASP and industry standards

## Required Environment Variables

### For Netlify Deployment

Set these in Netlify Dashboard → Site Settings → Environment Variables:

```bash
# Supabase Configuration (REQUIRED)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key

# Stripe Configuration (REQUIRED for payments)
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Sentry Monitoring (OPTIONAL but recommended)
VITE_SENTRY_DSN=https://...@sentry.io/...

# Blog Configuration
VITE_BLOG_STORAGE_BUCKET=blog-images
VITE_BLOG_MAX_IMAGE_SIZE_MB=10
VITE_BLOG_ALLOWED_IMAGE_TYPES=image/jpeg,image/png,image/webp,image/gif

# Feature Flags
VITE_USE_MOCK_DATA=false
VITE_USE_MOCK_BLOG_DATA=false
```

## Setting Environment Variables in Netlify

### Method 1: Netlify Dashboard (Recommended)

1. Go to [Netlify Dashboard](https://app.netlify.com)
2. Select your site
3. Navigate to **Site Configuration** → **Environment Variables**
4. Click **Add a variable**
5. Add each variable with its key and value
6. Deploy context: Set to "All" or specify per environment
7. Click **Save**
8. Trigger a new deployment for changes to take effect

### Method 2: Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Set environment variables
netlify env:set VITE_SUPABASE_URL "https://your-project.supabase.co"
netlify env:set VITE_SUPABASE_ANON_KEY "your-anon-key"

# List all environment variables
netlify env:list

# Deploy with new variables
netlify deploy --prod
```

### Method 3: netlify.toml (NOT for secrets)

Only use for non-sensitive configuration:

```toml
[build.environment]
  VITE_APP_VERSION = "1.0.0"
  VITE_BLOG_STORAGE_BUCKET = "blog-images"
```

## Local Development Setup

### Create .env.local file (git-ignored)

```bash
# Copy the example file
cp .env.example .env.local

# Edit with your development values
nano .env.local
```

### .env.local contents:

```bash
# Development Supabase instance
VITE_SUPABASE_URL=https://your-dev-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-dev-anon-key

# Test Stripe keys
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
```

## Troubleshooting

### Error: "Missing Supabase credentials"

**Solution**: Environment variables are not set in Netlify

1. Check Netlify Dashboard → Environment Variables
2. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set
3. Redeploy the site

### Error: 401 Unauthorized from Supabase

**Causes**:
- Incorrect or expired anon key
- Wrong Supabase project URL
- Environment variables not loaded during build

**Solution**:
1. Get fresh keys from Supabase Dashboard → Settings → API
2. Update in Netlify Environment Variables
3. Clear build cache and redeploy:
   ```bash
   netlify deploy --prod --clear-cache
   ```

### Environment Variables Not Working

**Check build logs**:
```bash
netlify build
```

**Verify variables are set**:
```bash
netlify env:list
```

**Clear cache and rebuild**:
```bash
netlify build --clear-cache
netlify deploy --prod
```

## Security Best Practices

### DO ✅
- Use Netlify's environment variable system
- Rotate keys regularly
- Use different keys for dev/staging/prod
- Monitor key usage in Supabase/Stripe dashboards
- Set up alerts for suspicious activity

### DON'T ❌
- Hardcode keys in source files
- Commit .env.local to git
- Share keys in Slack/email
- Use production keys in development
- Log environment variables

## Getting Your Supabase Keys

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **API**
4. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (for Edge Functions only)

## Verification

After deployment, verify environment variables are working:

1. Check browser console for errors
2. Test API calls to Supabase
3. Verify blog posts load correctly
4. Check network tab for 401 errors

## CI/CD Pipeline

For GitHub Actions or other CI/CD:

```yaml
# .github/workflows/deploy.yml
env:
  VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
  VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
```

## Additional Resources

- [Netlify Environment Variables Docs](https://docs.netlify.com/environment-variables/overview/)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Supabase API Keys](https://supabase.com/docs/guides/api/keys)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

## Support

If you continue to experience issues:
1. Check Netlify build logs
2. Verify environment variables in Netlify dashboard
3. Ensure Supabase project is active and keys are valid
4. Contact support with specific error messages