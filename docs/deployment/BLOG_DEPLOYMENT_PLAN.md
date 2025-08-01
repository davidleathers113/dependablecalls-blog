# Blog CMS Deployment Plan (Revised): Production-Ready Implementation

## 🎯 **Executive Summary**

This revised deployment plan addresses critical security, automation, and infrastructure concerns identified in the initial plan. It leverages existing CI/CD pipelines, follows Supabase/Netlify best practices, and provides realistic timelines for production deployment.

## 🔒 **Security-First Principles**

### **Environment Variable Security**
```bash
# ✅ CORRECT: Client-side variables (exposed to browser)
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY  # Safe for client

# ✅ CORRECT: Server-side only (NEVER expose to client)
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_KEY  # Netlify build-time only
```

### **Storage Security**
```sql
-- Block SVG uploads (XSS risk) or sanitize them
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'blog-images',
  'blog-images', 
  true,
  52428800,
  -- SVG removed for security
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

-- Complete CRUD policies for authors
CREATE POLICY "Authors can manage their own images"
ON storage.objects FOR ALL
USING (
  bucket_id = 'blog-images' AND
  EXISTS (
    SELECT 1 FROM blog_authors ba 
    WHERE ba.id = (storage.foldername(name)::jsonb->>'author_id')::uuid
    AND ba.user_id = auth.uid()
  )
);
```

---

## 🚀 **Phase 1: Infrastructure & CI/CD Setup (4 hours)**

### **Agent 1: GitHub Actions Integration**

#### **Objective**: Extend existing CI/CD pipelines for blog deployment

#### **Tasks**:

1. **Create Blog Migration Job**
   ```yaml
   # .github/workflows/deploy-blog-infrastructure.yml
   name: Deploy Blog Infrastructure
   
   on:
     workflow_dispatch:
     push:
       paths:
         - 'supabase/migrations/01[8-9]_*.sql'
         - 'supabase/migrations/02[0-3]_*.sql'
   
   jobs:
     backup-database:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         
         - name: Backup existing database
           run: |
             ./scripts/backup/supabase-backup.sh
           env:
             SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}
             
         - name: Upload backup artifact
           uses: actions/upload-artifact@v3
           with:
             name: db-backup-${{ github.run_id }}
             path: backups/
             retention-days: 30
   
     deploy-migrations:
       needs: backup-database
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         
         - name: Setup Supabase CLI
           uses: supabase/setup-cli@v1
           with:
             version: latest
             
         - name: Deploy migrations in order
           run: |
             # Use migrate deploy for exact order guarantee
             supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_ID }}
             supabase db migrate deploy
           env:
             SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
             
         - name: Verify migration status
           run: |
             supabase db migrations list
             
     deploy-edge-functions:
       needs: deploy-migrations
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         
         - name: Deploy sanitize-html function
           run: |
             supabase functions deploy sanitize-html \
               --no-verify-jwt
           env:
             SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
             
     run-tests:
       needs: [deploy-migrations, deploy-edge-functions]
       uses: ./.github/workflows/test-suite.yml
       secrets: inherit
   ```

2. **Update Production Deployment Workflow**
   ```yaml
   # Modify .github/workflows/deploy-production.yml
   jobs:
     blog-pre-checks:
       runs-on: ubuntu-latest
       outputs:
         blog-ready: ${{ steps.check.outputs.ready }}
       steps:
         - name: Verify blog infrastructure
           id: check
           run: |
             # Check if blog tables exist
             TABLES=$(supabase db query "SELECT COUNT(*) FROM information_schema.tables WHERE table_name LIKE 'blog_%'")
             if [ "$TABLES" -gt 0 ]; then
               echo "ready=true" >> $GITHUB_OUTPUT
             else
               echo "ready=false" >> $GITHUB_OUTPUT
             fi
   
     deploy:
       needs: blog-pre-checks
       if: needs.blog-pre-checks.outputs.blog-ready == 'true'
       # ... existing deployment steps
   ```

