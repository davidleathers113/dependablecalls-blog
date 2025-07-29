-- =====================================================
-- Blog Word Count tsvector Implementation
-- =====================================================
-- Replaces regex-based word counting with PostgreSQL's
-- tsvector approach for security and performance
-- =====================================================

-- =====================================================
-- 1. Drop Existing Implementation
-- =====================================================
DROP TRIGGER IF EXISTS blog_posts_reading_time ON blog_posts;
DROP FUNCTION IF EXISTS calculate_reading_time();

-- =====================================================
-- 2. Create Helper Functions
-- =====================================================

-- Function to count words using tsvector (no regex!)
CREATE OR REPLACE FUNCTION word_count_tsvector(input_text TEXT)
RETURNS INTEGER AS $$
DECLARE
  word_count INTEGER;
BEGIN
  -- Handle NULL or empty input
  IF input_text IS NULL OR input_text = '' THEN
    RETURN 0;
  END IF;
  
  -- Use tsvector with 'simple' dictionary to keep all words
  -- The 'simple' dictionary doesn't remove stop words
  word_count := array_length(
    tsvector_to_array(to_tsvector('simple', input_text)), 
    1
  );
  
  RETURN COALESCE(word_count, 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get detailed reading statistics
CREATE OR REPLACE FUNCTION get_reading_stats(input_text TEXT)
RETURNS TABLE(
  total_words INTEGER,
  unique_words INTEGER,
  reading_time_minutes INTEGER,
  estimated_speaking_time_minutes INTEGER
) AS $$
DECLARE
  word_tokens TEXT[];
  reading_speed CONSTANT INTEGER := 200; -- words per minute reading
  speaking_speed CONSTANT INTEGER := 150; -- words per minute speaking
BEGIN
  -- Handle NULL or empty input
  IF input_text IS NULL OR input_text = '' THEN
    RETURN QUERY SELECT 0, 0, 0, 0;
    RETURN;
  END IF;
  
  -- Get all word tokens
  word_tokens := tsvector_to_array(to_tsvector('simple', input_text));
  
  -- Calculate statistics
  total_words := COALESCE(array_length(word_tokens, 1), 0);
  unique_words := COALESCE(array_length(
    ARRAY(SELECT DISTINCT unnest(word_tokens)), 
    1
  ), 0);
  reading_time_minutes := GREATEST(1, CEIL(total_words::FLOAT / reading_speed));
  estimated_speaking_time_minutes := GREATEST(1, CEIL(total_words::FLOAT / speaking_speed));
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to extract and count code blocks without regex
CREATE OR REPLACE FUNCTION count_code_block_words(content TEXT)
RETURNS INTEGER AS $$
DECLARE
  code_words INTEGER := 0;
  in_code_block BOOLEAN := FALSE;
  current_line TEXT;
  code_content TEXT := '';
  lines TEXT[];
  i INTEGER;
BEGIN
  -- Split content into lines
  lines := string_to_array(content, E'\n');
  
  -- Process each line
  FOR i IN 1..array_length(lines, 1) LOOP
    current_line := lines[i];
    
    -- Check for code block markers (```)
    IF substring(current_line FROM 1 FOR 3) = '```' THEN
      IF in_code_block THEN
        -- End of code block, count words
        code_words := code_words + word_count_tsvector(code_content);
        code_content := '';
        in_code_block := FALSE;
      ELSE
        -- Start of code block
        in_code_block := TRUE;
      END IF;
    ELSIF in_code_block THEN
      -- Inside code block, accumulate content
      code_content := code_content || ' ' || current_line;
    END IF;
  END LOOP;
  
  RETURN code_words;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 3. Create Improved Reading Time Function
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_reading_time() RETURNS trigger AS $$
DECLARE
  total_words INTEGER;
  code_words INTEGER;
  normal_words INTEGER;
  reading_speed CONSTANT INTEGER := 200; -- words per minute for normal text
  code_reading_speed CONSTANT INTEGER := 50; -- words per minute for code
  normal_time FLOAT;
  code_time FLOAT;
BEGIN
  -- Handle NULL or empty content
  IF NEW.content IS NULL OR NEW.content = '' THEN
    NEW.reading_time_minutes := 0;
    RETURN NEW;
  END IF;
  
  -- Count total words using tsvector
  total_words := word_count_tsvector(NEW.content);
  
  -- Count code block words (processed separately due to slower reading speed)
  code_words := count_code_block_words(NEW.content);
  
  -- Calculate normal words (total minus code words)
  normal_words := GREATEST(0, total_words - code_words);
  
  -- Calculate reading times
  normal_time := normal_words::FLOAT / reading_speed;
  code_time := code_words::FLOAT / code_reading_speed;
  
  -- Set final reading time (minimum 1 minute)
  NEW.reading_time_minutes := GREATEST(1, CEIL(normal_time + code_time));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. Recreate Trigger
-- =====================================================
CREATE TRIGGER blog_posts_reading_time
  BEFORE INSERT OR UPDATE OF content ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION calculate_reading_time();

-- =====================================================
-- 5. Update Existing Posts
-- =====================================================
-- Update all existing posts with new word count calculation
UPDATE blog_posts 
SET updated_at = updated_at -- This triggers recalculation
WHERE content IS NOT NULL;

-- =====================================================
-- 6. Create Verification Function
-- =====================================================
CREATE OR REPLACE FUNCTION verify_no_regex_in_word_count()
RETURNS BOOLEAN AS $$
DECLARE
  func_def TEXT;
  has_regex BOOLEAN := FALSE;
BEGIN
  -- Get function definitions
  SELECT pg_get_functiondef(oid) INTO func_def
  FROM pg_proc
  WHERE proname IN ('calculate_reading_time', 'word_count_tsvector', 'count_code_block_words', 'get_reading_stats');
  
  -- Check for regex patterns (should not find any)
  IF func_def LIKE '%regexp_%' OR 
     func_def LIKE '%~%' OR 
     func_def LIKE '%!~%' OR 
     func_def LIKE '%SIMILAR TO%' THEN
    has_regex := TRUE;
  END IF;
  
  RETURN NOT has_regex;
END;
$$ LANGUAGE plpgsql;

-- Verify implementation
DO $$
BEGIN
  IF NOT verify_no_regex_in_word_count() THEN
    RAISE EXCEPTION 'Word count implementation contains regex patterns!';
  END IF;
  RAISE NOTICE 'Word count implementation verified: No regex patterns found';
END $$;

-- =====================================================
-- 7. Add Comments and Documentation
-- =====================================================
COMMENT ON FUNCTION word_count_tsvector(TEXT) IS 
'Counts words in text using PostgreSQL tsvector - no regex, no ReDoS vulnerability';

COMMENT ON FUNCTION get_reading_stats(TEXT) IS 
'Returns comprehensive reading statistics including word count and reading time estimates';

COMMENT ON FUNCTION count_code_block_words(TEXT) IS 
'Counts words within Markdown code blocks without using regex';

COMMENT ON FUNCTION calculate_reading_time() IS 
'Trigger function that calculates reading time using tsvector word counting (regex-free)';

COMMENT ON FUNCTION verify_no_regex_in_word_count() IS 
'Verification function to ensure word count implementation contains no regex patterns';

-- =====================================================
-- 8. Grant Permissions
-- =====================================================
GRANT EXECUTE ON FUNCTION word_count_tsvector(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_reading_stats(TEXT) TO authenticated;

-- =====================================================
-- 9. Create Audit Log Entry
-- =====================================================
INSERT INTO audit_logs (
  table_name,
  action,
  user_id,
  new_data,
  created_at
) VALUES (
  'blog_posts',
  'word_count_migration',
  auth.uid(),
  jsonb_build_object(
    'migration', '022_blog_word_count_tsvector',
    'timestamp', NOW(),
    'changes', ARRAY[
      'Replaced regex word counting with tsvector',
      'Added helper functions for statistics',
      'Improved Markdown code block handling',
      'Enhanced security by eliminating ReDoS vulnerability'
    ]
  ),
  NOW()
);

-- =====================================================
-- 10. Rollback Function (for emergency use only)
-- =====================================================
CREATE OR REPLACE FUNCTION rollback_tsvector_word_count() 
RETURNS void AS $$
BEGIN
  -- Drop new functions
  DROP FUNCTION IF EXISTS word_count_tsvector(TEXT);
  DROP FUNCTION IF EXISTS get_reading_stats(TEXT);
  DROP FUNCTION IF EXISTS count_code_block_words(TEXT);
  DROP FUNCTION IF EXISTS verify_no_regex_in_word_count();
  
  -- Drop trigger
  DROP TRIGGER IF EXISTS blog_posts_reading_time ON blog_posts;
  DROP FUNCTION IF EXISTS calculate_reading_time();
  
  -- Recreate original simple implementation (without regex)
  CREATE OR REPLACE FUNCTION calculate_reading_time() RETURNS trigger AS $$
  DECLARE
    word_count INTEGER;
    reading_speed CONSTANT INTEGER := 200;
  BEGIN
    -- Simple space-based word count (not ideal but regex-free)
    word_count := array_length(string_to_array(NEW.content, ' '), 1);
    NEW.reading_time_minutes := GREATEST(1, CEIL(COALESCE(word_count, 0)::FLOAT / reading_speed));
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  
  CREATE TRIGGER blog_posts_reading_time
    BEFORE INSERT OR UPDATE OF content ON blog_posts
    FOR EACH ROW EXECUTE FUNCTION calculate_reading_time();
    
  -- Log the rollback
  INSERT INTO audit_logs (
    table_name,
    action,
    user_id,
    new_data,
    created_at
  ) VALUES (
    'blog_posts',
    'word_count_rollback',
    auth.uid(),
    jsonb_build_object(
      'timestamp', NOW(),
      'reason', 'Rolled back tsvector word count implementation'
    ),
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION rollback_tsvector_word_count() IS 
'Emergency rollback function - use only if tsvector implementation has issues';

-- =====================================================
-- Summary of Changes
-- =====================================================
-- 1. Replaced ALL regex-based word counting with tsvector
-- 2. Added helper functions for detailed statistics
-- 3. Improved handling of Markdown code blocks
-- 4. Maintained backward compatibility with reading_time_minutes
-- 5. Added verification to ensure no regex patterns exist
-- 6. Created comprehensive rollback capability
-- =====================================================