-- Migration: Blog API Performance and Security Fixes
-- Description: Add functions for atomic view counter updates and optimized category/tag filtering
-- Date: 2025-07-29

-- 1. Function for atomic view count increment
CREATE OR REPLACE FUNCTION increment_blog_view_count(post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE blog_posts 
  SET view_count = COALESCE(view_count, 0) + 1,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_blog_view_count(UUID) TO authenticated;

-- 2. Function to get post IDs by category slug (optimized)
CREATE OR REPLACE FUNCTION get_posts_by_category_slug(category_slug TEXT)
RETURNS TABLE(post_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT bpc.post_id
  FROM blog_post_categories bpc
  INNER JOIN blog_categories bc ON bpc.category_id = bc.id
  WHERE bc.slug = category_slug
    AND bc.is_active = true;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission to anon and authenticated users
GRANT EXECUTE ON FUNCTION get_posts_by_category_slug(TEXT) TO anon, authenticated;

-- 3. Function to get post IDs by tag slug (optimized)
CREATE OR REPLACE FUNCTION get_posts_by_tag_slug(tag_slug TEXT)
RETURNS TABLE(post_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT bpt.post_id
  FROM blog_post_tags bpt
  INNER JOIN blog_tags bt ON bpt.tag_id = bt.id
  WHERE bt.slug = tag_slug;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission to anon and authenticated users
GRANT EXECUTE ON FUNCTION get_posts_by_tag_slug(TEXT) TO anon, authenticated;

-- 4. Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published_at 
ON blog_posts(status, published_at DESC) 
WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_blog_categories_slug_active 
ON blog_categories(slug) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_blog_tags_slug 
ON blog_tags(slug);

-- 5. Add composite indexes for join performance
CREATE INDEX IF NOT EXISTS idx_blog_post_categories_category_post 
ON blog_post_categories(category_id, post_id);

CREATE INDEX IF NOT EXISTS idx_blog_post_tags_tag_post 
ON blog_post_tags(tag_id, post_id);

-- 6. Function for safe text search with parameter binding
CREATE OR REPLACE FUNCTION search_blog_posts(
  search_query TEXT,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  slug TEXT,
  excerpt TEXT,
  published_at TIMESTAMPTZ,
  author_id UUID,
  view_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.title,
    p.slug,
    p.excerpt,
    p.published_at,
    p.author_id,
    p.view_count
  FROM blog_posts p
  WHERE p.status = 'published'
    AND p.published_at <= CURRENT_TIMESTAMP
    AND p.search_vector @@ plainto_tsquery('english', search_query)
  ORDER BY 
    ts_rank(p.search_vector, plainto_tsquery('english', search_query)) DESC,
    p.published_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION search_blog_posts(TEXT, INTEGER) TO anon, authenticated;

-- 7. Add comment explaining the security model
COMMENT ON FUNCTION increment_blog_view_count IS 'Atomically increments the view count for a blog post. Used by the blog API to prevent race conditions.';
COMMENT ON FUNCTION get_posts_by_category_slug IS 'Efficiently retrieves post IDs for a given category slug. Replaces multiple round-trips with a single query.';
COMMENT ON FUNCTION get_posts_by_tag_slug IS 'Efficiently retrieves post IDs for a given tag slug. Replaces multiple round-trips with a single query.';
COMMENT ON FUNCTION search_blog_posts IS 'Performs safe full-text search on blog posts using plainto_tsquery to prevent SQL injection.';