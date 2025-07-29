-- =====================================================
-- Blog Storage Quota System Fixes
-- =====================================================
-- This migration fixes race conditions and performance issues
-- in the blog storage quota system
-- =====================================================

-- =====================================================
-- Performance Indexes
-- =====================================================

-- Index for fast quota calculations - critical for performance
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
    -- Create index for quota lookups if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND indexname = 'idx_storage_objects_quota'
    ) THEN
      CREATE INDEX idx_storage_objects_quota 
        ON storage.objects(bucket_id, owner) 
        WHERE bucket_id = 'blog-images';
      
      -- Additional index for size calculations
      CREATE INDEX idx_storage_objects_quota_size
        ON storage.objects(bucket_id, owner, metadata->>'size')
        WHERE bucket_id = 'blog-images';
    END IF;
  END IF;
END $$;

-- =====================================================
-- Quota Management Functions
-- =====================================================

-- Function to calculate user's current storage usage with caching
CREATE OR REPLACE FUNCTION calculate_author_storage_usage(p_user_id UUID)
RETURNS BIGINT AS $$
DECLARE
  v_total_bytes BIGINT;
BEGIN
  -- Calculate total storage used by the author
  SELECT COALESCE(SUM((metadata->>'size')::BIGINT), 0)
  INTO v_total_bytes
  FROM storage.objects
  WHERE bucket_id = 'blog-images'
  AND owner = p_user_id;
  
  RETURN v_total_bytes;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if user has available quota
CREATE OR REPLACE FUNCTION check_author_storage_quota(
  p_user_id UUID,
  p_additional_bytes BIGINT DEFAULT 0
) RETURNS BOOLEAN AS $$
DECLARE
  v_quota_mb INTEGER;
  v_quota_bytes BIGINT;
  v_current_usage BIGINT;
BEGIN
  -- Get user's quota
  SELECT storage_quota_mb
  INTO v_quota_mb
  FROM blog_authors
  WHERE user_id = p_user_id;
  
  IF v_quota_mb IS NULL THEN
    RETURN FALSE; -- No author profile
  END IF;
  
  -- Convert MB to bytes
  v_quota_bytes := v_quota_mb::BIGINT * 1024 * 1024;
  
  -- Get current usage
  v_current_usage := calculate_author_storage_usage(p_user_id);
  
  -- Check if new upload would exceed quota
  RETURN (v_current_usage + p_additional_bytes) <= v_quota_bytes;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get detailed quota information
