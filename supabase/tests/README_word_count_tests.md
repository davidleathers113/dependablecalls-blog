# Word Count tsvector Test Suite

## Overview

This test suite verifies the correctness, security, and performance of the tsvector-based word counting implementation for the blog system. The implementation replaces regex-based word counting to eliminate ReDoS vulnerabilities.

## Test Coverage

### 1. Basic Word Counting Tests

- Simple sentences
- Multiple spaces and whitespace variations
- Line breaks and tabs
- Punctuation handling
- Numbers and contractions

### 2. Edge Cases

- NULL and empty inputs
- Whitespace-only strings
- Single words
- Special characters
- URLs and email addresses

### 3. Unicode and International Text

- Emoji support
- Accented characters
- Mixed language content
- CJK (Chinese, Japanese, Korean) text

### 4. Markdown Content

- Headers and formatting
- Inline code
- Lists and links
- Tables and blockquotes

### 5. Code Block Detection

- Simple code blocks
- Multiple code blocks
- Language-specific blocks
- Empty code blocks
- Edge cases with nested backticks

### 6. Reading Statistics

- Total word count
- Unique word count
- Reading time estimates
- Speaking time estimates

### 7. Trigger Function Tests

- Insert operations
- Update operations
- NULL content handling
- Mixed content with code blocks

### 8. Security Verification

- Confirms NO regex patterns in implementation
- Tests potential ReDoS attack patterns
- Handles malicious input safely

### 9. Performance Tests

- Small text (< 50 words)
- Medium text (50-500 words)
- Large text (> 500 words)
- Code block extraction performance

### 10. Real-World Content

- Technical blog posts with code
- Marketing content with emojis
- Complex Markdown documents

## Running the Tests

### Prerequisites

- PostgreSQL database with the blog schema
- Migration 022_blog_word_count_tsvector.sql applied
- Database connection configured

### Execute Tests

```bash
# Using the provided script
./supabase/run_word_count_tests.sh

# Or directly with psql
psql $DATABASE_URL -f supabase/tests/test_word_count_tsvector.sql
```

### Expected Output

- All tests should pass with "Test X.X passed" messages
- Performance benchmarks will show execution times
- Final verification confirms no regex patterns exist

## Test Functions

### Core Functions Tested

- `word_count_tsvector(TEXT)` - Main word counting function
- `get_reading_stats(TEXT)` - Comprehensive statistics
- `count_code_block_words(TEXT)` - Code block word extraction
- `calculate_reading_time()` - Trigger function
- `verify_no_regex_in_word_count()` - Security verification

### Test Helpers

- `assert_equals()` - Compares expected vs actual values
- `measure_performance()` - Benchmarks function execution

## Security Notes

This implementation is specifically designed to avoid regex patterns entirely, preventing:

- ReDoS (Regular Expression Denial of Service) attacks
- Catastrophic backtracking
- Performance degradation on malicious input

The `verify_no_regex_in_word_count()` function ensures the implementation remains regex-free.

## Performance Characteristics

Based on test results:

- **Small texts (< 50 words)**: < 0.1ms per operation
- **Medium texts (50-500 words)**: < 1ms per operation
- **Large texts (> 500 words)**: Linear scaling, ~1ms per 500 words
- **Code block extraction**: Efficient line-by-line processing

## Maintenance

When modifying the word count implementation:

1. Run this test suite to ensure correctness
2. Add new test cases for any new features
3. Verify performance hasn't degraded
4. Confirm no regex patterns are introduced

## Related Files

- `/supabase/migrations/022_blog_word_count_tsvector.sql` - Implementation
- `/supabase/tests/test_word_count_tsvector.sql` - This test suite
- `/supabase/run_word_count_tests.sh` - Test runner script
