# Blog Storage Quota System

## Overview

The blog storage quota system prevents race conditions and improves performance when enforcing storage limits for blog authors. This system uses PostgreSQL advisory locks to ensure concurrent uploads cannot exceed quota limits.

## Key Features

### 1. Performance Optimization
- **Indexed Queries**: Dedicated indexes on `storage.objects(bucket_id, owner)` for fast quota calculations
- **Cached Calculations**: Functions use `STABLE` qualifier for query optimization
- **Efficient Aggregation**: Avoids repeated SUM() calculations on every check

### 2. Race Condition Prevention
- **Advisory Locks**: Uses `pg_advisory_xact_lock()` to serialize quota checks per user
- **Atomic Operations**: Quota validation happens within the same transaction as the insert
- **Lock Key Generation**: Unique lock ID derived from user UUID

### 3. Comprehensive Policies
- **INSERT Policy**: Enforces quota on new uploads with advisory lock
- **UPDATE Policy**: Prevents file size increases that exceed quota
- **DELETE Policy**: Allows users to delete their own files
- **SELECT Policy**: Public read access to blog images

## Functions Reference

### Quota Calculation Functions

#### `calculate_author_storage_usage(user_id UUID) → BIGINT`
Returns total storage used by an author in bytes.

#### `check_author_storage_quota(user_id UUID, additional_bytes BIGINT) → BOOLEAN`
Checks if adding `additional_bytes` would exceed the user's quota.

#### `get_author_storage_info(user_id UUID) → TABLE`
Returns detailed quota information:
- `quota_mb`: Allocated quota in MB
- `used_mb`: Current usage in MB
- `available_mb`: Remaining space in MB
- `usage_percentage`: Percentage of quota used
- `file_count`: Number of files stored

### Client-Side Functions

#### `can_upload_file(file_size_bytes BIGINT) → JSONB`
Pre-flight check for client applications:
```sql
SELECT can_upload_file(5242880); -- Check if 5MB upload is allowed
```

Returns:
```json
{
  "allowed": true,
  "available_mb": 45.5,
  "quota_mb": 50,
  "used_mb": 4.5,
  "usage_percentage": 9.0,
  "file_count": 12
}
```

### Maintenance Functions

#### `cleanup_orphaned_blog_images() → TABLE`
Removes images not referenced in any blog post (older than 7 days).

#### `reconcile_storage_quotas() → TABLE`
Analyzes all users' storage usage and identifies those over or near quota.

#### `get_users_near_quota_limit(threshold_percentage NUMERIC) → TABLE`
Returns users approaching their quota limit (default 90%).

#### `run_storage_quota_maintenance() → UUID`
Main background job that performs all maintenance tasks.

## Implementation Details

### Advisory Lock Mechanism

The system uses PostgreSQL advisory locks to prevent race conditions:

```sql
-- Lock ID generation from user UUID
('x' || translate(auth.uid()::text, '-', ''))::bit(64)::bigint
```

This creates a unique 64-bit integer from the user's UUID for the advisory lock.

### Storage Policy Example

The INSERT policy with quota enforcement:

```sql
CREATE POLICY "Authors can upload images within quota"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'blog-images' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM blog_authors ba
    WHERE ba.user_id = auth.uid()
  )
  AND (
    -- Advisory lock prevents concurrent uploads
    SELECT pg_advisory_xact_lock(
      ('x' || translate(auth.uid()::text, '-', ''))::bit(64)::bigint
    )
  ) IS NOT NULL
  AND check_author_storage_quota(
    auth.uid(), 
    (metadata->>'size')::BIGINT
  )
);
```

## Background Jobs

### Scheduled Maintenance

Run the maintenance job periodically (recommended: every hour):

```sql
SELECT run_storage_quota_maintenance();
```

This job:
1. Reconciles calculated vs actual storage usage
2. Identifies users over or near quota
3. Cleans up orphaned files
4. Records metrics in `blog_storage_quota_jobs` table

### Monitoring

Query job history:
```sql
SELECT * FROM blog_storage_quota_jobs 
ORDER BY run_at DESC 
LIMIT 10;
```

## Best Practices

### 1. Client-Side Validation
Always check quota before attempting upload:
```javascript
const { data } = await supabase.rpc('can_upload_file', { 
  p_file_size_bytes: file.size 
});

if (!data.allowed) {
  alert(`Upload failed: ${data.reason}`);
  return;
}
```

### 2. Handle Quota Errors Gracefully
```javascript
const { error } = await supabase.storage
  .from('blog-images')
  .upload(path, file);

if (error?.message?.includes('quota')) {
  // Show quota exceeded message
  showQuotaExceededDialog(data.quota_mb, data.used_mb);
}
```

### 3. Monitor Usage Trends
Set up alerts for users approaching quota:
```sql
-- Alert when users reach 90% of quota
SELECT * FROM get_users_near_quota_limit(90);
```

### 4. Regular Maintenance
Schedule the maintenance job to run hourly:
```sql
-- Example using pg_cron
SELECT cron.schedule(
  'blog-storage-maintenance',
  '0 * * * *', -- Every hour
  'SELECT run_storage_quota_maintenance();'
);
```

## Troubleshooting

### Issue: Uploads fail despite having quota
**Solution**: Check for orphaned advisory locks:
```sql
SELECT * FROM pg_locks WHERE locktype = 'advisory';
```

### Issue: Quota calculations seem incorrect
**Solution**: Run reconciliation manually:
```sql
SELECT * FROM reconcile_storage_quotas() 
WHERE status = 'over_quota';
```

### Issue: Performance degradation
**Solution**: Verify indexes exist:
```sql
SELECT indexname FROM pg_indexes 
WHERE schemaname = 'storage' 
AND tablename = 'objects' 
AND indexname LIKE '%quota%';
```

## Migration Rollback

If needed, the migration can be rolled back:
```sql
-- Drop new functions and policies
DROP FUNCTION IF EXISTS calculate_author_storage_usage CASCADE;
DROP FUNCTION IF EXISTS check_author_storage_quota CASCADE;
-- ... etc

-- Restore original policies
-- (Re-run the original blog CMS migration)
```