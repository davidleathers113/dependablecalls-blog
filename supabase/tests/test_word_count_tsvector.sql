-- =====================================================
-- Test Suite: Blog Word Count tsvector Implementation
-- =====================================================
-- Tests the tsvector-based word counting functions
-- to ensure accuracy, performance, and security
-- =====================================================

-- Test helper function to compare results
CREATE OR REPLACE FUNCTION assert_equals(
  test_name TEXT,
  expected ANYELEMENT,
  actual ANYELEMENT
) RETURNS VOID AS $$
BEGIN
  IF expected IS DISTINCT FROM actual THEN
    RAISE EXCEPTION 'Test % failed: expected %, got %', test_name, expected, actual;
  ELSE
    RAISE NOTICE 'Test % passed', test_name;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Test helper function for performance comparison
CREATE OR REPLACE FUNCTION measure_performance(
  test_name TEXT,
  test_function TEXT,
  iterations INTEGER DEFAULT 1000
) RETURNS INTERVAL AS $$
DECLARE
  start_time TIMESTAMP;
  end_time TIMESTAMP;
BEGIN
  start_time := clock_timestamp();
  
  FOR i IN 1..iterations LOOP
    EXECUTE test_function;
  END LOOP;
  
  end_time := clock_timestamp();
  
  RAISE NOTICE 'Performance test % completed in %', test_name, (end_time - start_time);
  RETURN (end_time - start_time);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Test Suite Execution
-- =====================================================
DO $$
DECLARE
  result INTEGER;
  stats RECORD;
  test_content TEXT;
  code_words INTEGER;
  perf_time INTERVAL;
BEGIN
  RAISE NOTICE '=== Starting Word Count tsvector Test Suite ===';
  
  -- =====================================================
  -- 1. Basic Word Counting Tests
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '--- Basic Word Counting Tests ---';
  
  -- Test 1.1: Simple sentence
  PERFORM assert_equals(
    '1.1: Simple sentence',
    5::INTEGER,
    word_count_tsvector('Hello world this is test')
  );
  
  -- Test 1.2: Multiple spaces
  PERFORM assert_equals(
    '1.2: Multiple spaces',
    5::INTEGER,
    word_count_tsvector('Hello    world    this    is    test')
  );
  
  -- Test 1.3: Line breaks
  PERFORM assert_equals(
    '1.3: Line breaks',
    5::INTEGER,
    word_count_tsvector(E'Hello\nworld\nthis\nis\ntest')
  );
  
  -- Test 1.4: Tabs and mixed whitespace
  PERFORM assert_equals(
    '1.4: Tabs and mixed whitespace',
    5::INTEGER,
    word_count_tsvector(E'Hello\tworld\n\tthis\t\nis test')
  );
  
  -- Test 1.5: Punctuation
  PERFORM assert_equals(
    '1.5: Punctuation',
    6::INTEGER,
    word_count_tsvector('Hello, world! This is a test.')
  );
  
  -- Test 1.6: Numbers
  PERFORM assert_equals(
    '1.6: Numbers',
    7::INTEGER,
    word_count_tsvector('The year 2024 has 365 days total')
  );
  
  -- Test 1.7: Contractions
  PERFORM assert_equals(
    '1.7: Contractions',
    6::INTEGER,
    word_count_tsvector('It''s don''t can''t won''t shouldn''t I''m')
  );
  
  -- =====================================================
  -- 2. Edge Cases
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '--- Edge Case Tests ---';
  
  -- Test 2.1: NULL input
  PERFORM assert_equals(
    '2.1: NULL input',
    0::INTEGER,
    word_count_tsvector(NULL)
  );
  
  -- Test 2.2: Empty string
  PERFORM assert_equals(
    '2.2: Empty string',
    0::INTEGER,
    word_count_tsvector('')
  );
  
  -- Test 2.3: Only whitespace
  PERFORM assert_equals(
    '2.3: Only whitespace',
    0::INTEGER,
    word_count_tsvector('   ' || E'\t\n\r' || '  ')
  );
  
  -- Test 2.4: Single word
  PERFORM assert_equals(
    '2.4: Single word',
    1::INTEGER,
    word_count_tsvector('Hello')
  );
  
  -- Test 2.5: Special characters
  PERFORM assert_equals(
    '2.5: Special characters',
    3::INTEGER,
    word_count_tsvector('@#$% test !@#$ word $%^& count')
  );
  
  -- Test 2.6: URLs and emails
  PERFORM assert_equals(
    '2.6: URLs and emails',
    6::INTEGER,
    word_count_tsvector('Visit https://example.com or email test@example.com for info')
  );
  
  -- =====================================================
  -- 3. Unicode and International Text
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '--- Unicode and International Text Tests ---';
  
  -- Test 3.1: Emojis
  PERFORM assert_equals(
    '3.1: Emojis',
    7::INTEGER,
    word_count_tsvector('Hello 👋 world 🌍 this is test')
  );
  
  -- Test 3.2: Unicode characters
  PERFORM assert_equals(
    '3.2: Unicode characters',
    4::INTEGER,
    word_count_tsvector('Café résumé naïve façade')
  );
  
  -- Test 3.3: Mixed languages
  PERFORM assert_equals(
    '3.3: Mixed languages',
    6::INTEGER,
    word_count_tsvector('Hello 你好 Bonjour مرحبا Здравствуйте Hola')
  );
  
  -- Test 3.4: Japanese text
  PERFORM assert_equals(
    '3.4: Japanese text',
    5::INTEGER,
    word_count_tsvector('これは テスト です。 Hello world')
  );
  
  -- =====================================================
  -- 4. Markdown Content Tests
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '--- Markdown Content Tests ---';
  
  -- Test 4.1: Basic Markdown
  test_content := '# Heading One
  
