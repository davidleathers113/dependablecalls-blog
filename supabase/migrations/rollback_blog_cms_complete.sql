-- =====================================================
-- Complete Blog CMS Rollback Script
-- =====================================================
-- This script completely removes all blog CMS components
-- Execute sections in order to avoid dependency issues
-- =====================================================

-- =====================================================
-- 1. Drop Storage Policies (if they exist)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
    -- Drop all blog-related storage policies
    DROP POLICY IF EXISTS "Authors can upload images within quota" ON storage.objects;
    DROP POLICY IF EXISTS "Authors can manage their own images" ON storage.objects;
    DROP POLICY IF EXISTS "Public can view blog images" ON storage.objects;
    DROP POLICY IF EXISTS "Admins can manage all blog images" ON storage.objects;
  END IF;
END $$;

-- =====================================================
-- 2. Drop Triggers
-- =====================================================
DROP TRIGGER IF EXISTS update_blog_authors_updated_at ON blog_authors;
DROP TRIGGER IF EXISTS update_blog_posts_updated_at ON blog_posts;
DROP TRIGGER IF EXISTS update_blog_categories_updated_at ON blog_categories;
DROP TRIGGER IF EXISTS update_blog_comments_updated_at ON blog_comments;
DROP TRIGGER IF EXISTS blog_posts_search_update ON blog_posts;
DROP TRIGGER IF EXISTS blog_posts_reading_time ON blog_posts;
DROP TRIGGER IF EXISTS blog_audit_content ON blog_posts;

-- =====================================================
-- 3. Drop Functions (in dependency order)
-- =====================================================
-- Drop maintenance functions first
DROP FUNCTION IF EXISTS analyze_blog_tables();
DROP FUNCTION IF EXISTS vacuum_blog_tables();
DROP FUNCTION IF EXISTS reindex_blog_search();
DROP FUNCTION IF EXISTS rollback_blog_infrastructure();

-- Drop helper functions
DROP FUNCTION IF EXISTS get_blog_statistics(UUID);
DROP FUNCTION IF EXISTS search_similar_posts(vector(1536), INT, FLOAT);
DROP FUNCTION IF EXISTS generate_blog_slug(TEXT);

-- Drop trigger functions
DROP FUNCTION IF EXISTS blog_audit_content_changes();
DROP FUNCTION IF EXISTS calculate_reading_time();
DROP FUNCTION IF EXISTS blog_posts_search_trigger();

-- =====================================================
-- 4. Drop Policies
-- =====================================================
-- Blog Comments Policies
DROP POLICY IF EXISTS "Approved comments are viewable by everyone" ON blog_comments;
DROP POLICY IF EXISTS "Users can view their own comments" ON blog_comments;
DROP POLICY IF EXISTS "Users can create comments" ON blog_comments;
DROP POLICY IF EXISTS "Users can update their own pending comments" ON blog_comments;
DROP POLICY IF EXISTS "Admins can manage all comments" ON blog_comments;

-- Junction Tables Policies
DROP POLICY IF EXISTS "Post tags viewable with post access" ON blog_post_tags;
DROP POLICY IF EXISTS "Authors can manage their post tags" ON blog_post_tags;
DROP POLICY IF EXISTS "Admins can manage all post tags" ON blog_post_tags;
DROP POLICY IF EXISTS "Post categories viewable with post access" ON blog_post_categories;
DROP POLICY IF EXISTS "Authors can manage their post categories" ON blog_post_categories;
DROP POLICY IF EXISTS "Admins can manage all post categories" ON blog_post_categories;

-- Categories and Tags Policies
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON blog_categories;
DROP POLICY IF EXISTS "Tags are viewable by everyone" ON blog_tags;
DROP POLICY IF EXISTS "Admins can manage categories" ON blog_categories;
DROP POLICY IF EXISTS "Admins can manage tags" ON blog_tags;

-- Blog Posts Policies
DROP POLICY IF EXISTS "Published posts are viewable by everyone" ON blog_posts;
DROP POLICY IF EXISTS "Authors can view their own posts" ON blog_posts;
DROP POLICY IF EXISTS "Authors can manage their own posts" ON blog_posts;
DROP POLICY IF EXISTS "Admins can manage all posts" ON blog_posts;

