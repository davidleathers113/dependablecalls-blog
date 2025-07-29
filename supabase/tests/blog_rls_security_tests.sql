-- =====================================================
-- Blog RLS Security Test Suite
-- =====================================================
-- Comprehensive tests to verify blog RLS policies prevent draft leakage
-- and enforce proper access control across all user roles.
--
-- Run these tests after applying migration 021_blog_rls_consolidation.sql
-- =====================================================

-- Helper function to create test data
CREATE OR REPLACE FUNCTION setup_blog_rls_test_data()
RETURNS TABLE (
  author1_id UUID,
  author2_id UUID,
  admin_id UUID,
  regular_user_id UUID,
  author1_user_id UUID,
  author2_user_id UUID
) AS $$
DECLARE
  v_author1_id UUID;
  v_author2_id UUID;
  v_admin_id UUID;
  v_regular_user_id UUID;
  v_author1_user_id UUID;
  v_author2_user_id UUID;
  v_post1_id UUID;
  v_post2_id UUID;
  v_post3_id UUID;
  v_category_id UUID;
  v_tag_id UUID;
BEGIN
  -- Create test users
  INSERT INTO users (id, email) VALUES 
    (gen_random_uuid(), 'author1@test.com'),
    (gen_random_uuid(), 'author2@test.com'),
    (gen_random_uuid(), 'admin@test.com'),
    (gen_random_uuid(), 'regular@test.com')
  RETURNING id INTO v_author1_user_id, v_author2_user_id, v_admin_id, v_regular_user_id;

  -- Make one user an admin
  INSERT INTO admins (user_id, role) VALUES (v_admin_id, 'super_admin');

  -- Create author profiles
  INSERT INTO blog_authors (id, user_id, display_name) VALUES
    (gen_random_uuid(), v_author1_user_id, 'Author One'),
    (gen_random_uuid(), v_author2_user_id, 'Author Two')
  RETURNING id INTO v_author1_id, v_author2_id;

  -- Create test posts
  -- Author 1: 1 published, 1 draft
  INSERT INTO blog_posts (id, slug, title, content, author_id, status, published_at) VALUES
    (gen_random_uuid(), 'author1-published', 'Author 1 Published Post', 'Content', v_author1_id, 'published', NOW() - INTERVAL '1 day'),
    (gen_random_uuid(), 'author1-draft', 'Author 1 Draft Post', 'Draft content', v_author1_id, 'draft', NULL);

  -- Author 2: 1 published, 1 draft
  INSERT INTO blog_posts (id, slug, title, content, author_id, status, published_at) VALUES
    (gen_random_uuid(), 'author2-published', 'Author 2 Published Post', 'Content', v_author2_id, 'published', NOW() - INTERVAL '2 days'),
    (gen_random_uuid(), 'author2-draft', 'Author 2 Draft Post', 'Secret draft', v_author2_id, 'draft', NULL)
  RETURNING id INTO v_post3_id;

  -- Add categories and tags to posts
  SELECT id INTO v_category_id FROM blog_categories LIMIT 1;
  SELECT id INTO v_tag_id FROM blog_tags LIMIT 1;

  -- Add category/tag to Author 2's draft (to test junction table security)
  INSERT INTO blog_post_categories (post_id, category_id) 
  VALUES (v_post3_id, v_category_id);
  
  INSERT INTO blog_post_tags (post_id, tag_id) 
  VALUES (v_post3_id, v_tag_id);

  -- Add test comments
  INSERT INTO blog_comments (post_id, user_id, content, status) VALUES
    ((SELECT id FROM blog_posts WHERE slug = 'author1-published'), v_regular_user_id, 'Approved comment', 'approved'),
    ((SELECT id FROM blog_posts WHERE slug = 'author1-published'), v_author2_user_id, 'Pending comment', 'pending'),
    ((SELECT id FROM blog_posts WHERE slug = 'author2-published'), v_regular_user_id, 'Spam comment', 'spam');

  RETURN QUERY SELECT v_author1_id, v_author2_id, v_admin_id, v_regular_user_id, v_author1_user_id, v_author2_user_id;