3. **Container-Based Local Testing**
   ```yaml
   # docker-compose.yml addition
   services:
     supabase-test:
       image: supabase/postgres:15
       environment:
         POSTGRES_DB: test
         POSTGRES_USER: postgres
         POSTGRES_PASSWORD: postgres
       volumes:
         - ./supabase/migrations:/docker-entrypoint-initdb.d
       healthcheck:
         test: pg_isready -U postgres
         interval: 10s
         timeout: 5s
         retries: 5
   ```

---

### **Agent 2: Supabase Project Configuration**

#### **Objective**: Properly configure Supabase with security and performance optimizations

#### **Tasks**:

1. **Fix Extension Names and Alternatives**
   ```sql
   -- migration: 024_blog_extensions_fix.sql
   -- Use correct extension names for Supabase Cloud
   CREATE EXTENSION IF NOT EXISTS "pgvector" SCHEMA extensions;
   CREATE EXTENSION IF NOT EXISTS "pg_trgm" SCHEMA extensions;
   
   -- Replace moddatetime with custom trigger (not available on Supabase)
   CREATE OR REPLACE FUNCTION update_updated_at_column()
   RETURNS TRIGGER AS $$
   BEGIN
     NEW.updated_at = NOW();
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;
   
   -- Apply to all blog tables
   DO $$ 
   DECLARE
     t text;
   BEGIN
     FOR t IN 
       SELECT table_name FROM information_schema.tables 
       WHERE table_schema = 'public' AND table_name LIKE 'blog_%'
       AND EXISTS (
         SELECT 1 FROM information_schema.columns 
         WHERE table_name = t AND column_name = 'updated_at'
       )
     LOOP
       EXECUTE format('
         CREATE TRIGGER update_%I_updated_at 
         BEFORE UPDATE ON %I 
         FOR EACH ROW 
         EXECUTE FUNCTION update_updated_at_column()', t, t);
     END LOOP;
   END $$;
   ```

2. **Content Sanitization Database Integration**
   ```sql
   -- migration: 025_blog_content_sanitization_trigger.sql
   -- Connect content field to sanitization function
   CREATE OR REPLACE FUNCTION sanitize_blog_content()
   RETURNS TRIGGER AS $$
   DECLARE
     sanitized_content TEXT;
   BEGIN
     -- Call edge function for sanitization
     SELECT content INTO sanitized_content
     FROM net.http_post(
       url := current_setting('app.supabase_functions_url') || '/sanitize-html',
       headers := jsonb_build_object(
         'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
         'Content-Type', 'application/json'
       ),
       body := jsonb_build_object('html', NEW.content)::text
     ) AS t(content text);
     
     NEW.content_sanitized = sanitized_content;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   
   CREATE TRIGGER sanitize_blog_post_content
     BEFORE INSERT OR UPDATE OF content ON blog_posts
     FOR EACH ROW
     EXECUTE FUNCTION sanitize_blog_content();
   ```

3. **Audit and Retention Policies**
   ```sql
   -- migration: 026_blog_audit_retention.sql
   -- Add audit logging following existing patterns
   CREATE TABLE blog_audit_log (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     table_name TEXT NOT NULL,
     record_id UUID NOT NULL,
     action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
     user_id UUID REFERENCES auth.users(id),
     changed_data JSONB,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   
   -- Create indexes for efficient querying
   CREATE INDEX idx_blog_audit_table_record ON blog_audit_log(table_name, record_id);
   CREATE INDEX idx_blog_audit_created ON blog_audit_log(created_at);
   
   -- Audit trigger function
   CREATE OR REPLACE FUNCTION blog_audit_trigger()
   RETURNS TRIGGER AS $$
   BEGIN
     INSERT INTO blog_audit_log (table_name, record_id, action, user_id, changed_data)
     VALUES (
       TG_TABLE_NAME,
       COALESCE(NEW.id, OLD.id),
       TG_OP,
       auth.uid(),
       CASE
         WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
         WHEN TG_OP = 'UPDATE' THEN jsonb_build_object(
           'old', to_jsonb(OLD),
           'new', to_jsonb(NEW)
         )
         ELSE to_jsonb(NEW)
       END
     );
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   
   -- Apply to critical tables
   CREATE TRIGGER audit_blog_posts
     AFTER INSERT OR UPDATE OR DELETE ON blog_posts
     FOR EACH ROW EXECUTE FUNCTION blog_audit_trigger();
   
   -- GDPR retention policy (90 days for analytics, configurable)
   CREATE OR REPLACE FUNCTION cleanup_old_blog_analytics()
   RETURNS void AS $$
   BEGIN
     DELETE FROM blog_post_views
     WHERE created_at < NOW() - INTERVAL '90 days';
     
     DELETE FROM blog_analytics_events  
     WHERE created_at < NOW() - INTERVAL '90 days';
     
     -- Archive audit logs older than 1 year
     INSERT INTO blog_audit_archive
     SELECT * FROM blog_audit_log
     WHERE created_at < NOW() - INTERVAL '1 year';
     
     DELETE FROM blog_audit_log
     WHERE created_at < NOW() - INTERVAL '1 year';
   END;
   $$ LANGUAGE plpgsql;
   ```

