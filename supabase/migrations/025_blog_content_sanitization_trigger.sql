-- =====================================================
-- Blog Content Sanitization Trigger Enhancement
-- =====================================================
-- This migration enhances the existing content sanitization system
-- by updating the trigger implementation to use the latest pg_net
-- patterns and improved error handling.
-- =====================================================

-- Enable required extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =====================================================
-- Enhanced Sanitization Function using pg_net
-- =====================================================

-- Drop and recreate the function with improved implementation
DROP FUNCTION IF EXISTS sanitize_blog_content() CASCADE;

CREATE OR REPLACE FUNCTION sanitize_blog_content()
RETURNS TRIGGER AS $$
DECLARE
  sanitized_content TEXT;
  response_status INTEGER;
  response_body JSONB;
  request_id BIGINT;
  edge_function_url TEXT;
  service_role_key TEXT;
  max_retries INTEGER := 2;
  retry_count INTEGER := 0;
  content_type TEXT;
BEGIN
  -- Determine content type based on table
  IF TG_TABLE_NAME = 'blog_posts' THEN
    content_type := 'markdown';
  ELSIF TG_TABLE_NAME = 'blog_comments' THEN
    content_type := 'html';
  ELSE
    content_type := 'html'; -- Default fallback
  END IF;

  -- Skip if content is null or empty
  IF NEW.content IS NULL OR trim(NEW.content) = '' THEN
    NEW.content_sanitized := NULL;
    RETURN NEW;
  END IF;

  -- Skip if content hasn't changed on update
  IF TG_OP = 'UPDATE' AND OLD.content IS NOT DISTINCT FROM NEW.content THEN
    RETURN NEW;
  END IF;

  -- Get Edge Function URL and service role key
  BEGIN
    edge_function_url := current_setting('app.supabase_functions_url') || '/sanitize-html';
    service_role_key := current_setting('app.supabase_service_role_key');
  EXCEPTION
    WHEN OTHERS THEN
      -- Fallback to environment-specific settings
      edge_function_url := current_setting('app.supabase_url', true) || '/functions/v1/sanitize-html';
      service_role_key := current_setting('app.service_role_key', true);
  END;

  -- Retry loop for resilience
  WHILE retry_count <= max_retries LOOP
    BEGIN
      -- Call edge function for sanitization using pg_net
      SELECT net.http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || service_role_key,
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'content', NEW.content,
          'contentType', content_type
        )::text
      ) INTO request_id;
      
      -- Wait for response with exponential backoff
      PERFORM pg_sleep(0.1 * power(2, retry_count));
      
      -- Get response
      SELECT status, response_body::jsonb 
      INTO response_status, response_body
      FROM net.http_response
      WHERE id = request_id
      LIMIT 1;
      
      -- Clean up response record
      DELETE FROM net.http_response WHERE id = request_id;
      
      -- Check if response was successful
      IF response_status = 200 AND response_body IS NOT NULL THEN
        sanitized_content := response_body->>'sanitized';
        
        IF sanitized_content IS NOT NULL THEN
          NEW.content_sanitized := sanitized_content;
          
          -- For comments, mark as spam if dangerous content was detected
          IF TG_TABLE_NAME = 'blog_comments' AND (response_body->>'isClean')::boolean = false THEN
            NEW.status := 'spam';
          END IF;
          
          -- Validate sanitization didn't remove too much content
          IF length(NEW.content_sanitized) < (length(NEW.content) * 0.5) THEN
            RAISE EXCEPTION 'Content sanitization removed too much content. Possible XSS attempt detected.';
          END IF;
          
          RETURN NEW;
        END IF;
      END IF;
      
      retry_count := retry_count + 1;
    EXCEPTION
      WHEN OTHERS THEN
        -- Log error and continue to retry or fallback
        RAISE WARNING 'Sanitization attempt % failed: %', retry_count, SQLERRM;
        retry_count := retry_count + 1;
    END;
  END LOOP;

  -- If all retries failed, use basic fallback sanitization
  NEW.content_sanitized := regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(NEW.content, '&', '&amp;', 'g'),
            '<', '&lt;', 'g'
          ),
          '>', '&gt;', 'g'
        ),
        '"', '&quot;', 'g'
      ),
      '''', '&#39;', 'g'
    ),
    '/', '&#47;', 'g'
  );

  -- Log fallback usage for monitoring
  INSERT INTO audit_logs (
    table_name,
    action,
    user_id,
    record_id,
    new_data,
    created_at
  ) VALUES (
    TG_TABLE_NAME,
    'sanitization_fallback',
    auth.uid(),
    NEW.id,
    jsonb_build_object(
      'reason', 'Edge function unavailable after retries',
      'retry_count', max_retries,
      'content_length', length(NEW.content)
    ),
    NOW()
  );

  -- For comments, store additional security metadata
  IF TG_TABLE_NAME = 'blog_comments' THEN
    NEW.ip_address := COALESCE(
      NEW.ip_address, 
      inet(current_setting('request.headers', true)::json->>'x-forwarded-for')
    );
    NEW.user_agent := COALESCE(
      NEW.user_agent, 
      current_setting('request.headers', true)::json->>'user-agent'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Update Triggers
-- =====================================================

-- Drop existing triggers
DROP TRIGGER IF EXISTS sanitize_blog_post_content ON blog_posts;
DROP TRIGGER IF EXISTS sanitize_blog_comment_content ON blog_comments;
DROP TRIGGER IF EXISTS sanitize_blog_post_before_insert ON blog_posts;
DROP TRIGGER IF EXISTS sanitize_blog_post_before_update ON blog_posts;
DROP TRIGGER IF EXISTS sanitize_blog_comment_before_insert ON blog_comments;
DROP TRIGGER IF EXISTS sanitize_blog_comment_before_update ON blog_comments;

-- Create consolidated triggers for blog posts
CREATE TRIGGER sanitize_blog_post_content
  BEFORE INSERT OR UPDATE OF content ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION sanitize_blog_content();

-- Create consolidated triggers for blog comments
CREATE TRIGGER sanitize_blog_comment_content
  BEFORE INSERT OR UPDATE OF content ON blog_comments
  FOR EACH ROW
  EXECUTE FUNCTION sanitize_blog_content();

-- =====================================================
-- Performance Optimization Index
-- =====================================================

-- Add index for faster queries on unsanitized content
CREATE INDEX IF NOT EXISTS idx_blog_posts_unsanitized 
  ON blog_posts(id) 
  WHERE content IS NOT NULL AND content_sanitized IS NULL;

CREATE INDEX IF NOT EXISTS idx_blog_comments_unsanitized 
  ON blog_comments(id) 
  WHERE content IS NOT NULL AND content_sanitized IS NULL;

-- =====================================================
-- Monitoring Function
-- =====================================================

-- Function to check sanitization health
CREATE OR REPLACE FUNCTION check_sanitization_health()
RETURNS TABLE (
  table_name TEXT,
  total_records INTEGER,
  sanitized_records INTEGER,
  unsanitized_records INTEGER,
  fallback_records INTEGER,
  health_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH post_stats AS (
    SELECT 
      'blog_posts'::TEXT as tbl,
      COUNT(*)::INTEGER as total,
      COUNT(*) FILTER (WHERE content_sanitized IS NOT NULL)::INTEGER as sanitized,
      COUNT(*) FILTER (WHERE content IS NOT NULL AND content_sanitized IS NULL)::INTEGER as unsanitized,
      0::INTEGER as fallback -- Would need to track this separately
    FROM blog_posts
  ),
  comment_stats AS (
    SELECT 
      'blog_comments'::TEXT as tbl,
      COUNT(*)::INTEGER as total,
      COUNT(*) FILTER (WHERE content_sanitized IS NOT NULL)::INTEGER as sanitized,
      COUNT(*) FILTER (WHERE content IS NOT NULL AND content_sanitized IS NULL)::INTEGER as unsanitized,
      0::INTEGER as fallback
    FROM blog_comments
  )
  SELECT 
    tbl,
    total,
    sanitized,
    unsanitized,
    fallback,
    CASE 
      WHEN unsanitized = 0 THEN 'healthy'
      WHEN unsanitized > (total * 0.1) THEN 'critical'
      ELSE 'warning'
    END as health_status
  FROM (
    SELECT * FROM post_stats
    UNION ALL
    SELECT * FROM comment_stats
  ) stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_sanitization_health() TO authenticated;

-- =====================================================
-- Batch Sanitization for Existing Content
-- =====================================================

-- Function to sanitize any remaining unsanitized content
CREATE OR REPLACE FUNCTION batch_sanitize_remaining_content(
  batch_size INTEGER DEFAULT 50
) RETURNS INTEGER AS $$
DECLARE
  processed_count INTEGER := 0;
  post_record RECORD;
  comment_record RECORD;
BEGIN
  -- Process unsanitized blog posts
  FOR post_record IN 
    SELECT id, content 
    FROM blog_posts 
    WHERE content IS NOT NULL 
      AND content_sanitized IS NULL
    ORDER BY created_at DESC
    LIMIT batch_size
  LOOP
    UPDATE blog_posts 
    SET content = content -- This will trigger the sanitization trigger
    WHERE id = post_record.id;
    
    processed_count := processed_count + 1;
    
    -- Small delay to avoid overloading
    PERFORM pg_sleep(0.02);
  END LOOP;

  -- Process unsanitized blog comments
  FOR comment_record IN 
    SELECT id, content 
    FROM blog_comments 
    WHERE content IS NOT NULL 
      AND content_sanitized IS NULL
    ORDER BY created_at DESC
    LIMIT batch_size
  LOOP
    UPDATE blog_comments 
    SET content = content -- This will trigger the sanitization trigger
    WHERE id = comment_record.id;
    
    processed_count := processed_count + 1;
    
    -- Small delay to avoid overloading
    PERFORM pg_sleep(0.02);
  END LOOP;

  RETURN processed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Process any remaining unsanitized content
SELECT batch_sanitize_remaining_content(100);

-- =====================================================
-- Rollback Instructions
-- =====================================================

-- To rollback this migration:
/*
DROP TRIGGER IF EXISTS sanitize_blog_post_content ON blog_posts;
DROP TRIGGER IF EXISTS sanitize_blog_comment_content ON blog_comments;
DROP FUNCTION IF EXISTS sanitize_blog_content() CASCADE;
DROP FUNCTION IF EXISTS check_sanitization_health() CASCADE;
DROP FUNCTION IF EXISTS batch_sanitize_remaining_content(INTEGER) CASCADE;
DROP INDEX IF EXISTS idx_blog_posts_unsanitized;
DROP INDEX IF EXISTS idx_blog_comments_unsanitized;

-- Note: This rollback will not restore the previous trigger implementation.
-- You would need to re-run migration 019 to restore the original implementation.
*/