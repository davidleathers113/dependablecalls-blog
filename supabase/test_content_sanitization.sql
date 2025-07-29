-- =====================================================
-- Content Sanitization Test Suite
-- =====================================================
-- This file tests the blog content sanitization system
-- Run after migration 019: psql $DATABASE_URL -f test_content_sanitization.sql
-- =====================================================

-- Enable expanded display for better readability
\x on

-- Test 1: Basic Markdown to HTML conversion
PRINT 'Test 1: Basic Markdown Conversion';
SELECT sanitize_html_content(
  E'# Hello World\n\nThis is a **bold** and *italic* test.',
  'markdown'
) as result;

-- Test 2: Script tag removal
PRINT 'Test 2: Script Tag Removal';
SELECT sanitize_html_content(
  '<script>alert("XSS")</script>Normal content here',
  'html'
) as result;

-- Test 3: Event handler removal
PRINT 'Test 3: Event Handler Removal';
SELECT sanitize_html_content(
  '<img src="test.jpg" onerror="alert(''XSS'')" alt="Test">',
  'html'
) as result;

-- Test 4: JavaScript protocol removal
PRINT 'Test 4: JavaScript Protocol Removal';
SELECT sanitize_html_content(
  '<a href="javascript:alert(''XSS'')">Click me</a>',
  'html'
) as result;

-- Test 5: Complex nested XSS attempts
PRINT 'Test 5: Complex XSS Patterns';
SELECT sanitize_html_content(
  E'<div><script>alert(1)</script><svg onload=alert(2)><iframe src="javascript:alert(3)"></div>',
  'html'
) as result;

-- Test 6: Markdown with embedded HTML attacks
PRINT 'Test 6: Markdown with XSS';
SELECT sanitize_html_content(
  E'# Title\n\n<script>alert("XSS")</script>\n\n[Link](javascript:alert("XSS"))',
  'markdown'
) as result;

-- Test 7: Fallback function test
PRINT 'Test 7: Fallback Sanitization';
SELECT sanitize_html_fallback('<script>alert("XSS")</script>Test & "quotes"') as result;

-- Test 8: Blog post insertion with XSS
PRINT 'Test 8: Blog Post with XSS Content';
DO $$
DECLARE
  test_post_id UUID := gen_random_uuid();
  inserted_post RECORD;
BEGIN
  -- Insert a post with XSS content
  INSERT INTO blog_posts (
    id, slug, title, content, author_id, status
  ) VALUES (
    test_post_id,
    'test-xss-post-' || extract(epoch from now())::text,
    'XSS Test Post',
    E'# Test Post\n\n<script>alert("XSS")</script>\n\nNormal content here.',
    (SELECT id FROM blog_authors LIMIT 1),
    'draft'
  );
  
  -- Retrieve and display the result
  SELECT id, title, 
         substring(content, 1, 50) as content_preview,
         substring(content_sanitized, 1, 100) as sanitized_preview
  INTO inserted_post
  FROM blog_posts 
  WHERE id = test_post_id;
  
  RAISE NOTICE 'Post created: % - Content: % - Sanitized: %', 
    inserted_post.title, 
    inserted_post.content_preview,
    inserted_post.sanitized_preview;
  
  -- Clean up
  DELETE FROM blog_posts WHERE id = test_post_id;
END $$;

-- Test 9: Blog comment insertion with XSS
PRINT 'Test 9: Blog Comment with XSS Content';
DO $$
DECLARE
  test_comment_id UUID := gen_random_uuid();
  test_post_id UUID;
  inserted_comment RECORD;
BEGIN
  -- Get a test post
  SELECT id INTO test_post_id FROM blog_posts WHERE status = 'published' LIMIT 1;
  
  IF test_post_id IS NULL THEN
    RAISE NOTICE 'No published posts found for comment test';
  ELSE
    -- Insert a comment with XSS content
    INSERT INTO blog_comments (
      id, post_id, user_id, content, status
    ) VALUES (
      test_comment_id,
      test_post_id,
      (SELECT id FROM users LIMIT 1),
      'Great post! <img src=x onerror=alert("XSS")> Check out <a href="javascript:void(0)">this</a>.',
      'pending'
    );
    
    -- Retrieve and display the result
    SELECT id, 
           substring(content, 1, 50) as content_preview,
           substring(content_sanitized, 1, 100) as sanitized_preview,
           status
    INTO inserted_comment
    FROM blog_comments 
    WHERE id = test_comment_id;
    
    RAISE NOTICE 'Comment created - Content: % - Sanitized: % - Status: %', 
      inserted_comment.content_preview,
      inserted_comment.sanitized_preview,
      inserted_comment.status;
    
    -- Clean up
    DELETE FROM blog_comments WHERE id = test_comment_id;
  END IF;
END $$;

-- Test 10: Monitoring view check
PRINT 'Test 10: Sanitization Monitoring';
SELECT * FROM blog_sanitization_monitoring;