---

### **Agent 3: Secure Environment & Monitoring Setup**

#### **Objective**: Configure production environment with proper security and monitoring

#### **Tasks**:

1. **Netlify Environment Configuration**
   ```bash
   # Use Netlify CLI to set build-time secrets securely
   # These are NOT exposed to the browser
   netlify env:set SUPABASE_SERVICE_ROLE_KEY "$SERVICE_KEY" --context production --secret
   netlify env:set SENTRY_AUTH_TOKEN "$SENTRY_TOKEN" --context production --secret
   
   # Client-safe variables
   netlify env:set VITE_SUPABASE_URL "https://YOUR_PROJECT.supabase.co" --context production
   netlify env:set VITE_SUPABASE_ANON_KEY "$ANON_KEY" --context production
   netlify env:set VITE_SENTRY_DSN "$SENTRY_DSN" --context production
   ```

2. **Health Check Implementation**
   ```typescript
   // netlify/functions/health.ts
   import { Handler } from '@netlify/functions';
   import { createClient } from '@supabase/supabase-js';
   import { healthCheck } from '../../src/lib/health-check';
   
   export const handler: Handler = async (event, context) => {
     // Reuse existing health check logic
     const checks = await healthCheck.runAllChecks();
     
     // Add blog-specific checks
     const blogChecks = {
       ...checks,
       blog_posts: false,
       blog_storage: false,
       blog_search: false
     };
     
     try {
       // Only use service role key server-side
       const supabase = createClient(
         process.env.SUPABASE_URL!,
         process.env.SUPABASE_SERVICE_ROLE_KEY!
       );
       
       // Check blog posts
       const { count, error } = await supabase
         .from('blog_posts')
         .select('*', { count: 'exact', head: true })
         .eq('status', 'published');
       
       blogChecks.blog_posts = !error && count! > 0;
       
       // Check storage
       const { data: files } = await supabase.storage
         .from('blog-images')
         .list('posts', { limit: 1 });
       
       blogChecks.blog_storage = !!files;
       
       // Check search
       const { data: searchResults } = await supabase
         .from('blog_posts')
         .select('title')
         .textSearch('search_vector', 'test', { type: 'plain' })
         .limit(1);
       
       blogChecks.blog_search = !!searchResults;
       
       const allHealthy = Object.values(blogChecks).every(v => v);
       
       return {
         statusCode: allHealthy ? 200 : 503,
         body: JSON.stringify({
           status: allHealthy ? 'healthy' : 'degraded',
           checks: blogChecks,
           timestamp: new Date().toISOString()
         })
       };
     } catch (error) {
       return {
         statusCode: 500,
         body: JSON.stringify({
           status: 'error',
           error: error.message
         })
       };
     }
   };
   ```

