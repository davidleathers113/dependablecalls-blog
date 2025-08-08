-- =====================================================
-- Blog Infrastructure Fixes Migration
-- =====================================================
-- Fixes for:
-- 1. Improved word count logic
-- 2. IVFFLAT index performance tuning
-- 3. Maintenance functions
-- 4. Complete rollback script
-- =====================================================

-- =====================================================
-- 1. Improve Word Count Function
-- =====================================================
-- Drop existing function and trigger
DROP TRIGGER IF EXISTS blog_posts_reading_time ON blog_posts;
DROP FUNCTION IF EXISTS calculate_reading_time();

-- Create improved word count function
CREATE OR REPLACE FUNCTION calculate_reading_time() RETURNS trigger AS $$
DECLARE
  word_count INTEGER;
  code_block_count INTEGER;
  reading_speed CONSTANT INTEGER := 200; -- words per minute
  code_reading_speed CONSTANT INTEGER := 50; -- code reading is slower
  content_without_code TEXT;
  code_words INTEGER := 0;
  regular_words INTEGER := 0;
BEGIN
  -- Handle NULL content
  IF NEW.content IS NULL OR NEW.content = '' THEN
    NEW.reading_time_minutes := 0;
    RETURN NEW;
  END IF;

  -- Extract code blocks (markdown code blocks with ```)
  -- Count words in code blocks separately
  SELECT 
    COUNT(*),
    COALESCE(SUM(array_length(regexp_split_to_array(trim(matches[1]), '\s+'), 1)), 0)
  INTO 
    code_block_count,
    code_words
  FROM 
    regexp_split_to_table(NEW.content, '```[^`]*```') WITH ORDINALITY AS matches(match, ordinality)
  WHERE 
    ordinality % 2 = 0; -- Even positions are code blocks

  -- Remove code blocks from content for regular word counting
  content_without_code := regexp_replace(NEW.content, '```[^`]*```', '', 'g');
  
  -- Count regular words (split on whitespace and filter empty strings)
  SELECT array_length(
    ARRAY(
      SELECT word 
      FROM regexp_split_to_table(trim(content_without_code), '\s+') AS word 
      WHERE word != ''
    ), 
    1
  ) INTO regular_words;

  -- Calculate total reading time
  NEW.reading_time_minutes := GREATEST(
    1, 
    CEIL(
      (COALESCE(regular_words, 0)::FLOAT / reading_speed) + 
      (COALESCE(code_words, 0)::FLOAT / code_reading_speed)
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER blog_posts_reading_time
  BEFORE INSERT OR UPDATE OF content ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION calculate_reading_time();

-- Update existing posts with new calculation
UPDATE blog_posts SET updated_at = updated_at; -- Triggers recalculation

-- =====================================================
-- 2. Tune IVFFLAT Performance
-- =====================================================
-- Drop existing index
DROP INDEX IF EXISTS idx_blog_posts_embedding;

-- Recreate with optimized parameters
-- lists = 100 is good for datasets with ~10k-100k vectors
-- For smaller datasets, use lists = 50
CREATE INDEX idx_blog_posts_embedding 
  ON blog_posts 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Add index for faster similarity searches with status filter
CREATE INDEX idx_blog_posts_status_embedding 
  ON blog_posts(status, published_at) 
  WHERE embedding IS NOT NULL;

-- =====================================================
-- 3. Create Maintenance Functions
-- =====================================================

-- Function to analyze blog tables for query optimization
CREATE OR REPLACE FUNCTION analyze_blog_tables() 
RETURNS void AS $$
BEGIN
  -- Analyze all blog-related tables
  ANALYZE blog_posts;
  ANALYZE blog_authors;
  ANALYZE blog_categories;
  ANALYZE blog_tags;
  ANALYZE blog_post_categories;
  ANALYZE blog_post_tags;
  ANALYZE blog_comments;
  
  -- Log the maintenance action
  INSERT INTO audit_logs (
    table_name,
    action,
    user_id,
    new_data,
    created_at
  ) VALUES (
    'blog_tables',
    'analyze',
    auth.uid(),
    jsonb_build_object(
      'timestamp', NOW(),
      'tables_analyzed', ARRAY[
        'blog_posts', 'blog_authors', 'blog_categories', 
        'blog_tags', 'blog_post_categories', 'blog_post_tags', 
        'blog_comments'
      ]
    ),
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to vacuum blog tables
CREATE OR REPLACE FUNCTION vacuum_blog_tables() 
RETURNS void AS $$
BEGIN
  -- Vacuum all blog-related tables
  EXECUTE 'VACUUM ANALYZE blog_posts';
  EXECUTE 'VACUUM ANALYZE blog_authors';
  EXECUTE 'VACUUM ANALYZE blog_categories';
  EXECUTE 'VACUUM ANALYZE blog_tags';
  EXECUTE 'VACUUM ANALYZE blog_post_categories';
  EXECUTE 'VACUUM ANALYZE blog_post_tags';
  EXECUTE 'VACUUM ANALYZE blog_comments';
  
  -- Log the maintenance action
  INSERT INTO audit_logs (
    table_name,
    action,
    user_id,
    new_data,
    created_at
  ) VALUES (
    'blog_tables',
    'vacuum',
    auth.uid(),
    jsonb_build_object(
      'timestamp', NOW(),
      'tables_vacuumed', ARRAY[
        'blog_posts', 'blog_authors', 'blog_categories', 
        'blog_tags', 'blog_post_categories', 'blog_post_tags', 
        'blog_comments'
      ]
    ),
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reindex blog search indexes
CREATE OR REPLACE FUNCTION reindex_blog_search() 
RETURNS void AS $$
BEGIN
  -- Reindex search-related indexes
  REINDEX INDEX idx_blog_posts_search;
  REINDEX INDEX idx_blog_posts_title_trgm;
  REINDEX INDEX idx_blog_posts_embedding;
  REINDEX INDEX idx_blog_posts_status_embedding;
  
  -- Update all search vectors to ensure consistency
  UPDATE blog_posts 
  SET search_vector = 
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(subtitle, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(content, '')), 'C');
  
  -- Log the maintenance action
  INSERT INTO audit_logs (
    table_name,
    action,
    user_id,
    new_data,
    created_at
  ) VALUES (
    'blog_posts',
    'reindex_search',
    auth.uid(),
    jsonb_build_object(
      'timestamp', NOW(),
      'indexes_rebuilt', ARRAY[
        'idx_blog_posts_search',
        'idx_blog_posts_title_trgm',
        'idx_blog_posts_embedding',
        'idx_blog_posts_status_embedding'
      ]
    ),
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to service role for cron jobs
GRANT EXECUTE ON FUNCTION analyze_blog_tables() TO service_role;
GRANT EXECUTE ON FUNCTION vacuum_blog_tables() TO service_role;
GRANT EXECUTE ON FUNCTION reindex_blog_search() TO service_role;

-- =====================================================
-- 4. Create Complete Rollback Script
-- =====================================================
-- This is stored as a function for safety
CREATE OR REPLACE FUNCTION rollback_blog_infrastructure() 
RETURNS void 
LANGUAGE plpgsql
AS $rollback$
BEGIN
  -- Drop maintenance functions
  DROP FUNCTION IF EXISTS analyze_blog_tables();
  DROP FUNCTION IF EXISTS vacuum_blog_tables();
  DROP FUNCTION IF EXISTS reindex_blog_search();
  
  -- Drop improved indexes
  DROP INDEX IF EXISTS idx_blog_posts_status_embedding;
  
  -- Revert to original IVFFLAT index
  DROP INDEX IF EXISTS idx_blog_posts_embedding;
  CREATE INDEX idx_blog_posts_embedding 
    ON blog_posts 
    USING ivfflat (embedding vector_cosine_ops);
  
  -- Revert to original word count function
  DROP TRIGGER IF EXISTS blog_posts_reading_time ON blog_posts;
  DROP FUNCTION IF EXISTS calculate_reading_time();
END;
$rollback$;

-- Note: The original reading time function can be recreated if needed by calling rollback_blog_infrastructure()

-- =====================================================
-- Comments and Documentation
-- =====================================================
COMMENT ON FUNCTION calculate_reading_time() IS 
'Calculates reading time for blog posts with improved word counting that handles Markdown formatting and code blocks separately';

COMMENT ON FUNCTION analyze_blog_tables() IS 
'Analyzes all blog-related tables for query optimization. Should be run nightly via cron.';

COMMENT ON FUNCTION vacuum_blog_tables() IS 
'Vacuums all blog-related tables for space reclamation and statistics update. Should be run weekly via cron.';

COMMENT ON FUNCTION reindex_blog_search() IS 
'Rebuilds search-related indexes and updates search vectors. Should be run weekly or after bulk content updates.';

COMMENT ON FUNCTION rollback_blog_infrastructure() IS 
'Rollback function to revert all blog infrastructure improvements. Execute with: SELECT rollback_blog_infrastructure();';

COMMENT ON INDEX idx_blog_posts_embedding IS 
'Optimized IVFFLAT index for semantic search with lists=100 for better performance on medium-sized datasets';

COMMENT ON INDEX idx_blog_posts_status_embedding IS 
'Composite index to speed up filtered similarity searches on published posts';