# Blog CMS Migration Guide

## Overview

Migration `018_blog_cms_tables.sql` creates the complete blog CMS infrastructure for the DCE website, including:

- 7 core tables (posts, categories, tags, authors, comments, and junction tables)
- Comprehensive RLS policies with proper authentication
- Full-text search with PostgreSQL tsvector
- pgvector support for semantic search (1536-dimensional embeddings)
- Automated triggers for timestamps, search indexing, and audit logging
- Storage bucket configuration with quota enforcement

## Prerequisites

1. **Required Extensions** (automatically installed by migration):
   - `moddatetime` - For automatic timestamp updates
   - `pg_trgm` - For fuzzy text matching and search
   - `vector` - For semantic search with embeddings

2. **Existing Tables Required**:
   - `users` - For author authentication
   - `admins` - For admin access control
   - `audit_logs` - For content change tracking

## Testing Instructions

### 1. Apply Migration

```bash
# Local development
npx supabase migration up

# Or reset and reapply all migrations
npx supabase db reset

# Verify migration status
npx supabase migration list
```

### 2. Load Test Data

```bash
# Load blog seed data
psql "$DATABASE_URL" -f supabase/seed_blog.sql

# Or use Supabase CLI
npx supabase db push --include-seed
```

### 3. Verify Tables Created

```sql
-- Check all blog tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'blog_%'
ORDER BY table_name;

-- Expected output:
-- blog_authors
-- blog_categories
-- blog_comments
-- blog_post_categories
-- blog_post_tags
-- blog_posts
-- blog_tags
```

### 4. Test RLS Policies

```sql
-- Test as anonymous user (should only see published posts)
SET LOCAL role TO 'anon';
SELECT id, title, status FROM blog_posts;

-- Test as authenticated user who is an author
SET LOCAL role TO 'authenticated';
SET LOCAL request.jwt.claims.sub TO 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12';
SELECT id, title, status FROM blog_posts; -- Should see own drafts too

-- Test as admin
SET LOCAL request.jwt.claims.sub TO 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
SELECT id, title, status FROM blog_posts; -- Should see all posts

-- Reset role
RESET role;
```

### 5. Verify Indexes

```sql
-- List all blog-related indexes
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename LIKE 'blog_%'
ORDER BY tablename, indexname;
```

### 6. Test Full-Text Search

```sql
-- Test search functionality
SELECT id, title, ts_rank(search_vector, query) as rank
FROM blog_posts, plainto_tsquery('english', 'pay per call') query
WHERE search_vector @@ query
ORDER BY rank DESC;

-- Test trigram search
SELECT id, title, similarity(title, 'fraud prevention') as sim
FROM blog_posts
WHERE title % 'fraud prevention'
ORDER BY sim DESC;
```

### 7. Test Storage Policies

```sql
-- Check storage bucket exists
SELECT * FROM storage.buckets WHERE id = 'blog-images';

-- Test quota calculation (as an author)
SET LOCAL role TO 'authenticated';
SET LOCAL request.jwt.claims.sub TO 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12';

-- This should work if under quota
INSERT INTO storage.objects (bucket_id, name, owner, metadata, path_tokens, size)
VALUES ('blog-images', 'test.jpg', current_setting('request.jwt.claims.sub')::uuid, '{}', '{test.jpg}', 1000000);
```

### 8. Test Triggers

```sql
-- Test automatic timestamp updates
UPDATE blog_posts
SET title = 'Updated Title'
WHERE slug = 'welcome-to-dependable-calls-blog';

-- Check updated_at changed
SELECT id, title, created_at, updated_at
FROM blog_posts
WHERE slug = 'welcome-to-dependable-calls-blog';

-- Test search vector update
UPDATE blog_posts
SET content = 'New content for search testing'
WHERE slug = 'draft-post-example';

-- Verify search vector updated
SELECT id, title, search_vector
FROM blog_posts
WHERE slug = 'draft-post-example';
```

### 9. Test Helper Functions

```sql
-- Test slug generation
SELECT generate_blog_slug('This is a Test Title!');
-- Expected: 'this-is-a-test-title'

-- Test duplicate slug handling
SELECT generate_blog_slug('Welcome to the Dependable Calls Blog');
-- Expected: 'welcome-to-the-dependable-calls-blog-1' (since original exists)

-- Test blog statistics
SELECT * FROM get_blog_statistics();
-- Should return aggregated stats for all posts

-- Test author-specific statistics
SELECT * FROM get_blog_statistics('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12');
```