3. **Complete Edge Function for Image Optimization**
   ```typescript
   // supabase/functions/optimize-image/index.ts
   import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
   import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
   
   const corsHeaders = {
     'Access-Control-Allow-Origin': '*',
     'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   };
   
   serve(async (req) => {
     if (req.method === 'OPTIONS') {
       return new Response('ok', { headers: corsHeaders });
     }
     
     try {
       const { bucket, path } = await req.json();
       
       // Initialize Supabase client
       const supabase = createClient(
         Deno.env.get('SUPABASE_URL') ?? '',
         Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
       );
       
       // Download original image
       const { data: imageData, error: downloadError } = await supabase.storage
         .from(bucket)
         .download(path);
       
       if (downloadError) throw downloadError;
       
       // Convert to buffer
       const buffer = await imageData.arrayBuffer();
       
       // Generate optimized versions
       const sizes = [
         { width: 320, suffix: '_320w' },
         { width: 640, suffix: '_640w' },
         { width: 1024, suffix: '_1024w' },
         { width: 1920, suffix: '_1920w' }
       ];
       
       // For MVP, we'll just copy the original to different paths
       // In production, integrate with sharp or imagemagick
       for (const size of sizes) {
         const optimizedPath = path.replace(/\.[^.]+$/, `${size.suffix}$&`);
         
         await supabase.storage
           .from(bucket)
           .upload(optimizedPath, buffer, {
             contentType: 'image/jpeg',
             upsert: true
           });
       }
       
       // Generate WebP version
       const webpPath = path.replace(/\.[^.]+$/, '.webp');
       await supabase.storage
         .from(bucket)
         .upload(webpPath, buffer, {
           contentType: 'image/webp',
           upsert: true
         });
       
       return new Response(
         JSON.stringify({ 
           success: true, 
           optimized: sizes.length + 1 
         }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     } catch (error) {
       return new Response(
         JSON.stringify({ error: error.message }),
         { 
           status: 500,
           headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
         }
       );
     }
   });
   ```

---

## 📝 **Phase 2: Staging Deployment & Content (3 hours)**

### **Agent 4: Staging Environment Setup**

#### **Objective**: Create staging environment for safe testing

#### **Tasks**:

1. **Create Staging Branch Workflow**
   ```yaml
   # .github/workflows/deploy-staging-blog.yml
   name: Deploy Blog to Staging
   
   on:
     push:
       branches: [staging, blog-*]
   
   jobs:
     deploy-staging:
       runs-on: ubuntu-latest
       environment: staging
       steps:
         - uses: actions/checkout@v4
         
         - name: Create staging project
           run: |
             # Fork production database to staging
             supabase projects create staging-blog-${{ github.run_id }} \
               --db-pass ${{ secrets.STAGING_DB_PASS }} \
               --region us-east-1
             
             # Link and push schema
             supabase link --project-ref $STAGING_REF
             supabase db reset --linked
             
         - name: Deploy to Netlify preview
           run: |
             netlify deploy --dir=dist --alias=blog-staging-${{ github.run_id }}
           env:
             NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
             NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
   ```

2. **Rate Limiting with Existing Middleware**
   ```typescript
   // netlify/functions/blog-api/index.ts
   import { Handler } from '@netlify/functions';
   import { rateLimitMiddleware } from '../_shared/rate-limit-middleware';
   import { createClient } from '@supabase/supabase-js';
   
   const handler: Handler = async (event, context) => {
     // Apply rate limiting
     const rateLimitResult = await rateLimitMiddleware(event, {
       windowMs: 60000, // 1 minute
       max: 30, // 30 requests per minute for anonymous
       keyGenerator: (event) => event.headers['x-forwarded-for'] || 'anonymous'
     });
     
     if (rateLimitResult) {
       return rateLimitResult; // Rate limit exceeded
     }
     
     // Handle blog API requests
     const path = event.path.replace('/.netlify/functions/blog-api', '');
     
     // Initialize Supabase client with anon key for RLS
     const supabase = createClient(
       process.env.SUPABASE_URL!,
       process.env.SUPABASE_ANON_KEY!
     );
     
     // Route handling...
   };
   
   export { handler };
   ```

---

### **Agent 5: Secure Content Population**

#### **Objective**: Populate staging with test content using secure methods

#### **Tasks**:

