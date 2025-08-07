# 🚀 Netlify Deployment Checklist

## CRITICAL: Required Environment Variables

These environment variables **MUST** be set in Netlify Dashboard before deployment:

### 1. Supabase Configuration (REQUIRED)
```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```
**🔗 Get from**: [Supabase Dashboard](https://supabase.com/dashboard) → Project Settings → API

### 2. Sentry Error Monitoring (RECOMMENDED)
```bash
VITE_SENTRY_DSN=your-sentry-dsn
```
**🔗 Get from**: [Sentry Dashboard](https://sentry.io) → Project Settings → Client Keys

### 3. Stripe Payment Processing (FOR PRODUCTION)
```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```
**🔗 Get from**: [Stripe Dashboard](https://dashboard.stripe.com) → Developers → API Keys

## Netlify Configuration Steps

### Step 1: Environment Variables Setup
1. Go to **Netlify Dashboard** → Your Site → **Site settings** → **Environment variables**
2. Click **Add variable** for each required variable above
3. **IMPORTANT**: Use the exact variable names (case-sensitive)

### Step 2: Build Configuration Verification
Ensure your `netlify.toml` contains:
```toml
[build]
  command = "npm run build"
  functions = "netlify/functions"
  publish = "dist"

[build.environment]
  NODE_VERSION = "22"
  NPM_VERSION = "10"
```

### Step 3: Security Headers Validation
The application includes CSP headers. Verify no build warnings about:
- `unsafe-inline`
- `eval()` usage (warnings are expected for CSP nonce generation)

## 🔍 Deployment Verification Checklist

After deployment, verify:

### ✅ Critical Functionality
- [ ] Homepage loads without errors
- [ ] Authentication flow works (magic link)
- [ ] Dashboard access for each role (Supplier/Buyer/Admin/Network)
- [ ] Blog pages load correctly
- [ ] No JavaScript console errors

### ✅ Environment Variables Working
- [ ] Supabase connection successful (no "Missing credentials" errors)
- [ ] Sentry error reporting active (check Sentry dashboard)
- [ ] API endpoints responding correctly

### ✅ Security Validation
- [ ] No hardcoded credentials in deployed files
- [ ] CSP headers present in response
- [ ] HTTPS enforced
- [ ] No mixed content warnings

## 🚨 Troubleshooting Common Issues

### Issue: "Missing Supabase credentials" Error
**Solution**: Double-check environment variables in Netlify Dashboard:
1. Variable names match exactly: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
2. No extra spaces in values
3. Redeploy after setting variables

### Issue: Build Fails with "Module not found"
**Solution**: 
1. Check `package.json` dependencies
2. Verify Node.js version compatibility
3. Clear build cache: Deploy → Clear cache and deploy site

### Issue: Functions Not Working
**Solution**:
1. Verify `netlify/functions` directory structure
2. Check function-specific environment variables
3. Review function logs in Netlify Dashboard

## 🔗 Post-Deployment Actions

1. **Test all user journeys** (Supplier, Buyer, Admin workflows)
2. **Monitor Sentry** for any production errors
3. **Check Netlify Analytics** for performance metrics
4. **Update DNS** if using custom domain
5. **Enable branch deployments** for staging

## 📊 Performance Expectations

Target metrics after deployment:
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s  
- **Cumulative Layout Shift**: < 0.1
- **Time to Interactive**: < 3s

## 🔒 Security Compliance

This deployment includes:
- Content Security Policy (CSP) v3
- No hardcoded secrets
- Encrypted environment variables
- Rate limiting on API endpoints
- Input validation on all forms