-- Test 11: Performance test
PRINT 'Test 11: Sanitization Performance';
DO $$
DECLARE
  start_time TIMESTAMP;
  end_time TIMESTAMP;
  test_content TEXT;
  result JSONB;
BEGIN
  -- Create a large content sample
  test_content := E'# Large Content Test\n\n';
  FOR i IN 1..100 LOOP
    test_content := test_content || E'Paragraph ' || i || ' with **bold** and *italic* text.\n\n';
  END LOOP;
  
  start_time := clock_timestamp();
  result := sanitize_html_content(test_content, 'markdown');
  end_time := clock_timestamp();
  
  RAISE NOTICE 'Sanitization of % characters took %ms', 
    length(test_content), 
    extract(milliseconds from (end_time - start_time));
END $$;

-- Test 12: Verify protection against direct content_sanitized updates
PRINT 'Test 12: Direct Update Protection';
DO $$
DECLARE
  test_post_id UUID;
  original_sanitized TEXT;
  updated_sanitized TEXT;
BEGIN
  -- Get a test post
  SELECT id, content_sanitized 
  INTO test_post_id, original_sanitized 
  FROM blog_posts 
  WHERE content_sanitized IS NOT NULL 
  LIMIT 1;
  
  IF test_post_id IS NOT NULL THEN
    -- Try to directly update content_sanitized
    UPDATE blog_posts 
    SET content_sanitized = 'DIRECTLY MODIFIED CONTENT'
    WHERE id = test_post_id;
    
    -- Check if update was prevented
    SELECT content_sanitized INTO updated_sanitized
    FROM blog_posts WHERE id = test_post_id;
    
    IF original_sanitized = updated_sanitized THEN
      RAISE NOTICE 'SUCCESS: Direct update was prevented';
    ELSE
      RAISE WARNING 'FAILED: Direct update was not prevented';
    END IF;
  END IF;
END $$;

-- Test 13: Known XSS vectors
PRINT 'Test 13: OWASP XSS Vectors';
WITH xss_tests AS (
  SELECT unnest(ARRAY[
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<svg onload=alert(1)>',
    '<body onload=alert(1)>',
    '<iframe src="javascript:alert(1)">',
    '<input onfocus=alert(1) autofocus>',
    '<select onfocus=alert(1) autofocus>',
    '<textarea onfocus=alert(1) autofocus>',
    '<keygen onfocus=alert(1) autofocus>',
    '<video><source onerror="alert(1)">',
    '<audio src=x onerror=alert(1)>',
    '<marquee onstart=alert(1)>',
    '<meter onmouseover=alert(1)>0</meter>',
    '<details open ontoggle=alert(1)>',
    '<form><button formaction=javascript:alert(1)>',
    '<object data=javascript:alert(1)>',
    '<embed src=javascript:alert(1)>',
    '<a href="vbscript:msgbox(1)">test</a>',
    '<div style="background:url(javascript:alert(1))">',
    '<p style="font-family:''a'';color:expression(alert(1))">',
    '<<script>alert(1);//<</script>',
    '<scr<script>ipt>alert(1)</scr</script>ipt>',
    '<div id="1" onclick="alert(1)">test</div>',
    '<form action="javascript:alert(1)"><input type=submit>',
    '<isindex action=javascript:alert(1) type=submit value=click>',
    '<table background=javascript:alert(1)>',
    '<a href="jav&#09;ascript:alert(1)">test</a>',
    '<a href="jav&#x09;ascript:alert(1)">test</a>',
    '<a href="javascript&#58;alert(1)">test</a>',
    '<img src="x" alt="``onmouseover=alert(1)">',
    '<input type="image" src=x:alert(1) onerror=eval(src)>'
  ]) as xss_vector
)
SELECT 
  substring(xss_vector, 1, 50) as test_vector,
  (sanitize_html_content(xss_vector, 'html')->>'isClean')::boolean as is_clean,
  CASE 
    WHEN (sanitize_html_content(xss_vector, 'html')->>'sanitized') LIKE '%alert%' THEN 'FAIL'
    WHEN (sanitize_html_content(xss_vector, 'html')->>'sanitized') LIKE '%script%' THEN 'FAIL'
    WHEN (sanitize_html_content(xss_vector, 'html')->>'sanitized') LIKE '%javascript%' THEN 'FAIL'
    ELSE 'PASS'
  END as security_result
FROM xss_tests;

-- Summary report
PRINT 'Sanitization Test Summary';
SELECT 
  'Total Blog Posts' as metric,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE content_sanitized IS NOT NULL) as processed,
  COUNT(*) FILTER (WHERE content IS NOT NULL AND content_sanitized IS NULL) as unprocessed
FROM blog_posts
UNION ALL
SELECT 
  'Total Blog Comments' as metric,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE content_sanitized IS NOT NULL) as processed,
  COUNT(*) FILTER (WHERE content IS NOT NULL AND content_sanitized IS NULL) as unprocessed
FROM blog_comments;

-- Reset expanded display
\x off