This is a **bold** paragraph with *italic* text.

## Heading Two

- List item one
- List item two
- List item three

[Link text](https://example.com)';
  
  PERFORM assert_equals(
    '4.1: Basic Markdown',
    23::INTEGER,
    word_count_tsvector(test_content)
  );
  
  -- Test 4.2: Markdown with code inline
  test_content := 'This is text with `inline code` and more text';
  
  PERFORM assert_equals(
    '4.2: Markdown with inline code',
    9::INTEGER,
    word_count_tsvector(test_content)
  );
  
  -- Test 4.3: Complex Markdown
  test_content := '# Technical Blog Post

This post covers **important** concepts:

1. First concept with `code`
2. Second concept with [link](url)
3. Third concept with ***emphasis***

> Blockquote with some text

| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |';
  
  result := word_count_tsvector(test_content);
  RAISE NOTICE 'Test 4.3: Complex Markdown word count: %', result;
  
  -- =====================================================
  -- 5. Code Block Detection Tests
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '--- Code Block Detection Tests ---';
  
  -- Test 5.1: Simple code block
  test_content := 'Some text before

```
function hello() {
  return "world";
}
```

Some text after';
  
  code_words := count_code_block_words(test_content);
  RAISE NOTICE 'Test 5.1: Simple code block contains % words', code_words;
  PERFORM assert_equals(
    '5.1: Code block word count',
    4::INTEGER,
    code_words
  );
  
  -- Test 5.2: Multiple code blocks
  test_content := 'Introduction text

```javascript
const greeting = "Hello, World!";
console.log(greeting);
```

Middle text here

```python
def calculate_sum(a, b):
    return a + b
```

Conclusion text';
  
  code_words := count_code_block_words(test_content);
  RAISE NOTICE 'Test 5.2: Multiple code blocks contain % words', code_words;
  
  -- Test 5.3: Code block with language specifier
  test_content := 'Before code

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}
```

After code';
  
  code_words := count_code_block_words(test_content);
  RAISE NOTICE 'Test 5.3: TypeScript code block contains % words', code_words;
  
  -- Test 5.4: Nested backticks (edge case)
  test_content := 'Text before

```
This is a code block with ``` inside
Still in the code block
```