-- Blog Authors Policies
DROP POLICY IF EXISTS "Authors are viewable by everyone" ON blog_authors;
DROP POLICY IF EXISTS "Users can manage their own author profile" ON blog_authors;
DROP POLICY IF EXISTS "Admins can manage all author profiles" ON blog_authors;

-- =====================================================
-- 5. Revoke Permissions
-- =====================================================
REVOKE ALL PRIVILEGES ON blog_comments FROM authenticated;
REVOKE ALL PRIVILEGES ON blog_post_tags FROM authenticated;
REVOKE ALL PRIVILEGES ON blog_post_categories FROM authenticated;
REVOKE ALL PRIVILEGES ON blog_tags FROM authenticated;
REVOKE ALL PRIVILEGES ON blog_categories FROM authenticated;
REVOKE ALL PRIVILEGES ON blog_posts FROM authenticated;
REVOKE ALL PRIVILEGES ON blog_authors FROM authenticated;

-- =====================================================
-- 6. Drop Indexes
-- =====================================================
-- Comments Indexes
DROP INDEX IF EXISTS idx_blog_comments_status;
DROP INDEX IF EXISTS idx_blog_comments_parent;
DROP INDEX IF EXISTS idx_blog_comments_user;
DROP INDEX IF EXISTS idx_blog_comments_post;

-- Tags Indexes
DROP INDEX IF EXISTS idx_blog_tags_slug;

-- Categories Indexes
DROP INDEX IF EXISTS idx_blog_categories_parent;
DROP INDEX IF EXISTS idx_blog_categories_slug;

-- Posts Indexes
DROP INDEX IF EXISTS idx_blog_posts_status_embedding;
DROP INDEX IF EXISTS idx_blog_posts_embedding;
DROP INDEX IF EXISTS idx_blog_posts_title_trgm;
DROP INDEX IF EXISTS idx_blog_posts_search;
DROP INDEX IF EXISTS idx_blog_posts_author;
DROP INDEX IF EXISTS idx_blog_posts_status_published;
DROP INDEX IF EXISTS idx_blog_posts_slug;

-- Authors Indexes
DROP INDEX IF EXISTS idx_blog_authors_user;

-- =====================================================
-- 7. Drop Tables (in dependency order)
-- =====================================================
DROP TABLE IF EXISTS blog_comments CASCADE;
DROP TABLE IF EXISTS blog_post_tags CASCADE;
DROP TABLE IF EXISTS blog_post_categories CASCADE;
DROP TABLE IF EXISTS blog_tags CASCADE;
DROP TABLE IF EXISTS blog_categories CASCADE;
DROP TABLE IF EXISTS blog_posts CASCADE;
DROP TABLE IF EXISTS blog_authors CASCADE;

-- =====================================================
-- 8. Drop Storage Bucket (if exists)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'buckets') THEN
    DELETE FROM storage.buckets WHERE id = 'blog-images';
  END IF;
END $$;

-- =====================================================
-- 9. Clean up Audit Logs (optional)
-- =====================================================
-- Remove blog-related audit log entries
DELETE FROM audit_logs 
WHERE table_name IN (
  'blog_posts', 
  'blog_authors', 
  'blog_categories', 
  'blog_tags', 
  'blog_comments',
  'blog_tables',
  'blog_infrastructure'
);

-- =====================================================
-- 10. Drop Extensions (only if not used elsewhere)
-- =====================================================
-- WARNING: Only drop these if no other features use them
-- DROP EXTENSION IF EXISTS vector;
-- DROP EXTENSION IF EXISTS pg_trgm;
-- DROP EXTENSION IF EXISTS moddatetime;

-- =====================================================
-- Verification
-- =====================================================
-- Run these queries to verify complete removal:
/*
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'blog_%';

SELECT proname 
FROM pg_proc 
WHERE pronamespace = 'public'::regnamespace 
AND proname LIKE '%blog%';

SELECT indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE '%blog%';
*/

-- =====================================================
-- End of Rollback Script
-- =====================================================