1. **Author Account Creation Script**
   ```typescript
   // scripts/create-blog-authors.ts
   import { createClient } from '@supabase/supabase-js';
   import * as dotenv from 'dotenv';
   
   dotenv.config({ path: '.env.staging' });
   
   const supabase = createClient(
     process.env.SUPABASE_URL!,
     process.env.SUPABASE_SERVICE_ROLE_KEY!, // Only in scripts, never client
     {
       auth: {
         autoRefreshToken: false,
         persistSession: false
       }
     }
   );
   
   async function createAuthors() {
     const authors = [
       {
         email: 'john.smith@dependablecalls.com',
         password: generateSecurePassword(),
         user_metadata: {
           full_name: 'John Smith',
           role: 'author'
         },
         profile: {
           slug: 'john-smith',
           name: 'John Smith',
           bio: 'Senior Content Strategist...',
           avatar_url: null // Will be set after upload
         }
       }
       // ... more authors
     ];
     
     for (const author of authors) {
       // Create auth user
       const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
         email: author.email,
         password: author.password,
         email_confirm: true,
         user_metadata: author.user_metadata
       });
       
       if (authError) throw authError;
       
       // Create author profile
       const { data: profile, error: profileError } = await supabase
         .from('blog_authors')
         .insert({
           ...author.profile,
           user_id: authUser.user.id
         })
         .select()
         .single();
       
       if (profileError) throw profileError;
       
       console.log(`Created author: ${profile.name} (${authUser.user.id})`);
       
       // Store credentials securely
       await storeCredentials(author.email, author.password);
     }
   }
   
   function generateSecurePassword(): string {
     // Use crypto-secure random generation
     const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
     let password = '';
     const array = new Uint8Array(20);
     crypto.getRandomValues(array);
     for (let i = 0; i < 20; i++) {
       password += chars[array[i] % chars.length];
     }
     return password;
   }
   
   async function storeCredentials(email: string, password: string) {
     // Store in secure secret manager, not in code
     console.log(`Credentials for ${email} stored in secret manager`);
   }
   ```

2. **Safe Content Seeding**
   ```typescript
   // scripts/seed-blog-content.ts
   import { createClient } from '@supabase/supabase-js';
   import { readFileSync } from 'fs';
   import { join } from 'path';
   
   const supabase = createClient(
     process.env.SUPABASE_URL!,
     process.env.SUPABASE_SERVICE_ROLE_KEY!
   );
   
   async function seedContent() {
     // Read sanitized content from files
     const posts = JSON.parse(
       readFileSync(join(__dirname, '../data/blog-posts.json'), 'utf-8')
     );
     
     for (const post of posts) {
       // Content will be automatically sanitized by trigger
       const { data, error } = await supabase
         .from('blog_posts')
         .insert({
           ...post,
           published_at: new Date().toISOString(),
           status: 'published'
         })
         .select()
         .single();
       
       if (error) {
         console.error(`Failed to insert post: ${post.title}`, error);
         continue;
       }
       
       console.log(`Created post: ${data.title}`);
       
       // Upload images with signed URLs
       if (post.featured_image) {
         const imagePath = `posts/${data.id}/featured.jpg`;
         const imageData = readFileSync(
           join(__dirname, '../data/images', post.featured_image)
         );
         
         const { error: uploadError } = await supabase.storage
           .from('blog-images')
           .upload(imagePath, imageData, {
             contentType: 'image/jpeg',
             upsert: true
           });
         
         if (uploadError) {
           console.error(`Failed to upload image for: ${data.title}`, uploadError);
         }
         
         // Update post with signed URL
         const { data: signedUrl } = await supabase.storage
           .from('blog-images')
           .createSignedUrl(imagePath, 31536000); // 1 year
         
         await supabase
           .from('blog_posts')
           .update({ featured_image_url: signedUrl.signedUrl })
           .eq('id', data.id);
       }
     }
   }
   ```

---

### **Agent 6: Comprehensive Testing Suite**

#### **Objective**: Run full test suite on staging before production

#### **Tasks**:

