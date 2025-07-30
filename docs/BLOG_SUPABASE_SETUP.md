# Blog Supabase Setup Guide

This guide walks you through setting up a Supabase project for the DCE blog system.

## Prerequisites

- Node.js v22.15.0 or higher
- npm or yarn
- Supabase account (free tier is sufficient)
- Supabase CLI (optional but recommended)

## Step 1: Create Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click "New project"
3. Configure your project:
   - **Project name**: `dce-blog` (or your preferred name)
   - **Database password**: Generate a strong password and save it
   - **Region**: Choose closest to your users
   - **Plan**: Free tier is sufficient for development

4. Wait for project provisioning (takes ~2 minutes)

## Step 2: Configure Environment Variables

1. Once your project is ready, go to Settings → API
2. Copy your project credentials:
   - **Project URL**: `https://YOUR_PROJECT_ID.supabase.co`
   - **Anon public key**: `eyJ...` (safe for client-side)
   - **Service role key**: `eyJ...` (server-side only, keep secret!)

3. Set up your local environment:
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your credentials:
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_public_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## Step 3: Run Database Migrations

The blog system requires 12 migrations to be run in order. You can apply them using either method:

### Option A: Using Supabase Dashboard (Recommended for first-time setup)

1. Go to SQL Editor in your Supabase dashboard
2. Run each migration file in numerical order:

```sql
-- Run these migrations in this exact order:
018_blog_cms_tables.sql              -- Core blog tables and RLS
019_blog_content_sanitization.sql    -- Content sanitization
019_blog_infrastructure_fixes.sql    -- Performance improvements
020_blog_storage_quota_fixes.sql     -- Storage quota management
021_blog_rls_consolidation.sql       -- RLS consolidation
022_blog_word_count_tsvector.sql     -- Full-text search
023_blog_analytics_tables.sql        -- Analytics infrastructure
024_blog_extensions_fix.sql          -- Extension dependencies
024_blog_monitoring_infrastructure.sql -- Monitoring setup
025_blog_content_sanitization_trigger.sql -- Enhanced sanitization
026_blog_audit_retention.sql         -- Audit log retention
027_blog_api_performance_fixes.sql   -- API optimizations
```

### Option B: Using Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to your project
supabase link --project-ref YOUR_PROJECT_ID

# Push all migrations
supabase db push
```

## Step 4: Create Storage Bucket

1. Go to Storage in your Supabase dashboard
2. Click "New bucket"
3. Configure the bucket:
   - **Name**: `blog-images`
   - **Public**: Yes (for public blog images)
   - **File size limit**: 10MB
   - **Allowed MIME types**: 
     - `image/jpeg`
     - `image/png`
     - `image/webp`
     - `image/gif`

4. Set CORS configuration:
```json
[
  {
    "origin": ["http://localhost:5173", "https://yourdomain.com"],
    "methods": ["GET", "POST", "PUT", "DELETE"],
    "headers": ["*"],
    "maxAge": 3600
  }
]
```

## Step 5: Deploy Edge Functions

### Deploy the sanitize-html function:

```bash
# Using Supabase CLI
supabase functions deploy sanitize-html

# The function will be available at:
# https://YOUR_PROJECT_ID.supabase.co/functions/v1/sanitize-html
```

### Verify deployment:
```bash
# Test the function
curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/sanitize-html \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content": "<p>Test content</p>", "mode": "strict"}'
```

## Step 6: Generate TypeScript Types

Generate TypeScript types from your database schema:

```bash
npm run generate:types
```

This creates type-safe interfaces for all your database tables.

## Step 7: Seed Initial Data

### Option 1: Minimal seed (recommended for testing)
```bash
npm run seed:blog-content
```

### Option 2: Create blog authors first
```bash
# Create blog authors
npm run setup:blog-authors

# Then seed content
npm run seed:blog-content
```

## Step 8: Verify Setup

1. Start the development server:
```bash
npm run dev
```

2. Navigate to [http://localhost:5173/blog](http://localhost:5173/blog)

3. Verify:
   - Blog posts are displayed
   - Categories are loaded
   - Search functionality works
   - Images can be uploaded (if authenticated)

## Troubleshooting

### Common Issues

#### "Database operation failed" error
- Verify your Supabase credentials in `.env`
- Check that all migrations ran successfully
- Ensure RLS policies are enabled

#### Blog pages show homepage content
- Clear browser cache
- Restart the development server
- Check console for routing errors

#### Image upload fails
- Verify storage bucket exists and is public
- Check CORS configuration
- Ensure file size is under 10MB

### Debug Commands

```bash
# Check database connection
npx supabase db remote status

# View function logs
supabase functions logs sanitize-html

# Test RLS policies
npm run test:rls
```

## Security Checklist

- [ ] Service role key is NOT exposed to client
- [ ] RLS policies are enabled on all tables
- [ ] Storage bucket has size/type restrictions
- [ ] Edge functions have proper authentication
- [ ] Environment variables are properly set

## Next Steps

1. **Production Deployment**: See `BLOG_DEPLOYMENT_GUIDE.md`
2. **Monitoring Setup**: Configure uptime monitoring (see `docs/monitoring-setup.md`)
3. **Analytics**: Set up Google Analytics or privacy-friendly alternative
4. **CDN**: Configure image CDN for better performance
5. **Backup**: Set up automated database backups

## Maintenance

Regular maintenance tasks:
- Run audit log cleanup (monthly)
- Monitor storage usage
- Update search indexes
- Review analytics data

See `BLOG_MAINTENANCE_SCHEDULE.md` for detailed maintenance procedures.