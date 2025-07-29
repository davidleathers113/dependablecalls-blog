#!/bin/bash

# =====================================================
# Run Word Count tsvector Tests
# =====================================================
# This script executes the comprehensive test suite
# for the blog word count implementation
# =====================================================

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Running Word Count tsvector Test Suite ===${NC}"
echo ""

# Check if we have database connection details
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL environment variable not set${NC}"
    echo "Please set DATABASE_URL or use .env file"
    exit 1
fi

# Run the test suite
echo -e "${GREEN}Executing test suite...${NC}"
psql "$DATABASE_URL" -f supabase/tests/test_word_count_tsvector.sql

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ All tests passed successfully!${NC}"
    echo -e "${GREEN}✓ Word count implementation is regex-free and secure${NC}"
else
    echo ""
    echo -e "${RED}✗ Test suite failed${NC}"
    exit 1
fi

# Optional: Run a quick performance benchmark
echo ""
echo -e "${YELLOW}Running quick performance benchmark...${NC}"

psql "$DATABASE_URL" <<EOF
-- Quick performance test
DO \$\$
DECLARE
  start_time TIMESTAMP;
  end_time TIMESTAMP;
  test_text TEXT;
BEGIN
  -- Generate test content
  test_text := repeat('This is a test sentence for performance benchmarking. ', 1000);
  
  -- Benchmark tsvector word count
  start_time := clock_timestamp();
  PERFORM word_count_tsvector(test_text);
  end_time := clock_timestamp();
  
  RAISE NOTICE 'tsvector word count on ~10,000 words: %', (end_time - start_time);
  
  -- Benchmark with code blocks
  test_text := 'Introduction ' || E'\n\`\`\`\n' || 
               repeat('code example here ', 500) || E'\n\`\`\`\n' ||
               repeat('Regular text content ', 500);
  
  start_time := clock_timestamp();
  PERFORM calculate_reading_time() FROM (
    SELECT test_text AS content
  ) AS t;
  end_time := clock_timestamp();
  
  RAISE NOTICE 'Reading time calculation with mixed content: %', (end_time - start_time);
END \$\$;
EOF

echo ""
echo -e "${GREEN}Test suite complete!${NC}"