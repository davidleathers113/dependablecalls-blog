# DCE Blog Deployment Guide

## Table of Contents

1. [Pre-deployment Checklist](#pre-deployment-checklist)
2. [Environment Variable Configuration](#environment-variable-configuration)
3. [Step-by-Step Deployment Process](#step-by-step-deployment-process)
4. [Rollback Procedures](#rollback-procedures)
5. [Monitoring and Maintenance Tasks](#monitoring-and-maintenance-tasks)
6. [Common Troubleshooting Scenarios](#common-troubleshooting-scenarios)

## Pre-deployment Checklist

### Code and Dependencies

- [ ] All TypeScript errors resolved (`npm run type-check`)
- [ ] ESLint passing with no errors (`npm run lint`)
- [ ] All tests passing:
  - [ ] Unit tests (`npm run test:blog`)
  - [ ] Integration tests (`npm run test:integration`)
  - [ ] E2E tests (`npm run test:e2e`)
- [ ] Type coverage meets minimum 90% (`npm run type-check:ci`)
- [ ] Build completes successfully (`npm run build`)
- [ ] No console errors in development mode (`npm run dev`)
- [ ] All npm dependencies up to date and audited
- [ ] No security vulnerabilities (`npm audit`)

### Database Requirements

- [ ] Supabase project created and configured
- [ ] Database migrations tested in staging:
  - [ ] `018_blog_cms_tables.sql`
  - [ ] `019_blog_content_sanitization.sql`
  - [ ] `019_blog_infrastructure_fixes.sql`
  - [ ] `020_blog_storage_quota_fixes.sql`
  - [ ] `021_blog_rls_consolidation.sql`
  - [ ] `022_blog_word_count_tsvector.sql`
  - [ ] `023_blog_analytics_tables.sql`
- [ ] RLS policies tested with different user roles
- [ ] Database indexes created and optimized
- [ ] Storage buckets configured (`blog-images`)
- [ ] Edge functions deployed (`sanitize-html`)

### Infrastructure Prerequisites

- [ ] Netlify account with appropriate plan
- [ ] Supabase production project provisioned
- [ ] Domain/subdomain configured
- [ ] SSL certificates active
- [ ] CDN configured for static assets
- [ ] Monitoring tools set up (Sentry, analytics)
- [ ] Backup strategy in place

### Content Preparation

- [ ] Initial blog content ready (at least 5 posts)
- [ ] Author profiles created
- [ ] Categories and tags defined
- [ ] Image assets optimized and uploaded
- [ ] SEO metadata configured
- [ ] Legal pages ready (privacy policy, terms)

## Environment Variable Configuration

### Production Environment Variables

Create `.env.production` file with the following variables:

```bash
# Supabase Configuration (Client-safe)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Analytics and Monitoring (Client-safe)
VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
VITE_GA_TRACKING_ID=G-XXXXXXXXXX

# Feature Flags (Client-safe)
VITE_ENABLE_BLOG_COMMENTS=false
VITE_ENABLE_BLOG_ANALYTICS=true
VITE_ENABLE_BLOG_NEWSLETTER=true

# Server-only Variables (Netlify Build Environment)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SENTRY_AUTH_TOKEN=your-sentry-auth-token
NETLIFY_SITE_ID=your-netlify-site-id
```

### Netlify Environment Configuration

Set environment variables in Netlify dashboard:

```bash
# Production Context
netlify env:set VITE_SUPABASE_URL "https://your-project.supabase.co" --context production
netlify env:set VITE_SUPABASE_ANON_KEY "your-anon-key" --context production
netlify env:set SUPABASE_SERVICE_ROLE_KEY "your-service-key" --context production --secret
netlify env:set SENTRY_AUTH_TOKEN "your-sentry-token" --context production --secret
```

### Security Notes

- **NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` to the client
- Use `VITE_` prefix only for client-safe variables
- Store sensitive keys in Netlify's secure environment
- Rotate keys regularly (every 90 days)
- Use different keys for staging/production

## Step-by-Step Deployment Process

### Phase 1: Database Setup (30-45 minutes)

1. **Backup Existing Database**
   ```bash
   # Create backup of current production database
   supabase db dump -f backup-$(date +%Y%m%d-%H%M%S).sql
   ```

2. **Apply Blog Migrations**
   ```bash
   # Connect to production project
   supabase link --project-ref your-project-ref
   
   # Apply migrations in order
   supabase db push
   
   # Verify migrations
   supabase db migrations list
   ```

3. **Configure Storage Buckets**
   ```sql
   -- Run in Supabase SQL editor
   INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
   VALUES (
     'blog-images',
     'blog-images', 
     true,
     52428800, -- 50MB limit
     ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
   );
   ```

4. **Deploy Edge Functions**
   ```bash
   # Deploy content sanitization function
   supabase functions deploy sanitize-html --no-verify-jwt
   
   # Deploy image optimization function (if applicable)
   supabase functions deploy optimize-image
   ```

5. **Verify RLS Policies**
   ```sql
   -- Test anonymous read access
   SET ROLE anon;
   SELECT * FROM blog_posts WHERE status = 'published' LIMIT 1;
   
   -- Test author access
   SET ROLE authenticated;
   SELECT * FROM blog_posts WHERE author_id = 'test-author-id';
   ```

### Phase 2: Application Build (15-20 minutes)

1. **Install Dependencies**
   ```bash
   # Clean install to ensure consistency
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Run Pre-deployment Tests**
   ```bash
   # Type checking
   npm run type-check:comprehensive
   
   # Linting
   npm run lint
   
   # Test suite
   npm run test:ci
   ```

3. **Production Build**
   ```bash
   # Build application
   npm run build
   
   # Test production build locally
   npm run preview
   ```

4. **Bundle Analysis** (optional)
   ```bash
   # Analyze bundle size
   npx vite-bundle-visualizer
   ```

### Phase 3: Deployment to Netlify (20-30 minutes)

1. **Deploy to Staging First**
   ```bash
   # Deploy to staging branch
   git checkout -b blog-deployment-staging
   git push origin blog-deployment-staging
   
   # Deploy to Netlify staging
   netlify deploy --dir=dist --alias=blog-staging
   ```

2. **Run Staging Tests**
   ```bash
   # E2E tests against staging
   PLAYWRIGHT_BASE_URL=https://blog-staging.netlify.app npm run test:e2e
   
   # Lighthouse performance audit
   npx lighthouse https://blog-staging.netlify.app/blog --view
   ```

3. **Deploy to Production**
   ```bash
   # Merge to main branch
   git checkout main
   git merge blog-deployment-staging
   git push origin main
   
   # Production deployment (automatic via Netlify)
   # Or manual deployment:
   netlify deploy --dir=dist --prod
   ```

4. **Verify Deployment**
   ```bash
   # Check deployment status
   netlify status
   
   # Test production endpoints
   curl -I https://dependablecalls.com/blog
   curl https://dependablecalls.com/.netlify/functions/blog-health
   ```

### Phase 4: Post-deployment Tasks (30-45 minutes)

1. **Seed Initial Content**
   ```bash
   # Run content seeding script
   npm run seed:blog-content
   
   # Or use Supabase SQL
   psql $DATABASE_URL < supabase/seed_blog.sql
   ```

2. **Configure Analytics**
   ```javascript
   // Verify analytics tracking
   gtag('config', 'G-XXXXXXXXXX', {
     page_path: '/blog/*'
   });
   ```

3. **Set Up Monitoring**
   ```bash
   # Configure Sentry alerts
   sentry-cli releases new blog-v1.0.0
   sentry-cli releases files blog-v1.0.0 upload-sourcemaps ./dist
   sentry-cli releases finalize blog-v1.0.0
   ```

4. **Update DNS/Routing**
   ```bash
   # Update _redirects file in public/
   /blog/* /blog/index.html 200
   ```

5. **Enable Cron Jobs**
   ```sql
   -- Enable maintenance cron jobs
   SELECT cron.schedule(
     'analyze-blog-tables',
     '0 2 * * *',
     'SELECT analyze_blog_tables();'
   );
   
   SELECT cron.schedule(
     'cleanup-old-analytics',
     '0 3 * * 0',
     'SELECT cleanup_old_analytics_data();'
   );
   ```

## Rollback Procedures

### Immediate Rollback (< 5 minutes)

1. **Netlify Instant Rollback**
   ```bash
   # List recent deployments
   netlify deploys:list
   
   # Rollback to previous deployment
   netlify rollback
   ```

2. **Database Rollback**
   ```bash
   # If migrations need reverting
   supabase db reset --linked
   psql $DATABASE_URL < backup-20240101-120000.sql
   ```

### Partial Rollback

1. **Feature Flag Disable**
   ```bash
   # Disable blog feature via environment variable
   netlify env:set VITE_ENABLE_BLOG false --context production
   netlify build && netlify deploy --prod
   ```

2. **Database Feature Disable**
   ```sql
   -- Temporarily disable blog access
   ALTER TABLE blog_posts DISABLE ROW LEVEL SECURITY;
   
   -- Or update feature flag table
   UPDATE feature_flags SET enabled = false WHERE feature = 'blog';
   ```

### Complete Rollback Process

1. **Step 1: Stop Traffic**
   ```bash
   # Update _redirects to maintenance page
   echo "/blog/* /maintenance.html 302" > public/_redirects
   netlify deploy --dir=public --prod
   ```

2. **Step 2: Restore Database**
   ```bash
   # Restore from backup
   psql $DATABASE_URL < backup-pre-blog.sql
   
   # Or run rollback migration
   psql $DATABASE_URL < supabase/migrations/rollback_blog_cms_complete.sql
   ```

3. **Step 3: Redeploy Previous Version**
   ```bash
   # Checkout previous release
   git checkout tags/v1.0.0
   npm install
   npm run build
   netlify deploy --dir=dist --prod
   ```

4. **Step 4: Clear Caches**
   ```bash
   # Clear Netlify cache
   netlify build:clear
   
   # Clear CDN cache if applicable
   curl -X POST "https://api.cloudflare.com/client/v4/zones/ZONE_ID/purge_cache" \
     -H "Authorization: Bearer TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"purge_everything":true}'
   ```

## Monitoring and Maintenance Tasks

### Daily Monitoring

1. **Health Checks**
   ```bash
   # Automated health check
   curl https://dependablecalls.com/.netlify/functions/blog-health
   
   # Check specific endpoints
   curl -I https://dependablecalls.com/blog
   curl -I https://dependablecalls.com/blog/api/posts
   ```

2. **Error Monitoring**
   - Check Sentry dashboard for new errors
   - Review Netlify function logs
   - Monitor Supabase logs for database errors

3. **Performance Metrics**
   ```sql
   -- Check slow queries
   SELECT query, mean_exec_time, calls 
   FROM pg_stat_statements 
   WHERE query LIKE '%blog_%'
   ORDER BY mean_exec_time DESC 
   LIMIT 10;
   
   -- Check table sizes
   SELECT 
     tablename,
     pg_size_pretty(pg_total_relation_size(tablename::regclass)) as size
   FROM pg_tables 
   WHERE tablename LIKE 'blog_%'
   ORDER BY pg_total_relation_size(tablename::regclass) DESC;
   ```

### Weekly Maintenance

1. **Database Optimization**
   ```sql
   -- Run vacuum and analyze
   SELECT vacuum_blog_tables();
   SELECT analyze_blog_tables();
   
   -- Reindex if needed
   SELECT reindex_blog_search();
   ```

2. **Content Audit**
   ```sql
   -- Check for orphaned images
   SELECT COUNT(*) FROM storage.objects 
   WHERE bucket_id = 'blog-images' 
   AND created_at < NOW() - INTERVAL '30 days'
   AND name NOT IN (
     SELECT featured_image_url FROM blog_posts
   );
   
   -- Review draft posts
   SELECT id, title, created_at 
   FROM blog_posts 
   WHERE status = 'draft' 
   AND created_at < NOW() - INTERVAL '30 days';
   ```

3. **Security Review**
   ```bash
   # Check for dependency vulnerabilities
   npm audit
   
   # Review access logs
   netlify logs:access --filter="status>=400"
   ```

### Monthly Maintenance

1. **Performance Review**
   ```bash
   # Generate performance report
   lighthouse https://dependablecalls.com/blog \
     --output=json \
     --output-path=./reports/lighthouse-$(date +%Y%m).json
   ```

2. **Backup Verification**
   ```bash
   # Test backup restoration
   supabase db dump -f monthly-backup.sql
   # Restore to test environment and verify
   ```

3. **Analytics Review**
   ```sql
   -- Popular content report
   SELECT * FROM get_popular_posts(30, 20);
   
   -- Search performance
   SELECT * FROM blog_search_performance 
   WHERE period = 'last_30_days';
   ```

## Common Troubleshooting Scenarios

### Issue 1: Blog Posts Not Loading

**Symptoms**: 404 errors or empty blog listing

**Diagnosis**:
```bash
# Check RLS policies
supabase db lint

# Test API endpoint
curl https://dependablecalls.com/blog/api/posts

# Check Supabase connection
curl https://your-project.supabase.co/rest/v1/blog_posts?status=eq.published
```

**Solutions**:
1. Verify environment variables are set correctly
2. Check RLS policies allow anonymous reads
3. Ensure posts have `status = 'published'`
4. Clear browser cache and CDN cache

### Issue 2: Image Upload Failures

**Symptoms**: Failed image uploads or missing images

**Diagnosis**:
```sql
-- Check storage quota
SELECT 
  ba.id,
  ba.display_name,
  ba.storage_quota_mb,
  COALESCE(SUM(so.size), 0) / 1024 / 1024 as used_mb
FROM blog_authors ba
LEFT JOIN storage.objects so ON so.owner = ba.user_id
GROUP BY ba.id;
```

**Solutions**:
1. Increase author storage quota
2. Check file size limits in bucket configuration
3. Verify CORS policy allows uploads
4. Check Supabase storage policies

### Issue 3: Search Not Working

**Symptoms**: No search results or errors

**Diagnosis**:
```sql
-- Check search vector generation
SELECT id, title, search_vector IS NOT NULL as has_vector
FROM blog_posts
WHERE status = 'published'
LIMIT 10;

-- Test search query
SELECT * FROM blog_posts
WHERE search_vector @@ plainto_tsquery('english', 'test query');
```

**Solutions**:
1. Rebuild search vectors: `UPDATE blog_posts SET search_vector = NULL;`
2. Check pg_trgm extension is enabled
3. Verify search trigger is active
4. Reindex search columns

### Issue 4: Performance Issues

**Symptoms**: Slow page loads, timeouts

**Diagnosis**:
```bash
# Check Netlify function performance
netlify functions:log blog-api --tail

# Database query analysis
EXPLAIN ANALYZE SELECT * FROM blog_posts WHERE status = 'published';
```

**Solutions**:
1. Enable query caching in React Query
2. Implement pagination for large datasets
3. Add missing database indexes
4. Enable Netlify Edge caching
5. Optimize images (WebP, responsive sizes)

### Issue 5: Content Sanitization Errors

**Symptoms**: HTML content not rendering or XSS warnings

**Diagnosis**:
```javascript
// Test sanitization function
const response = await fetch('/.netlify/functions/sanitize-html', {
  method: 'POST',
  body: JSON.stringify({ html: '<script>alert("test")</script>' })
});
console.log(await response.json());
```

**Solutions**:
1. Check edge function deployment
2. Verify DOMPurify configuration
3. Update Content Security Policy
4. Review sanitization rules

### Emergency Contacts

- **Netlify Support**: support@netlify.com
- **Supabase Support**: support@supabase.com
- **On-call Engineer**: [Your contact info]
- **Escalation**: [Management contact]

### Monitoring Dashboards

- **Application Monitoring**: https://sentry.io/organizations/dependablecalls/
- **Database Monitoring**: https://app.supabase.com/project/[project-id]/database
- **CDN Analytics**: https://dash.cloudflare.com/
- **Uptime Monitoring**: https://status.dependablecalls.com/

### Post-Incident Procedures

1. **Document the incident** in incident log
2. **Conduct root cause analysis** within 24 hours
3. **Update runbooks** with new learnings
4. **Schedule post-mortem** if customer-facing
5. **Implement preventive measures**

## Appendix: Useful Commands

### Database Management
```bash
# Connect to production database
supabase db remote connect

# Run SQL file
psql $DATABASE_URL < script.sql

# Export data
pg_dump $DATABASE_URL -t blog_posts > blog_posts_backup.sql
```

### Netlify CLI
```bash
# View deployment logs
netlify logs:deploy

# Check function logs
netlify functions:log blog-api

# List environment variables
netlify env:list --context production
```

### Monitoring Commands
```bash
# Check SSL certificate
openssl s_client -connect dependablecalls.com:443 -servername dependablecalls.com

# DNS propagation
dig dependablecalls.com

# Performance test
ab -n 1000 -c 10 https://dependablecalls.com/blog/
```

This deployment guide should be reviewed and updated after each major deployment to incorporate new learnings and maintain accuracy.