1. **Integration Test Suite**
   ```typescript
   // tests/blog-integration.test.ts
   import { test, expect } from '@playwright/test';
   import { createClient } from '@supabase/supabase-js';
   
   test.describe('Blog Integration Tests', () => {
     let supabase;
     
     test.beforeAll(async () => {
       supabase = createClient(
         process.env.VITE_SUPABASE_URL!,
         process.env.VITE_SUPABASE_ANON_KEY!
       );
     });
     
     test('should load published posts with proper RLS', async ({ page }) => {
       await page.goto('/blog');
       
       // Check that only published posts are visible
       const posts = await page.locator('[data-testid="blog-post-item"]').count();
       
       // Verify against database
       const { count } = await supabase
         .from('blog_posts')
         .select('*', { count: 'exact', head: true })
         .eq('status', 'published');
       
       expect(posts).toBe(count);
     });
     
     test('should enforce rate limiting', async ({ page }) => {
       // Rapid requests to test rate limiting
       const requests = [];
       for (let i = 0; i < 35; i++) {
         requests.push(page.goto('/blog'));
       }
       
       const results = await Promise.allSettled(requests);
       const rateLimited = results.filter(r => 
         r.status === 'fulfilled' && r.value.status() === 429
       );
       
       expect(rateLimited.length).toBeGreaterThan(0);
     });
     
     test('should have secure headers', async ({ page }) => {
       const response = await page.goto('/blog');
       const headers = response.headers();
       
       expect(headers['x-frame-options']).toBe('DENY');
       expect(headers['x-content-type-options']).toBe('nosniff');
       expect(headers['strict-transport-security']).toContain('max-age=31536000');
       expect(headers['content-security-policy']).toBeDefined();
     });
   });
   ```

2. **Lighthouse CI Configuration**
   ```javascript
   // lighthouserc.js
   module.exports = {
     ci: {
       collect: {
         url: [
           'http://localhost:5173/blog',
           'http://localhost:5173/blog/maximizing-roi-pay-per-call-campaigns-2024',
           'http://localhost:5173/blog/category/pay-per-call-marketing',
           'http://localhost:5173/blog/author/john-smith'
         ],
         numberOfRuns: 3,
         settings: {
           preset: 'desktop',
           throttling: {
             cpuSlowdownMultiplier: 1
           }
         }
       },
       assert: {
         preset: 'lighthouse:recommended',
         assertions: {
           'categories:performance': ['error', { minScore: 0.85 }],
           'categories:accessibility': ['error', { minScore: 0.95 }],
           'categories:best-practices': ['error', { minScore: 0.95 }],
           'categories:seo': ['error', { minScore: 0.95 }],
           'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
           'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
           'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
           'total-blocking-time': ['error', { maxNumericValue: 300 }]
         }
       },
       upload: {
         target: 'temporary-public-storage'
       }
     }
   };
   ```

---

## 🌐 **Phase 3: Production Deployment (3 hours)**

### **Agent 7: Production Promotion**

#### **Objective**: Safely promote staging to production with rollback capability

#### **Tasks**:

1. **Pre-Production Checklist**
   ```bash
   #!/bin/bash
   # scripts/pre-production-checklist.sh
   
   echo "🔍 Running pre-production checks..."
   
   # Check all tests pass
   npm run test:unit && npm run test:integration && npm run test:e2e
   if [ $? -ne 0 ]; then
     echo "❌ Tests failed. Aborting deployment."
     exit 1
   fi
   
   # Check build succeeds
   npm run build
   if [ $? -ne 0 ]; then
     echo "❌ Build failed. Aborting deployment."
     exit 1
   fi
   
   # Check Lighthouse scores
   lhci autorun
   if [ $? -ne 0 ]; then
     echo "❌ Lighthouse checks failed. Aborting deployment."
     exit 1
   fi
   
   # Check security headers
   curl -I https://staging.dependablecalls.com/blog | grep -E "X-Frame-Options|Strict-Transport-Security"
   if [ $? -ne 0 ]; then
     echo "❌ Security headers missing. Aborting deployment."
     exit 1
   fi
   
   echo "✅ All pre-production checks passed!"
   ```

