# Netlify Deployment Guide

## Current Status
- The project has been prepared for deployment
- The `netlify.toml` configuration file has been fixed
- A previous build exists in the `dist` folder

## Quick Deployment Options

### Option 1: Manual Deployment via Netlify Web UI
1. Visit https://app.netlify.com/drop
2. Drag and drop the `dist` folder to deploy
3. Once deployed, you can claim the site and add a custom name

### Option 2: Command Line Deployment (After Manual Setup)
After creating a site via the web UI:
```bash
# Link your local project to the Netlify site
netlify link --id YOUR_SITE_ID

# Deploy updates
netlify deploy --dir=dist --prod
```

### Option 3: Full Build and Deploy
To fix remaining TypeScript errors and deploy with full CI/CD:
1. Fix the remaining TypeScript errors in:
   - `src/components/dashboard/supplier/QuickStatsBar.tsx`
   - `src/store/settingsStore.ts`
   - `src/store/supplierStore.ts`
2. Run `npm run build`
3. Deploy with `netlify deploy --dir=dist --prod`

## Environment Variables Required
After deployment, add these environment variables in Netlify dashboard:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SENTRY_DSN`

## Build Settings
- Build command: `npm run build`
- Publish directory: `dist`
- Node version: 22 (specified in netlify.toml)

## Post-Deployment Steps
1. Configure custom domain (dependablecalls.com)
2. Enable HTTPS
3. Set up environment variables
4. Test all functionality
5. Monitor build logs and edge functions