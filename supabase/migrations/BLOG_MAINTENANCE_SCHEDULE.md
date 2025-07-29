# Blog CMS Database Maintenance Schedule

## Overview

This document outlines the recommended maintenance schedule for the blog CMS database tables and indexes to ensure optimal performance.

## Maintenance Functions

### 1. `analyze_blog_tables()`

- **Purpose**: Updates table statistics for query optimization
- **Schedule**: Daily at 2:00 AM (low traffic time)
- **Impact**: Minimal - only updates statistics
- **Duration**: < 1 minute

### 2. `vacuum_blog_tables()`

- **Purpose**: Reclaims storage space and updates statistics
- **Schedule**: Weekly on Sunday at 3:00 AM
- **Impact**: Low - may cause slight performance impact
- **Duration**: 5-15 minutes depending on data size

### 3. `reindex_blog_search()`

- **Purpose**: Rebuilds search indexes for optimal performance
- **Schedule**: Weekly on Sunday at 4:00 AM (after vacuum)
- **Impact**: Medium - search may be slower during reindex
- **Duration**: 10-30 minutes depending on content volume

## Supabase Cron Job Setup

Add these cron jobs using Supabase's pg_cron extension:

```sql
-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily analysis
SELECT cron.schedule(
  'analyze-blog-tables',
  '0 2 * * *', -- Daily at 2:00 AM
  'SELECT analyze_blog_tables();'
);

-- Schedule weekly vacuum
SELECT cron.schedule(
  'vacuum-blog-tables',
  '0 3 * * 0', -- Sunday at 3:00 AM
  'SELECT vacuum_blog_tables();'
);

-- Schedule weekly reindex
SELECT cron.schedule(
  'reindex-blog-search',
  '0 4 * * 0', -- Sunday at 4:00 AM
  'SELECT reindex_blog_search();'
);

-- View scheduled jobs
SELECT * FROM cron.job;

-- Remove a job if needed
-- SELECT cron.unschedule('job-name');
```

## Manual Maintenance

### When to Run Manual Maintenance

1. **After Bulk Imports**

   ```sql
   SELECT analyze_blog_tables();
   SELECT reindex_blog_search();
   ```

2. **After Major Content Updates**

   ```sql
   SELECT vacuum_blog_tables();
   SELECT analyze_blog_tables();
   ```

3. **If Search Performance Degrades**
   ```sql
   SELECT reindex_blog_search();
   ```

## Monitoring Performance

### Check Index Usage

```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND tablename LIKE 'blog_%'
ORDER BY idx_scan DESC;
```

### Check Table Statistics

```sql
SELECT
  schemaname,
  tablename,
  n_live_tup,
  n_dead_tup,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
AND tablename LIKE 'blog_%';
```

### Check Search Performance

```sql
-- Test full-text search
EXPLAIN ANALYZE
SELECT id, title, ts_rank(search_vector, query) as rank
FROM blog_posts, plainto_tsquery('english', 'your search terms') query
WHERE search_vector @@ query
ORDER BY rank DESC
LIMIT 10;

-- Test semantic search
EXPLAIN ANALYZE
SELECT * FROM search_similar_posts(
  '[your_embedding_vector]'::vector(1536),
  5,
  0.7
);
```

## IVFFLAT Index Tuning

The `lists` parameter in the IVFFLAT index affects performance:

- **Current Setting**: `lists = 100`
- **Recommended Values**:
  - < 1,000 posts: `lists = 50`
  - 1,000 - 10,000 posts: `lists = 100`
  - 10,000 - 100,000 posts: `lists = 300`
  - > 100,000 posts: `lists = 1000`

To update:

```sql
DROP INDEX idx_blog_posts_embedding;
CREATE INDEX idx_blog_posts_embedding
  ON blog_posts
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = [new_value]);
```

## Alerts and Monitoring

Set up alerts for:

1. **Dead Tuple Ratio** > 20%

   ```sql
   SELECT tablename,
          n_dead_tup::float / NULLIF(n_live_tup + n_dead_tup, 0) * 100 as dead_ratio
   FROM pg_stat_user_tables
   WHERE tablename LIKE 'blog_%'
   AND n_dead_tup::float / NULLIF(n_live_tup + n_dead_tup, 0) > 0.2;
   ```

2. **Long Running Queries** > 30 seconds

   ```sql
   SELECT pid, now() - pg_stat_activity.query_start AS duration, query
   FROM pg_stat_activity
   WHERE (now() - pg_stat_activity.query_start) > interval '30 seconds'
   AND query LIKE '%blog_%';
   ```

3. **Index Bloat** > 50%
   ```sql
   -- Use pg_stat_user_indexes to monitor index efficiency
   ```

## Backup Considerations

- Run full backups before major maintenance operations
- Ensure point-in-time recovery is enabled
- Test restore procedures quarterly