2. **Blue-Green Deployment**
   ```yaml
   # .github/workflows/deploy-production-blue-green.yml
   name: Blue-Green Production Deployment
   
   on:
     workflow_dispatch:
       inputs:
         confirm:
           description: 'Type "DEPLOY" to confirm production deployment'
           required: true
   
   jobs:
     validate:
       if: github.event.inputs.confirm == 'DEPLOY'
       runs-on: ubuntu-latest
       steps:
         - name: Validate staging
           run: |
             # Run health checks on staging
             curl -f https://staging.dependablecalls.com/.netlify/functions/health
             
     deploy-green:
       needs: validate
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         
         - name: Deploy to green environment
           run: |
             # Deploy to production-green first
             netlify deploy --prod --alias=production-green
             
         - name: Smoke test green
           run: |
             npm run test:smoke -- --url=https://production-green.dependablecalls.com
             
     switch-traffic:
       needs: deploy-green
       runs-on: ubuntu-latest
       environment: production
       steps:
         - name: Switch traffic to green
           run: |
             netlify api updateSite --data '{
               "production_branch": "main",
               "branch_deploy_custom_domain": "dependablecalls.com"
             }'
             
         - name: Monitor metrics
           run: |
             # Monitor for 15 minutes
             npm run monitor:production -- --duration=900
             
     rollback:
       needs: switch-traffic
       if: failure()
       runs-on: ubuntu-latest
       steps:
         - name: Rollback to blue
           run: |
             netlify rollback --alias=production-blue
             echo "⚠️ Deployment rolled back!"
   ```

---

### **Agent 8: Production Monitoring & Alerting**

#### **Objective**: Establish comprehensive monitoring and alerting

#### **Tasks**:

1. **Sentry Configuration**
   ```typescript
   // src/lib/sentry-config.ts
   import * as Sentry from '@sentry/react';
   import { BrowserTracing } from '@sentry/tracing';
   
   export function initSentry() {
     Sentry.init({
       dsn: import.meta.env.VITE_SENTRY_DSN,
       environment: import.meta.env.MODE,
       integrations: [
         new BrowserTracing({
           routingInstrumentation: Sentry.reactRouterV6Instrumentation(
             React.useEffect,
             useLocation,
             useNavigationType,
             createRoutesFromChildren,
             matchRoutes
           ),
           tracingOrigins: ['localhost', 'dependablecalls.com', /^\//],
         }),
         new Sentry.Replay({
           maskAllText: false,
           blockAllMedia: false,
         }),
       ],
       tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
       replaysSessionSampleRate: 0.1,
       replaysOnErrorSampleRate: 1.0,
       beforeSend(event, hint) {
         // Filter out non-actionable errors
         if (event.exception) {
           const error = hint.originalException;
           // Filter out network errors from ad blockers
           if (error?.message?.includes('Failed to fetch')) {
             return null;
           }
         }
         return event;
       },
     });
   }
   ```

2. **Uptime Monitoring**
   ```typescript
   // netlify/functions/uptime-webhook.ts
   import { Handler } from '@netlify/functions';
   import { createClient } from '@supabase/supabase-js';
   
   export const handler: Handler = async (event, context) => {
     if (event.httpMethod !== 'POST') {
       return { statusCode: 405, body: 'Method Not Allowed' };
     }
     
     const { monitor, status, error_message } = JSON.parse(event.body);
     
     // Log to Supabase
     const supabase = createClient(
       process.env.SUPABASE_URL!,
       process.env.SUPABASE_SERVICE_ROLE_KEY!
     );
     
     await supabase.from('monitoring_events').insert({
       monitor_name: monitor,
       status,
       error_message,
       created_at: new Date().toISOString()
     });
     
     // Alert on failures
     if (status === 'down') {
       await sendAlert({
         channel: 'slack',
         message: `🚨 Blog is DOWN: ${error_message}`,
         severity: 'critical'
       });
       
       await sendAlert({
         channel: 'pagerduty',
         message: `Blog monitoring failure: ${monitor}`,
         severity: 'critical'
       });
     }
     
     return {
       statusCode: 200,
       body: JSON.stringify({ received: true })
     };
   };
   ```

