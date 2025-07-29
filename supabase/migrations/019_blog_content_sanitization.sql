-- =====================================================
-- Blog Content Sanitization Migration
-- =====================================================
-- This migration adds server-side HTML sanitization for blog posts and comments
-- to prevent XSS attacks. It uses Edge Functions for sanitization and
-- PostgreSQL triggers to ensure all content is sanitized before storage.
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS http;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =====================================================
-- Sanitization Functions
-- =====================================================

-- Function to call the sanitize-html Edge Function
CREATE OR REPLACE FUNCTION sanitize_html_content(
  content_to_sanitize TEXT,
  content_type TEXT DEFAULT 'markdown'
) RETURNS JSONB AS $$
DECLARE
  edge_function_url TEXT;
  auth_token TEXT;
  response JSONB;
  request_id BIGINT;
  request_body JSONB;
BEGIN
  -- Get Edge Function URL and service role key
  edge_function_url := current_setting('app.supabase_url', true) || '/functions/v1/sanitize-html';
  auth_token := current_setting('app.supabase_service_role_key', true);

  -- Return null for empty content
  IF content_to_sanitize IS NULL OR trim(content_to_sanitize) = '' THEN
    RETURN jsonb_build_object(
      'sanitized', NULL,
      'isClean', true
    );
  END IF;

  -- Prepare request body
  request_body := jsonb_build_object(
    'content', content_to_sanitize,
    'contentType', content_type
  );

  -- Make HTTP request to Edge Function using pg_net
  SELECT net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || auth_token,
      'Content-Type', 'application/json'
    ),
    body := request_body
  ) INTO request_id;

  -- Wait for response (with timeout)
  PERFORM pg_sleep(0.1); -- Initial wait
  
  -- Get response
  SELECT response_body::jsonb INTO response
  FROM net.http_response
  WHERE request_id = sanitize_html_content.request_id
  LIMIT 1;

  -- If no response, try once more with longer wait
  IF response IS NULL THEN
    PERFORM pg_sleep(0.4);
    SELECT response_body::jsonb INTO response
    FROM net.http_response
    WHERE request_id = sanitize_html_content.request_id
    LIMIT 1;
  END IF;

  -- Clean up response
  DELETE FROM net.http_response WHERE request_id = sanitize_html_content.request_id;

  -- Return response or error
  IF response IS NULL THEN
    RETURN jsonb_build_object(
      'sanitized', NULL,
      'isClean', false,
      'error', 'Sanitization timeout'
    );
  END IF;

  RETURN response;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return failure
    RAISE WARNING 'HTML sanitization error: %', SQLERRM;
    RETURN jsonb_build_object(
      'sanitized', NULL,
      'isClean', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fallback sanitization function (basic, for when Edge Function is unavailable)
CREATE OR REPLACE FUNCTION sanitize_html_fallback(content TEXT) RETURNS TEXT AS $$
DECLARE
  cleaned_content TEXT;
BEGIN
  -- Basic HTML entity encoding as fallback
  cleaned_content := content;
  
  -- Replace dangerous characters with HTML entities
  cleaned_content := replace(cleaned_content, '&', '&amp;');
  cleaned_content := replace(cleaned_content, '<', '&lt;');
  cleaned_content := replace(cleaned_content, '>', '&gt;');
  cleaned_content := replace(cleaned_content, '"', '&quot;');
  cleaned_content := replace(cleaned_content, '''', '&#39;');
  cleaned_content := replace(cleaned_content, '/', '&#47;');
  
  RETURN cleaned_content;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- Blog Posts Sanitization
-- =====================================================

-- Function to sanitize blog post content
CREATE OR REPLACE FUNCTION sanitize_blog_post_content() RETURNS TRIGGER AS $$
DECLARE
  sanitization_result JSONB;
  sanitized_content TEXT;
BEGIN
  -- Skip if content hasn't changed on update
  IF TG_OP = 'UPDATE' AND OLD.content IS NOT DISTINCT FROM NEW.content THEN
    RETURN NEW;
  END IF;

  -- Skip if content is empty
  IF NEW.content IS NULL OR trim(NEW.content) = '' THEN
    NEW.content_sanitized := NULL;
    RETURN NEW;
  END IF;

  -- Attempt to sanitize using Edge Function
  sanitization_result := sanitize_html_content(NEW.content, 'markdown');
  
  -- Extract sanitized content
  sanitized_content := sanitization_result->>'sanitized';
  
  -- Check if sanitization was successful
  IF sanitized_content IS NOT NULL AND (sanitization_result->>'isClean')::boolean IS NOT FALSE THEN
    NEW.content_sanitized := sanitized_content;
  ELSE
    -- If Edge Function failed, use fallback
    NEW.content_sanitized := sanitize_html_fallback(NEW.content);
    
    -- Log warning for monitoring
    INSERT INTO audit_logs (
      table_name,
      action,
      user_id,
      record_id,
      new_data,
      created_at
    ) VALUES (
      'blog_posts',
      'sanitization_fallback',
      auth.uid(),
      NEW.id,
      jsonb_build_object(
        'reason', coalesce(sanitization_result->>'error', 'Edge Function unavailable'),
        'post_title', NEW.title
      ),
      NOW()
    );
  END IF;

  -- Reject if sanitization removed too much content (potential attack)
  IF length(NEW.content_sanitized) < (length(NEW.content) * 0.5) THEN
    RAISE EXCEPTION 'Content sanitization removed too much content. Possible XSS attempt detected.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Blog Comments Sanitization
-- =====================================================

-- Function to sanitize blog comment content
CREATE OR REPLACE FUNCTION sanitize_blog_comment_content() RETURNS TRIGGER AS $$
DECLARE
  sanitization_result JSONB;
  sanitized_content TEXT;
BEGIN
  -- Skip if content hasn't changed on update
  IF TG_OP = 'UPDATE' AND OLD.content IS NOT DISTINCT FROM NEW.content THEN
    RETURN NEW;
  END IF;

  -- Skip if content is empty
  IF NEW.content IS NULL OR trim(NEW.content) = '' THEN
    NEW.content_sanitized := NULL;
    RETURN NEW;
  END IF;

  -- Comments are HTML, not markdown
  sanitization_result := sanitize_html_content(NEW.content, 'html');
  
  -- Extract sanitized content
  sanitized_content := sanitization_result->>'sanitized';
  
  -- Check if sanitization was successful
  IF sanitized_content IS NOT NULL AND (sanitization_result->>'isClean')::boolean IS NOT FALSE THEN
    NEW.content_sanitized := sanitized_content;
    
    -- Mark as spam if dangerous content was detected
    IF (sanitization_result->>'isClean')::boolean = false THEN
      NEW.status := 'spam';
    END IF;
  ELSE
    -- If Edge Function failed, use fallback
    NEW.content_sanitized := sanitize_html_fallback(NEW.content);
    
    -- Log warning for monitoring
    INSERT INTO audit_logs (
      table_name,
      action,
      user_id,
      record_id,
      new_data,
      created_at
    ) VALUES (
      'blog_comments',
      'sanitization_fallback',
      auth.uid(),
      NEW.id,
      jsonb_build_object(
        'reason', coalesce(sanitization_result->>'error', 'Edge Function unavailable'),
        'post_id', NEW.post_id
      ),
      NOW()
    );
  END IF;

  -- Reject if sanitization removed too much content (potential attack)
  IF length(NEW.content_sanitized) < (length(NEW.content) * 0.5) THEN
    RAISE EXCEPTION 'Comment sanitization removed too much content. Possible XSS attempt detected.';
  END IF;

  -- Store user agent and IP for security monitoring
  NEW.ip_address := COALESCE(NEW.ip_address, inet(current_setting('request.headers', true)::json->>'x-forwarded-for'));
  NEW.user_agent := COALESCE(NEW.user_agent, current_setting('request.headers', true)::json->>'user-agent');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Create Triggers
-- =====================================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS sanitize_blog_post_before_insert ON blog_posts;
DROP TRIGGER IF EXISTS sanitize_blog_post_before_update ON blog_posts;
DROP TRIGGER IF EXISTS sanitize_blog_comment_before_insert ON blog_comments;
DROP TRIGGER IF EXISTS sanitize_blog_comment_before_update ON blog_comments;

-- Blog posts sanitization triggers
CREATE TRIGGER sanitize_blog_post_before_insert
  BEFORE INSERT ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION sanitize_blog_post_content();

CREATE TRIGGER sanitize_blog_post_before_update
  BEFORE UPDATE OF content ON blog_posts
  FOR EACH ROW
  WHEN (OLD.content IS DISTINCT FROM NEW.content)
  EXECUTE FUNCTION sanitize_blog_post_content();

-- Blog comments sanitization triggers
CREATE TRIGGER sanitize_blog_comment_before_insert
  BEFORE INSERT ON blog_comments
  FOR EACH ROW
  EXECUTE FUNCTION sanitize_blog_comment_content();

CREATE TRIGGER sanitize_blog_comment_before_update
  BEFORE UPDATE OF content ON blog_comments
  FOR EACH ROW
  WHEN (OLD.content IS DISTINCT FROM NEW.content)
  EXECUTE FUNCTION sanitize_blog_comment_content();

-- =====================================================
-- Update Existing Content
-- =====================================================

-- Function to batch sanitize existing content
CREATE OR REPLACE FUNCTION batch_sanitize_existing_content() RETURNS void AS $$
DECLARE
  post_record RECORD;
  comment_record RECORD;
  sanitization_result JSONB;
BEGIN
  -- Sanitize existing blog posts
  FOR post_record IN 
    SELECT id, content 
    FROM blog_posts 
    WHERE content IS NOT NULL 
    AND content_sanitized IS NULL
    ORDER BY created_at DESC
    LIMIT 100  -- Process in batches
  LOOP
    BEGIN
      sanitization_result := sanitize_html_content(post_record.content, 'markdown');
      
      UPDATE blog_posts 
      SET content_sanitized = COALESCE(
        sanitization_result->>'sanitized',
        sanitize_html_fallback(post_record.content)
      )
      WHERE id = post_record.id;
      
      -- Add small delay to avoid overloading Edge Function
      PERFORM pg_sleep(0.05);
    EXCEPTION
      WHEN OTHERS THEN
        -- Use fallback for this record
        UPDATE blog_posts 
        SET content_sanitized = sanitize_html_fallback(post_record.content)
        WHERE id = post_record.id;
    END;
  END LOOP;

  -- Sanitize existing blog comments
  FOR comment_record IN 
    SELECT id, content 
    FROM blog_comments 
    WHERE content IS NOT NULL 
    AND content_sanitized IS NULL
    ORDER BY created_at DESC
    LIMIT 100  -- Process in batches
  LOOP
    BEGIN
      sanitization_result := sanitize_html_content(comment_record.content, 'html');
      
      UPDATE blog_comments 
      SET content_sanitized = COALESCE(
        sanitization_result->>'sanitized',
        sanitize_html_fallback(comment_record.content)
      )
      WHERE id = comment_record.id;
      
      -- Add small delay to avoid overloading Edge Function
      PERFORM pg_sleep(0.05);
    EXCEPTION
      WHEN OTHERS THEN
        -- Use fallback for this record
        UPDATE blog_comments 
        SET content_sanitized = sanitize_html_fallback(comment_record.content)
        WHERE id = comment_record.id;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run initial sanitization for existing content
SELECT batch_sanitize_existing_content();

-- =====================================================
-- Security Policies
-- =====================================================

-- Ensure content_sanitized cannot be directly modified by users
CREATE OR REPLACE FUNCTION prevent_sanitized_content_modification() RETURNS TRIGGER AS $$
BEGIN
  -- Allow modification only if it's from our sanitization function
  IF current_setting('app.sanitization_in_progress', true) != 'true' THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.content_sanitized := OLD.content_sanitized;
    ELSIF TG_OP = 'INSERT' THEN
      NEW.content_sanitized := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add protection triggers
CREATE TRIGGER protect_blog_post_sanitized_content
  BEFORE INSERT OR UPDATE OF content_sanitized ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION prevent_sanitized_content_modification();

CREATE TRIGGER protect_blog_comment_sanitized_content
  BEFORE INSERT OR UPDATE OF content_sanitized ON blog_comments
  FOR EACH ROW
  EXECUTE FUNCTION prevent_sanitized_content_modification();

-- =====================================================
-- Monitoring Views
-- =====================================================

-- View to monitor sanitization failures
CREATE OR REPLACE VIEW blog_sanitization_monitoring AS
SELECT 
  'blog_posts' as table_name,
  COUNT(*) FILTER (WHERE content IS NOT NULL AND content_sanitized IS NULL) as unsanitized_count,
  COUNT(*) FILTER (WHERE content_sanitized = sanitize_html_fallback(content)) as fallback_count,
  COUNT(*) as total_count
FROM blog_posts
UNION ALL
SELECT 
  'blog_comments' as table_name,
  COUNT(*) FILTER (WHERE content IS NOT NULL AND content_sanitized IS NULL) as unsanitized_count,
  COUNT(*) FILTER (WHERE content_sanitized = sanitize_html_fallback(content)) as fallback_count,
  COUNT(*) as total_count
FROM blog_comments;

-- =====================================================
-- Grants
-- =====================================================

-- Grant execute permissions on sanitization functions to service role only
REVOKE ALL ON FUNCTION sanitize_html_content(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sanitize_html_content(TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION sanitize_html_fallback(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sanitize_html_fallback(TEXT) TO service_role;

-- Grant select on monitoring view to authenticated users
GRANT SELECT ON blog_sanitization_monitoring TO authenticated;

-- =====================================================
-- Rollback Instructions
-- =====================================================

-- To rollback this migration, run:
/*
-- Drop triggers
DROP TRIGGER IF EXISTS sanitize_blog_post_before_insert ON blog_posts;
DROP TRIGGER IF EXISTS sanitize_blog_post_before_update ON blog_posts;
DROP TRIGGER IF EXISTS sanitize_blog_comment_before_insert ON blog_comments;
DROP TRIGGER IF EXISTS sanitize_blog_comment_before_update ON blog_comments;
DROP TRIGGER IF EXISTS protect_blog_post_sanitized_content ON blog_posts;
DROP TRIGGER IF EXISTS protect_blog_comment_sanitized_content ON blog_comments;

-- Drop functions
DROP FUNCTION IF EXISTS sanitize_blog_post_content() CASCADE;
DROP FUNCTION IF EXISTS sanitize_blog_comment_content() CASCADE;
DROP FUNCTION IF EXISTS sanitize_html_content(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS sanitize_html_fallback(TEXT) CASCADE;
DROP FUNCTION IF EXISTS batch_sanitize_existing_content() CASCADE;
DROP FUNCTION IF EXISTS prevent_sanitized_content_modification() CASCADE;

-- Drop view
DROP VIEW IF EXISTS blog_sanitization_monitoring;

-- Note: The content_sanitized columns remain in the tables as they were created
-- in the original blog migration. Only the sanitization logic is removed.
*/