Text after';
  
  code_words := count_code_block_words(test_content);
  RAISE NOTICE 'Test 5.4: Code block with nested backticks contains % words', code_words;
  
  -- Test 5.5: Empty code block
  test_content := 'Text before

```
```

Text after';
  
  PERFORM assert_equals(
    '5.5: Empty code block',
    0::INTEGER,
    count_code_block_words(test_content)
  );
  
  -- =====================================================
  -- 6. Reading Statistics Tests
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '--- Reading Statistics Tests ---';
  
  -- Test 6.1: Basic statistics
  test_content := 'The quick brown fox jumps over the lazy dog. The quick brown fox jumps.';
  
  SELECT * INTO stats FROM get_reading_stats(test_content);
  
  RAISE NOTICE 'Test 6.1: Basic statistics - Total: %, Unique: %, Read time: %, Speak time: %',
    stats.total_words, stats.unique_words, stats.reading_time_minutes, stats.estimated_speaking_time_minutes;
  
  PERFORM assert_equals(
    '6.1a: Total words',
    14::INTEGER,
    stats.total_words
  );
  
  PERFORM assert_equals(
    '6.1b: Unique words',
    8::INTEGER,
    stats.unique_words
  );
  
  PERFORM assert_equals(
    '6.1c: Reading time',
    1::INTEGER,
    stats.reading_time_minutes
  );
  
  -- Test 6.2: Long content
  test_content := repeat('This is a test sentence with multiple words. ', 50);
  
  SELECT * INTO stats FROM get_reading_stats(test_content);
  
  RAISE NOTICE 'Test 6.2: Long content - Total: %, Read time: %',
    stats.total_words, stats.reading_time_minutes;
  
  -- Should be around 400 words (8 words * 50)
  PERFORM assert_equals(
    '6.2a: Long content word count',
    400::INTEGER,
    stats.total_words
  );
  
  -- At 200 wpm, should be 2 minutes
  PERFORM assert_equals(
    '6.2b: Long content reading time',
    2::INTEGER,
    stats.reading_time_minutes
  );
  
  -- Test 6.3: NULL/empty statistics
  SELECT * INTO stats FROM get_reading_stats(NULL);
  
  PERFORM assert_equals(
    '6.3: NULL input statistics',
    0::INTEGER,
    stats.total_words
  );
  
  -- =====================================================
  -- 7. Trigger Function Tests
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '--- Trigger Function Tests ---';
  
  -- Create temporary test table
  CREATE TEMP TABLE test_blog_posts AS 
  SELECT * FROM blog_posts WHERE FALSE;
  
  -- Add the trigger
  CREATE TRIGGER test_blog_posts_reading_time
    BEFORE INSERT OR UPDATE OF content ON test_blog_posts
    FOR EACH ROW EXECUTE FUNCTION calculate_reading_time();
  
  -- Test 7.1: Insert with normal content
  INSERT INTO test_blog_posts (id, title, slug, content, author_id)
  VALUES (
    gen_random_uuid(),
    'Test Post 1',
    'test-post-1',
    repeat('This is test content. ', 40), -- 80 words
    gen_random_uuid()
  );
  
  SELECT reading_time_minutes INTO result 
  FROM test_blog_posts 
  WHERE slug = 'test-post-1';
  
  PERFORM assert_equals(
    '7.1: Normal content reading time',
    1::INTEGER,
    result
  );
  
  -- Test 7.2: Insert with code blocks
  INSERT INTO test_blog_posts (id, title, slug, content, author_id)
  VALUES (
    gen_random_uuid(),
    'Test Post 2',
    'test-post-2',
    'Introduction text here. ' || E'\n\n```javascript\n' || 
    repeat('const code = "example"; ', 20) || E'\n```\n\n' ||
    'Conclusion text here.',
    gen_random_uuid()
  );
  
  SELECT reading_time_minutes INTO result 
  FROM test_blog_posts 
  WHERE slug = 'test-post-2';
  
  -- With code reading at 50 wpm vs 200 wpm, this should be higher
  RAISE NOTICE 'Test 7.2: Content with code blocks reading time: % minutes', result;
  
  -- Test 7.3: Update trigger
  UPDATE test_blog_posts 
  SET content = repeat('Updated content here. ', 100) -- 300 words
  WHERE slug = 'test-post-1';
  
  SELECT reading_time_minutes INTO result 
  FROM test_blog_posts 
  WHERE slug = 'test-post-1';
  
  PERFORM assert_equals(
    '7.3: Updated content reading time',
    2::INTEGER,
    result
  );
  
  -- Test 7.4: NULL content
  INSERT INTO test_blog_posts (id, title, slug, content, author_id)
  VALUES (
    gen_random_uuid(),
    'Test Post 3',
    'test-post-3',
    NULL,
    gen_random_uuid()
  );
  
  SELECT reading_time_minutes INTO result 
  FROM test_blog_posts 
  WHERE slug = 'test-post-3';
  
  PERFORM assert_equals(
    '7.4: NULL content reading time',
    0::INTEGER,
    result
  );
  
  -- Clean up
  DROP TABLE test_blog_posts;
  
  -- =====================================================
  -- 8. Security Verification Tests
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '--- Security Verification Tests ---';
  
  -- Test 8.1: Verify no regex in implementation
  PERFORM assert_equals(
    '8.1: No regex patterns in implementation',
    TRUE,
    verify_no_regex_in_word_count()
  );
  
  -- Test 8.2: Test potential ReDoS patterns (should handle gracefully)
  test_content := 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' || 
                  repeat('a', 1000) || 'b';
  
  -- This should complete quickly without hanging
  result := word_count_tsvector(test_content);
  RAISE NOTICE 'Test 8.2: Potential ReDoS pattern handled, word count: %', result;
  
  -- Test 8.3: Malicious input attempts
  test_content := E'\\x00\\x01\\x02' || 'test' || E'\\xFF\\xFE';
  result := word_count_tsvector(test_content);
  RAISE NOTICE 'Test 8.3: Binary data handled safely, word count: %', result;
  
  -- =====================================================
  -- 9. Performance Comparison Tests
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '--- Performance Comparison Tests ---';
  
  -- Test 9.1: Small text performance
  test_content := 'The quick brown fox jumps over the lazy dog.';
  
  perf_time := measure_performance(
    '9.1: Small text (1000 iterations)',
    format('SELECT word_count_tsvector(%L)', test_content),
    1000
  );
  
  -- Test 9.2: Medium text performance
  test_content := repeat('This is a medium length sentence for testing. ', 20);
  
  perf_time := measure_performance(
    '9.2: Medium text (1000 iterations)',
    format('SELECT word_count_tsvector(%L)', test_content),
    1000
  );
  
  -- Test 9.3: Large text performance
  test_content := repeat('This is a longer sentence used for performance testing of the word count function. ', 100);
  
  perf_time := measure_performance(
    '9.3: Large text (100 iterations)',
    format('SELECT word_count_tsvector(%L)', test_content),
    100
  );
  
  -- Test 9.4: Code block extraction performance
  test_content := 'Text before' || E'\n```\n' || 
                  repeat('code content here ', 50) || E'\n```\n' ||
                  'Text after';
  
  perf_time := measure_performance(
    '9.4: Code block extraction (1000 iterations)',
    format('SELECT count_code_block_words(%L)', test_content),
    1000
  );
  
  -- =====================================================
  -- 10. Real-World Content Tests
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '--- Real-World Content Tests ---';
  
  -- Test 10.1: Technical blog post
  test_content := '# Understanding PostgreSQL tsvector for Word Counting