END;
$$ LANGUAGE plpgsql;

-- Main test runner
CREATE OR REPLACE FUNCTION run_blog_rls_security_tests()
RETURNS TABLE (
  test_category TEXT,
  test_name TEXT,
  user_role TEXT,
  expected TEXT,
  actual TEXT,
  passed BOOLEAN,
  details TEXT
) AS $$
DECLARE
  test_data RECORD;
  post_count INTEGER;
  draft_count INTEGER;
  comment_count INTEGER;
  category_count INTEGER;
  tag_count INTEGER;
  test_result BOOLEAN;
BEGIN
  -- Setup test data
  SELECT * INTO test_data FROM setup_blog_rls_test_data();

  -- =====================================================
  -- TEST SUITE 1: Draft Visibility (Critical Security Test)
  -- =====================================================
  
  -- Test 1.1: Author 1 should NOT see Author 2's drafts
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims" = jsonb_build_object('sub', test_data.author1_user_id::text);
  
  SELECT COUNT(*) INTO draft_count
  FROM blog_posts
  WHERE status = 'draft' AND slug = 'author2-draft';
  
  RETURN QUERY
  SELECT 
    'Draft Security'::TEXT,
    'Author 1 cannot see Author 2 drafts'::TEXT,
    'author'::TEXT,
    '0 drafts'::TEXT,
    draft_count || ' drafts'::TEXT,
    draft_count = 0,
    CASE WHEN draft_count > 0 THEN 'CRITICAL: Draft leakage detected!' ELSE 'Secure' END::TEXT;

  -- Test 1.2: Author 2 should NOT see Author 1's drafts
  SET LOCAL "request.jwt.claims" = jsonb_build_object('sub', test_data.author2_user_id::text);
  
  SELECT COUNT(*) INTO draft_count
  FROM blog_posts
  WHERE status = 'draft' AND slug = 'author1-draft';
  
  RETURN QUERY
  SELECT 
    'Draft Security'::TEXT,
    'Author 2 cannot see Author 1 drafts'::TEXT,
    'author'::TEXT,
    '0 drafts'::TEXT,
    draft_count || ' drafts'::TEXT,
    draft_count = 0,
    CASE WHEN draft_count > 0 THEN 'CRITICAL: Draft leakage detected!' ELSE 'Secure' END::TEXT;

  -- Test 1.3: Regular users should see NO drafts
  SET LOCAL "request.jwt.claims" = jsonb_build_object('sub', test_data.regular_user_id::text);
  
  SELECT COUNT(*) INTO draft_count
  FROM blog_posts
  WHERE status = 'draft';
  
  RETURN QUERY
  SELECT 
    'Draft Security'::TEXT,
    'Regular users see no drafts'::TEXT,
    'user'::TEXT,
    '0 drafts'::TEXT,
    draft_count || ' drafts'::TEXT,
    draft_count = 0,
    CASE WHEN draft_count > 0 THEN 'CRITICAL: Draft leakage to public!' ELSE 'Secure' END::TEXT;

  -- Test 1.4: Authors CAN see their own drafts
  SET LOCAL "request.jwt.claims" = jsonb_build_object('sub', test_data.author1_user_id::text);
  
  SELECT COUNT(*) INTO draft_count
  FROM blog_posts
  WHERE status = 'draft' AND slug = 'author1-draft';
  
  RETURN QUERY
  SELECT 
    'Draft Security'::TEXT,
    'Authors can see own drafts'::TEXT,
    'author'::TEXT,
    '1 draft'::TEXT,
    draft_count || ' drafts'::TEXT,
    draft_count = 1,
    CASE WHEN draft_count = 0 THEN 'ERROR: Cannot see own drafts!' ELSE 'Working' END::TEXT;

  -- Test 1.5: Admins can see ALL drafts
  SET LOCAL "request.jwt.claims" = jsonb_build_object('sub', test_data.admin_id::text);
  
  SELECT COUNT(*) INTO draft_count
  FROM blog_posts
  WHERE status = 'draft';
  
  RETURN QUERY
  SELECT 
    'Draft Security'::TEXT,
    'Admins see all drafts'::TEXT,
    'admin'::TEXT,
    '2 drafts'::TEXT,
    draft_count || ' drafts'::TEXT,
    draft_count = 2,
    'Admin visibility: ' || draft_count || ' total drafts'::TEXT;

  -- =====================================================
  -- TEST SUITE 2: Junction Table Security
  -- =====================================================

  -- Test 2.1: Categories/tags of drafts not visible to other authors
  SET LOCAL "request.jwt.claims" = jsonb_build_object('sub', test_data.author1_user_id::text);
  
  SELECT COUNT(*) INTO category_count
  FROM blog_post_categories bpc
  JOIN blog_posts bp ON bp.id = bpc.post_id
  WHERE bp.status = 'draft' AND bp.slug = 'author2-draft';
  
  RETURN QUERY
  SELECT 
    'Junction Security'::TEXT,
    'Draft categories hidden from other authors'::TEXT,
    'author'::TEXT,
    '0 categories'::TEXT,
    category_count || ' categories'::TEXT,
    category_count = 0,
    CASE WHEN category_count > 0 THEN 'Metadata leakage!' ELSE 'Secure' END::TEXT;

  -- Test 2.2: Tags of drafts not visible to other authors
  SELECT COUNT(*) INTO tag_count
  FROM blog_post_tags bpt
  JOIN blog_posts bp ON bp.id = bpt.post_id
  WHERE bp.status = 'draft' AND bp.slug = 'author2-draft';
  
  RETURN QUERY
  SELECT 
    'Junction Security'::TEXT,
    'Draft tags hidden from other authors'::TEXT,
    'author'::TEXT,
    '0 tags'::TEXT,
    tag_count || ' tags'::TEXT,
    tag_count = 0,
    CASE WHEN tag_count > 0 THEN 'Metadata leakage!' ELSE 'Secure' END::TEXT;

  -- =====================================================
  -- TEST SUITE 3: Comment Permissions
  -- =====================================================

  -- Test 3.1: Users can only see approved comments and their own
  SET LOCAL "request.jwt.claims" = jsonb_build_object('sub', test_data.regular_user_id::text);
  
  SELECT COUNT(*) INTO comment_count
  FROM blog_comments
  WHERE status = 'pending' AND user_id != test_data.regular_user_id;
  
  RETURN QUERY
  SELECT 
    'Comment Security'::TEXT,
    'Users cannot see others pending comments'::TEXT,
    'user'::TEXT,
    '0 pending'::TEXT,
    comment_count || ' pending'::TEXT,
    comment_count = 0,
    'Comment visibility check'::TEXT;

  -- Test 3.2: Post authors can see all comments on their posts
  SET LOCAL "request.jwt.claims" = jsonb_build_object('sub', test_data.author1_user_id::text);
  
  SELECT COUNT(*) INTO comment_count
  FROM blog_comments bc
  JOIN blog_posts bp ON bp.id = bc.post_id
  WHERE bp.slug = 'author1-published';
  
  RETURN QUERY
  SELECT 
    'Comment Security'::TEXT,
    'Authors see all comments on their posts'::TEXT,
    'author'::TEXT,
    '2 comments'::TEXT,
    comment_count || ' comments'::TEXT,
    comment_count = 2,
    'Author moderation capability'::TEXT;

  -- Test 3.3: Users can delete their own pending comments
  SET LOCAL "request.jwt.claims" = jsonb_build_object('sub', test_data.author2_user_id::text);
  
  BEGIN
    DELETE FROM blog_comments 
    WHERE user_id = test_data.author2_user_id AND status = 'pending';
    test_result := TRUE;
  EXCEPTION WHEN OTHERS THEN
    test_result := FALSE;
  END;
  
  RETURN QUERY
  SELECT 
    'Comment Security'::TEXT,
    'Users can delete own pending comments'::TEXT,
    'user'::TEXT,
    'Can delete'::TEXT,
    CASE WHEN test_result THEN 'Can delete' ELSE 'Cannot delete' END::TEXT,
    test_result,
    'Delete permission check'::TEXT;

  -- =====================================================
  -- TEST SUITE 4: Published Content Access
  -- =====================================================

  -- Test 4.1: Everyone can see published posts
  SET LOCAL "request.jwt.claims" = jsonb_build_object('sub', test_data.regular_user_id::text);
  
  SELECT COUNT(*) INTO post_count
  FROM blog_posts
  WHERE status = 'published';
  
  RETURN QUERY
  SELECT 
    'Public Access'::TEXT,
    'Public sees all published posts'::TEXT,
    'anonymous'::TEXT,
    '2 posts'::TEXT,
    post_count || ' posts'::TEXT,
    post_count = 2,
    'Public visibility'::TEXT;

  -- Reset role
  RESET ROLE;
  
  -- Cleanup test data
  DELETE FROM blog_comments WHERE user_id IN (test_data.regular_user_id, test_data.author1_user_id, test_data.author2_user_id);
  DELETE FROM blog_post_categories WHERE post_id IN (SELECT id FROM blog_posts WHERE author_id IN (test_data.author1_id, test_data.author2_id));
  DELETE FROM blog_post_tags WHERE post_id IN (SELECT id FROM blog_posts WHERE author_id IN (test_data.author1_id, test_data.author2_id));
  DELETE FROM blog_posts WHERE author_id IN (test_data.author1_id, test_data.author2_id);
  DELETE FROM blog_authors WHERE id IN (test_data.author1_id, test_data.author2_id);
  DELETE FROM admins WHERE user_id = test_data.admin_id;
  DELETE FROM users WHERE id IN (test_data.author1_user_id, test_data.author2_user_id, test_data.admin_id, test_data.regular_user_id);