3. **Analytics and Performance Tracking**
   ```typescript
   // src/lib/blog-analytics-production.ts
   import { getCLS, getFID, getLCP } from 'web-vitals';
   
   export function initBlogAnalytics() {
     // Core Web Vitals
     getCLS(onPerfEntry);
     getFID(onPerfEntry);
     getLCP(onPerfEntry);
     
     // Custom blog metrics
     trackBlogMetrics();
   }
   
   function onPerfEntry(metric: any) {
     // Send to analytics
     gtag('event', metric.name, {
       value: Math.round(metric.value),
       metric_id: metric.id,
       metric_value: metric.value,
       metric_delta: metric.delta,
     });
     
     // Alert on poor performance
     const thresholds = {
       CLS: 0.1,
       FID: 100,
       LCP: 2500
     };
     
     if (metric.value > thresholds[metric.name]) {
       console.warn(`Poor ${metric.name}: ${metric.value}`);
       Sentry.captureMessage(`Poor Web Vital: ${metric.name}`, 'warning');
     }
   }
   
   function trackBlogMetrics() {
     // Track custom blog engagement metrics
     const observer = new IntersectionObserver((entries) => {
       entries.forEach(entry => {
         if (entry.isIntersecting) {
           const postId = entry.target.getAttribute('data-post-id');
           gtag('event', 'blog_post_view', {
             post_id: postId,
             view_percentage: Math.round(entry.intersectionRatio * 100)
           });
         }
       });
     }, { threshold: [0.25, 0.5, 0.75, 1.0] });
     
     // Observe all blog posts
     document.querySelectorAll('[data-post-id]').forEach(el => {
       observer.observe(el);
     });
   }
   ```

---

## ⏱️ **Realistic Timeline**

### **Phase Breakdown**
- **Phase 1 (Infrastructure & CI/CD)**: 4 hours
  - GitHub Actions setup: 1 hour
  - Supabase configuration: 2 hours  
  - Security & monitoring: 1 hour

- **Phase 2 (Staging & Content)**: 3 hours
  - Staging environment: 1 hour
  - Content population: 1 hour
  - Testing suite: 1 hour

- **Phase 3 (Production)**: 3 hours
  - Pre-production checks: 1 hour
  - Blue-green deployment: 1 hour
  - Monitoring setup: 1 hour

### **Total Time**: 10 hours (1 full working day)
### **With Buffer**: 12-14 hours (1.5 days)

---

## ✅ **Success Criteria Checklist**

### **Security**
- [ ] Service role keys NEVER exposed to client
- [ ] SVG uploads blocked or sanitized
- [ ] RLS policies tested with multiple user types
- [ ] Rate limiting active on all endpoints
- [ ] Security headers scoring A+ on securityheaders.com

### **Infrastructure**
- [ ] All migrations deployed via `supabase migrate deploy`
- [ ] Correct extensions installed (pgvector, pg_trgm)
- [ ] Updated_at triggers working without moddatetime
- [ ] Edge functions deployed and tested
- [ ] Storage policies allow full CRUD operations

### **CI/CD**
- [ ] GitHub Actions handling all deployments
- [ ] Staging environment auto-created on PRs
- [ ] All tests passing (unit, integration, e2e)
- [ ] Lighthouse scores meeting thresholds
- [ ] Rollback tested and documented

### **Monitoring**
- [ ] Sentry capturing and filtering errors properly
- [ ] Uptime monitoring with multi-channel alerts
- [ ] Core Web Vitals tracked and within budget
- [ ] Custom blog analytics implemented
- [ ] Health checks returning accurate status

### **Content**
- [ ] Authors can authenticate and manage content
- [ ] Images optimized and served via CDN
- [ ] Search functionality fast and accurate
- [ ] Content properly sanitized
- [ ] Audit logs capturing all changes

---

## 📋 **Post-Deployment Checklist**

1. **Verify Production**
   ```bash
   # Run production verification script
   ./scripts/verify-production.sh
   ```

2. **Update Documentation**
   - Update README with blog feature documentation
   - Document content management workflow
   - Create runbooks for common operations

3. **Schedule Maintenance**
   - Set up weekly backup automation
   - Configure monthly analytics archival
   - Plan quarterly security audits

4. **Train Content Team**
   - Provide author credentials securely
   - Document content guidelines
   - Set up editorial calendar

This revised plan addresses all identified security concerns, leverages existing CI/CD infrastructure, provides realistic timelines, and ensures a production-ready deployment with proper monitoring and rollback capabilities.