In this comprehensive guide, we''ll explore how PostgreSQL''s built-in `tsvector` type provides a robust, secure alternative to regex-based word counting.

## Why tsvector?

Traditional regex approaches suffer from several issues:

1. **Performance**: Regex can be slow on large texts
2. **Security**: ReDoS vulnerabilities are a real threat
3. **Accuracy**: Complex patterns are error-prone

## Implementation Example

```sql
CREATE OR REPLACE FUNCTION word_count_tsvector(input_text TEXT)
RETURNS INTEGER AS $$
DECLARE
  word_count INTEGER;
BEGIN
  word_count := array_length(
    tsvector_to_array(to_tsvector(''simple'', input_text)), 
    1
  );
  RETURN COALESCE(word_count, 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

This function leverages PostgreSQL''s text search capabilities for accurate word counting.

## Performance Benefits

Our benchmarks show:
- 3x faster than regex on small texts
- 10x faster on large documents
- Consistent O(n) time complexity

## Conclusion

By using `tsvector`, we achieve better performance, enhanced security, and more reliable word counting.';
  
  result := word_count_tsvector(test_content);
  code_words := count_code_block_words(test_content);
  
  RAISE NOTICE 'Test 10.1: Technical blog - Total words: %, Code words: %', 
    result, code_words;
  
  -- Test 10.2: Marketing content
  test_content := '🚀 **Introducing Our Revolutionary Platform** 🚀

Are you tired of complex, unreliable solutions? We''ve got you covered!

### ✨ Key Features:

- ⚡ Lightning-fast performance
- 🔒 Bank-level security
- 📊 Real-time analytics
- 🌍 Global scalability
- 💡 Intuitive interface

### Why Choose Us?

Our cutting-edge technology delivers *unparalleled* results. Whether you''re a startup or enterprise, we provide:

> "The best solution we''ve ever used!" - Happy Customer

**Special Offer**: Sign up today and get 50% off your first month! 

Visit [our website](https://example.com) or email sales@example.com

#Innovation #Technology #BusinessGrowth';
  
  result := word_count_tsvector(test_content);
  RAISE NOTICE 'Test 10.2: Marketing content with emojis - Word count: %', result;
  
  -- =====================================================
  -- Summary
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '=== Test Suite Completed Successfully ===';
  RAISE NOTICE 'All tests passed without regex patterns detected';
  RAISE NOTICE 'tsvector implementation verified for production use';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Test Suite Failed: %', SQLERRM;
    RAISE;
END $$;

-- =====================================================
-- Cleanup test helper functions
-- =====================================================
DROP FUNCTION IF EXISTS assert_equals(TEXT, ANYELEMENT, ANYELEMENT);
DROP FUNCTION IF EXISTS measure_performance(TEXT, TEXT, INTEGER);

-- =====================================================
-- Additional Verification Queries
-- =====================================================

-- Verify function signatures
SELECT 
  proname AS function_name,
  pronargs AS arg_count,
  prorettype::regtype AS return_type,
  prosrc LIKE '%~%' OR prosrc LIKE '%regexp%' OR prosrc LIKE '%SIMILAR TO%' AS contains_regex
FROM pg_proc
WHERE proname IN (
  'word_count_tsvector',
  'get_reading_stats',
  'count_code_block_words',
  'calculate_reading_time',
  'verify_no_regex_in_word_count'
)
ORDER BY proname;

-- Sample usage examples for documentation
COMMENT ON FUNCTION word_count_tsvector(TEXT) IS 
'Usage: SELECT word_count_tsvector(''Your text content here'')';

COMMENT ON FUNCTION get_reading_stats(TEXT) IS 
'Usage: SELECT * FROM get_reading_stats(''Your blog post content'')';

COMMENT ON FUNCTION count_code_block_words(TEXT) IS 
'Usage: SELECT count_code_block_words(''Text with ```code blocks```'')';

-- =====================================================
-- End of Test Suite
-- =====================================================