CREATE OR REPLACE FUNCTION get_author_storage_info(p_user_id UUID)
RETURNS TABLE (
  quota_mb INTEGER,
  quota_bytes BIGINT,
  used_bytes BIGINT,
  used_mb NUMERIC,
  available_bytes BIGINT,
  available_mb NUMERIC,
  usage_percentage NUMERIC,
  file_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH author_quota AS (
    SELECT storage_quota_mb
    FROM blog_authors
    WHERE user_id = p_user_id
  ),
  usage_stats AS (
    SELECT 
      COALESCE(SUM((metadata->>'size')::BIGINT), 0) as total_bytes,
      COUNT(*)::INTEGER as total_files
    FROM storage.objects
    WHERE bucket_id = 'blog-images'
    AND owner = p_user_id
  )
  SELECT 
    aq.storage_quota_mb,
    aq.storage_quota_mb::BIGINT * 1024 * 1024,
    us.total_bytes,
    ROUND(us.total_bytes::NUMERIC / 1024 / 1024, 2),
    GREATEST(0, (aq.storage_quota_mb::BIGINT * 1024 * 1024) - us.total_bytes),
    ROUND(GREATEST(0, (aq.storage_quota_mb::BIGINT * 1024 * 1024) - us.total_bytes)::NUMERIC / 1024 / 1024, 2),
    ROUND((us.total_bytes::NUMERIC / (aq.storage_quota_mb::BIGINT * 1024 * 1024)) * 100, 2),
    us.total_files
  FROM author_quota aq
  CROSS JOIN usage_stats us;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- Drop existing storage policies if they exist
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
    -- Drop existing policies to recreate with quota enforcement
    DROP POLICY IF EXISTS "Authors can upload images within quota" ON storage.objects;
    DROP POLICY IF EXISTS "Authors can manage their own images" ON storage.objects;
    DROP POLICY IF EXISTS "Public can view blog images" ON storage.objects;
    DROP POLICY IF EXISTS "Admins can manage all blog images" ON storage.objects;
  END IF;
END $$;

-- =====================================================
-- Enhanced Storage Policies with Quota Enforcement
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
    
    -- INSERT policy with advisory lock and quota check
    EXECUTE 'CREATE POLICY "Authors can upload images within quota"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = ''blog-images'' 
      AND auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM blog_authors ba
        WHERE ba.user_id = auth.uid()
      )
      AND (
        -- Use advisory lock to prevent race conditions
        -- Lock is automatically released at end of transaction
        SELECT pg_advisory_xact_lock(
          -- Create unique lock ID from user ID
          (''x'' || translate(auth.uid()::text, ''-'', ''''))::bit(64)::bigint
        )
      ) IS NOT NULL
      AND check_author_storage_quota(
        auth.uid(), 
        (metadata->>''size'')::BIGINT
      )
    )';

    -- UPDATE policy to prevent file size increases that exceed quota
    EXECUTE 'CREATE POLICY "Authors can update their images within quota"
    ON storage.objects FOR UPDATE
    USING (
      bucket_id = ''blog-images'' 
      AND owner = auth.uid()
    )
    WITH CHECK (
      bucket_id = ''blog-images''
      AND owner = auth.uid()
      AND (
        -- If size is not changing, allow update
        (OLD.metadata->>''size'')::BIGINT = (NEW.metadata->>''size'')::BIGINT
        OR
        -- If size is changing, check quota with advisory lock
        (
          (SELECT pg_advisory_xact_lock(
            (''x'' || translate(auth.uid()::text, ''-'', ''''))::bit(64)::bigint
          )) IS NOT NULL
          AND check_author_storage_quota(
            auth.uid(), 
            (NEW.metadata->>''size'')::BIGINT - (OLD.metadata->>''size'')::BIGINT
          )
        )
      )
    )';

    -- DELETE policy - authors can delete their own images
    EXECUTE 'CREATE POLICY "Authors can delete their own images"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = ''blog-images'' 
      AND owner = auth.uid()
    )';

    -- SELECT policy - public can view blog images
    EXECUTE 'CREATE POLICY "Public can view blog images"
    ON storage.objects FOR SELECT
    USING (bucket_id = ''blog-images'')';

    -- Admin policies
    EXECUTE 'CREATE POLICY "Admins can manage all blog images"
    ON storage.objects FOR ALL
    USING (
      bucket_id = ''blog-images'' 
      AND EXISTS (
        SELECT 1 FROM admins WHERE user_id = auth.uid()
      )
    )';
    
  END IF;
END $$;

-- =====================================================
-- Quota Maintenance Functions
-- =====================================================

-- Function to clean up orphaned files (files without corresponding blog posts)
CREATE OR REPLACE FUNCTION cleanup_orphaned_blog_images()
RETURNS TABLE (
  deleted_count INTEGER,
  freed_bytes BIGINT
) AS $$
DECLARE
  v_deleted_count INTEGER := 0;
  v_freed_bytes BIGINT := 0;
  v_file RECORD;
BEGIN
  -- Find orphaned images (not referenced in any blog post)
  FOR v_file IN 
    SELECT o.name, o.owner, (o.metadata->>'size')::BIGINT as size
    FROM storage.objects o
    WHERE o.bucket_id = 'blog-images'
    AND NOT EXISTS (
      -- Check if image is used as featured image
      SELECT 1 FROM blog_posts bp
      WHERE bp.featured_image_url LIKE '%' || o.name || '%'
    )
    AND NOT EXISTS (
      -- Check if image is referenced in post content
      SELECT 1 FROM blog_posts bp
      WHERE bp.content LIKE '%' || o.name || '%'
    )
    AND o.created_at < NOW() - INTERVAL '7 days' -- Only clean files older than 7 days
  LOOP
    -- Delete the orphaned file
    DELETE FROM storage.objects
    WHERE bucket_id = 'blog-images'
    AND name = v_file.name
    AND owner = v_file.owner;
    
    v_deleted_count := v_deleted_count + 1;
    v_freed_bytes := v_freed_bytes + v_file.size;
  END LOOP;
  
  RETURN QUERY SELECT v_deleted_count, v_freed_bytes;