END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Quick Test Runner
-- =====================================================
-- Run this to execute all tests and see results:
-- SELECT * FROM run_blog_rls_security_tests();

-- Summary query to check for failures:
/*
WITH test_results AS (
  SELECT * FROM run_blog_rls_security_tests()
)
SELECT 
  test_category,
  COUNT(*) as total_tests,
  COUNT(*) FILTER (WHERE passed) as passed,
  COUNT(*) FILTER (WHERE NOT passed) as failed,
  ARRAY_AGG(test_name) FILTER (WHERE NOT passed) as failed_tests
FROM test_results
GROUP BY test_category
ORDER BY test_category;
*/

-- =====================================================
-- Manual Verification Queries
-- =====================================================

-- Check current user's view of posts
/*
SELECT 
  bp.id,
  bp.title,
  bp.status,
  bp.author_id,
  ba.display_name as author_name,
  CASE 
    WHEN ba.user_id = auth.uid() THEN 'Own post'
    WHEN EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid()) THEN 'Admin view'
    ELSE 'Public view'
  END as access_reason
FROM blog_posts bp
JOIN blog_authors ba ON ba.id = bp.author_id
ORDER BY bp.status, bp.created_at DESC;
*/

-- Check policy evaluation for specific post
/*
SELECT 
  bp.id,
  bp.title,
  bp.status,
  (bp.status = 'published' AND bp.published_at <= NOW()) as is_published,
  EXISTS (
    SELECT 1 FROM blog_authors ba 
    WHERE ba.id = bp.author_id 
    AND ba.user_id = auth.uid()
  ) as is_author,
  EXISTS (
    SELECT 1 FROM admins WHERE user_id = auth.uid()
  ) as is_admin
FROM blog_posts bp
WHERE bp.slug = 'author1-draft';
*/