## Rollback Instructions

If you need to rollback this migration:

```sql
-- Drop all blog tables (CASCADE removes dependent objects)
DROP TABLE IF EXISTS blog_comments CASCADE;
DROP TABLE IF EXISTS blog_post_tags CASCADE;
DROP TABLE IF EXISTS blog_post_categories CASCADE;
DROP TABLE IF EXISTS blog_tags CASCADE;
DROP TABLE IF EXISTS blog_categories CASCADE;
DROP TABLE IF EXISTS blog_posts CASCADE;
DROP TABLE IF EXISTS blog_authors CASCADE;

-- Remove storage bucket
DELETE FROM storage.buckets WHERE id = 'blog-images';

-- Remove storage policies
DROP POLICY IF EXISTS "Authors can upload images within quota" ON storage.objects;
DROP POLICY IF EXISTS "Authors can manage their own images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view blog images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all blog images" ON storage.objects;

-- Drop functions
DROP FUNCTION IF EXISTS blog_posts_search_trigger();
DROP FUNCTION IF EXISTS calculate_reading_time();
DROP FUNCTION IF EXISTS blog_audit_content_changes();
DROP FUNCTION IF EXISTS generate_blog_slug(TEXT);
DROP FUNCTION IF EXISTS search_similar_posts(vector(1536), INT, FLOAT);
DROP FUNCTION IF EXISTS get_blog_statistics(UUID);
```

## Common Issues & Solutions

### Issue: Migration fails with "extension does not exist"

**Solution**: Ensure your Supabase project has the required extensions enabled in the dashboard:

- Go to Database → Extensions
- Enable: `moddatetime`, `pg_trgm`, `vector`

### Issue: RLS policies blocking access

**Solution**: Check that:

1. User exists in `users` table
2. Author record exists in `blog_authors`
3. For admins, record exists in `admins` table
4. JWT claims are properly set

### Issue: Storage upload fails

**Solution**: Verify:

1. Storage bucket exists
2. Author has quota available
3. File size is within limits
4. Proper authentication headers sent

## Infrastructure Improvements (Migration 019)

The `019_blog_infrastructure_fixes.sql` migration adds:

### 1. Enhanced Word Count Function

- Properly handles Markdown formatting
- Counts code blocks separately (slower reading speed)
- Uses `regexp_split_to_array` for accurate word splitting
- Filters empty strings from word count

### 2. Optimized IVFFLAT Index

- Tuned with `lists = 100` for medium datasets
- Added composite index for filtered similarity searches
- Guidelines for scaling the `lists` parameter

### 3. Maintenance Functions

- `analyze_blog_tables()` - Updates statistics (run daily)
- `vacuum_blog_tables()` - Reclaims space (run weekly)
- `reindex_blog_search()` - Rebuilds search indexes (run weekly)

### 4. Complete Rollback Support

- `rollback_blog_cms_complete.sql` - Full system removal
- `rollback_blog_infrastructure()` - Rollback improvements only

See `BLOG_MAINTENANCE_SCHEDULE.md` for detailed maintenance guidelines.

## Next Steps

After successful migration:

1. Generate TypeScript types:

   ```bash
   npm run supabase:types
   ```

2. Create blog service layer:
   - See `src/services/blog.service.ts` (Phase 2)

3. Implement frontend components:
   - See implementation guide for component structure

4. Set up maintenance cron jobs:
   ```sql
   -- Enable pg_cron and schedule maintenance
   CREATE EXTENSION IF NOT EXISTS pg_cron;
   SELECT cron.schedule('analyze-blog-tables', '0 2 * * *', 'SELECT analyze_blog_tables();');
   SELECT cron.schedule('vacuum-blog-tables', '0 3 * * 0', 'SELECT vacuum_blog_tables();');
   SELECT cron.schedule('reindex-blog-search', '0 4 * * 0', 'SELECT reindex_blog_search();');
   ```

## Performance Considerations

- The migration creates extensive indexes for optimal query performance
- Full-text search is pre-computed via triggers
- IVFFLAT index tuned for semantic search performance
- Regular maintenance via automated functions
- Monitor `pg_stat_user_indexes` for index usage
- Consider adding materialized views for heavy queries

## Security Notes

- All tables have RLS enabled by default
- Content sanitization should happen at application level
- Storage quotas prevent abuse
- Audit logging tracks all content changes (uses existing `audit_logs` table)
- Consider implementing rate limiting at API level