END;
$$ LANGUAGE plpgsql;

-- Function to reconcile storage quotas (for background job)
CREATE OR REPLACE FUNCTION reconcile_storage_quotas()
RETURNS TABLE (
  user_id UUID,
  calculated_bytes BIGINT,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH user_storage AS (
    SELECT 
      ba.user_id,
      ba.storage_quota_mb,
      COALESCE(SUM((so.metadata->>'size')::BIGINT), 0) as used_bytes
    FROM blog_authors ba
    LEFT JOIN storage.objects so ON so.owner = ba.user_id AND so.bucket_id = 'blog-images'
    GROUP BY ba.user_id, ba.storage_quota_mb
  )
  SELECT 
    us.user_id,
    us.used_bytes,
    CASE 
      WHEN us.used_bytes > (us.storage_quota_mb::BIGINT * 1024 * 1024) THEN 'over_quota'
      WHEN us.used_bytes > (us.storage_quota_mb::BIGINT * 1024 * 1024 * 0.9) THEN 'near_quota'
      ELSE 'ok'
    END as status
  FROM user_storage us;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Alert Functions
-- =====================================================

-- Function to check users approaching quota limits
CREATE OR REPLACE FUNCTION get_users_near_quota_limit(threshold_percentage NUMERIC DEFAULT 90)
RETURNS TABLE (
  user_id UUID,
  user_email TEXT,
  display_name TEXT,
  quota_mb INTEGER,
  used_mb NUMERIC,
  usage_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH usage_data AS (
    SELECT 
      ba.user_id,
      ba.display_name,
      ba.storage_quota_mb,
      COALESCE(SUM((so.metadata->>'size')::BIGINT), 0) as used_bytes
    FROM blog_authors ba
    LEFT JOIN storage.objects so ON so.owner = ba.user_id AND so.bucket_id = 'blog-images'
    GROUP BY ba.user_id, ba.display_name, ba.storage_quota_mb
  )
  SELECT 
    ud.user_id,
    u.email,
    ud.display_name,
    ud.storage_quota_mb,
    ROUND(ud.used_bytes::NUMERIC / 1024 / 1024, 2),
    ROUND((ud.used_bytes::NUMERIC / (ud.storage_quota_mb::BIGINT * 1024 * 1024)) * 100, 2)
  FROM usage_data ud
  JOIN users u ON u.id = ud.user_id
  WHERE (ud.used_bytes::NUMERIC / (ud.storage_quota_mb::BIGINT * 1024 * 1024)) * 100 >= threshold_percentage;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Background Job Support
-- =====================================================

-- Create a table to track quota reconciliation runs
CREATE TABLE IF NOT EXISTS blog_storage_quota_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_at TIMESTAMPTZ DEFAULT NOW(),
  users_checked INTEGER,
  users_over_quota INTEGER,
  users_near_quota INTEGER,
  orphaned_files_deleted INTEGER,
  bytes_freed BIGINT,
  duration_ms INTEGER,
  status TEXT CHECK (status IN ('running', 'completed', 'failed')),
  error_message TEXT
);

-- Function for background job to run
CREATE OR REPLACE FUNCTION run_storage_quota_maintenance()
RETURNS UUID AS $$
DECLARE
  v_job_id UUID;
  v_start_time TIMESTAMPTZ;
  v_users_checked INTEGER := 0;
  v_users_over INTEGER := 0;
  v_users_near INTEGER := 0;
  v_orphaned_deleted INTEGER;
  v_bytes_freed BIGINT;
BEGIN
  -- Create job record
  INSERT INTO blog_storage_quota_jobs (status)
  VALUES ('running')
  RETURNING id INTO v_job_id;
  
  v_start_time := clock_timestamp();
  
  -- Run quota reconciliation
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'over_quota'),
    COUNT(*) FILTER (WHERE status = 'near_quota')
  INTO v_users_checked, v_users_over, v_users_near
  FROM reconcile_storage_quotas();
  
  -- Clean up orphaned files
  SELECT deleted_count, freed_bytes
  INTO v_orphaned_deleted, v_bytes_freed
  FROM cleanup_orphaned_blog_images();
  
  -- Update job record
  UPDATE blog_storage_quota_jobs
  SET 
    users_checked = v_users_checked,
    users_over_quota = v_users_over,
    users_near_quota = v_users_near,
    orphaned_files_deleted = v_orphaned_deleted,
    bytes_freed = v_bytes_freed,
    duration_ms = EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER,
    status = 'completed'
  WHERE id = v_job_id;
  
  RETURN v_job_id;
EXCEPTION
  WHEN OTHERS THEN
    UPDATE blog_storage_quota_jobs
    SET 
      status = 'failed',
      error_message = SQLERRM,
      duration_ms = EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER
    WHERE id = v_job_id;
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Helper function for client-side quota checks
-- =====================================================

-- Function to pre-check if upload would exceed quota (for client-side validation)
CREATE OR REPLACE FUNCTION can_upload_file(p_file_size_bytes BIGINT)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_user_id UUID;
  v_quota_info RECORD;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Not authenticated'
    );
  END IF;
  
  -- Get quota info
  SELECT * INTO v_quota_info
  FROM get_author_storage_info(v_user_id);
  
  IF v_quota_info.quota_mb IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'No author profile found'
    );
  END IF;
  
  IF p_file_size_bytes > v_quota_info.available_bytes THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'File size exceeds available quota',
      'file_size_mb', ROUND(p_file_size_bytes::NUMERIC / 1024 / 1024, 2),
      'available_mb', v_quota_info.available_mb,
      'quota_mb', v_quota_info.quota_mb,
      'used_mb', v_quota_info.used_mb,
      'usage_percentage', v_quota_info.usage_percentage
    );
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'available_mb', v_quota_info.available_mb,
    'quota_mb', v_quota_info.quota_mb,
    'used_mb', v_quota_info.used_mb,
    'usage_percentage', v_quota_info.usage_percentage,
    'file_count', v_quota_info.file_count
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission on quota check function to authenticated users
GRANT EXECUTE ON FUNCTION can_upload_file(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_author_storage_info(UUID) TO authenticated;

-- =====================================================
-- Add RLS policies for quota jobs table
-- =====================================================

ALTER TABLE blog_storage_quota_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view quota jobs"
  ON blog_storage_quota_jobs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM admins WHERE user_id = auth.uid()
  ));

-- =====================================================
-- Comments and Documentation
-- =====================================================

COMMENT ON FUNCTION calculate_author_storage_usage IS 'Calculates total storage usage in bytes for a blog author';
COMMENT ON FUNCTION check_author_storage_quota IS 'Checks if a user has sufficient quota for an upload';
COMMENT ON FUNCTION get_author_storage_info IS 'Returns detailed storage quota information for an author';
COMMENT ON FUNCTION cleanup_orphaned_blog_images IS 'Removes images not referenced by any blog post';
COMMENT ON FUNCTION reconcile_storage_quotas IS 'Reconciles calculated storage usage for all authors';
COMMENT ON FUNCTION get_users_near_quota_limit IS 'Returns users approaching their storage quota limit';
COMMENT ON FUNCTION run_storage_quota_maintenance IS 'Main background job function for storage maintenance';
COMMENT ON FUNCTION can_upload_file IS 'Client-side helper to pre-check if file upload is allowed';
COMMENT ON INDEX storage.idx_storage_objects_quota IS 'Performance index for quota calculations';
COMMENT ON TABLE blog_storage_quota_jobs IS 'Tracks storage quota maintenance job runs';