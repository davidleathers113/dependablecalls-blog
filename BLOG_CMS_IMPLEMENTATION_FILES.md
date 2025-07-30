# Blog CMS Implementation Files

Generated on: 2025-07-29 11:09:24

This document contains all the files created for the Supabase Blog CMS implementation.

---

# Database Files


## File: `supabase/migrations/018_blog_cms_tables.sql`

```sql
-- =====================================================
-- Blog CMS Tables Migration
-- =====================================================
-- This migration creates the complete blog CMS infrastructure
-- including tables, indexes, RLS policies, and triggers
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS moddatetime;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- Core Tables
-- =====================================================

-- Blog Authors Table
CREATE TABLE blog_authors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  social_links JSONB DEFAULT '{}',
  storage_quota_mb INTEGER DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blog Posts Table
CREATE TABLE blog_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  content TEXT NOT NULL, -- Raw markdown
  content_sanitized TEXT, -- Sanitized HTML (generated via trigger)
  excerpt TEXT, -- Short preview text
  featured_image_url TEXT,
  author_id UUID REFERENCES blog_authors(id) NOT NULL,
  status TEXT CHECK (status IN ('draft', 'published', 'archived')) DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}', -- SEO meta, custom fields
  view_count INTEGER DEFAULT 0,
  reading_time_minutes INTEGER,
  search_vector tsvector,
  embedding vector(1536), -- For semantic search
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blog Categories Table
CREATE TABLE blog_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES blog_categories(id),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blog Tags Table
CREATE TABLE blog_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction Tables
CREATE TABLE blog_post_categories (
  post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES blog_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, category_id)
);

CREATE TABLE blog_post_tags (
  post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES blog_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

-- Blog Comments Table (Phase 2 - optional)
CREATE TABLE blog_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  parent_id UUID REFERENCES blog_comments(id),
  content TEXT NOT NULL,
  content_sanitized TEXT,
  status TEXT CHECK (status IN ('pending', 'approved', 'spam', 'deleted')) DEFAULT 'pending',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Indexes
-- =====================================================

-- Blog Authors Indexes
CREATE INDEX idx_blog_authors_user ON blog_authors(user_id);

-- Blog Posts Indexes
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_status_published ON blog_posts(status, published_at DESC);
CREATE INDEX idx_blog_posts_author ON blog_posts(author_id);
CREATE INDEX idx_blog_posts_search ON blog_posts USING gin(search_vector);
CREATE INDEX idx_blog_posts_embedding ON blog_posts USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_blog_posts_title_trgm ON blog_posts USING gin(title gin_trgm_ops);

-- Blog Categories Indexes
CREATE INDEX idx_blog_categories_slug ON blog_categories(slug);
CREATE INDEX idx_blog_categories_parent ON blog_categories(parent_id);

-- Blog Tags Indexes
CREATE INDEX idx_blog_tags_slug ON blog_tags(slug);

-- Blog Comments Indexes
CREATE INDEX idx_blog_comments_post ON blog_comments(post_id);
CREATE INDEX idx_blog_comments_user ON blog_comments(user_id);
CREATE INDEX idx_blog_comments_parent ON blog_comments(parent_id);
CREATE INDEX idx_blog_comments_status ON blog_comments(status);

-- =====================================================
-- Enable Row Level Security
-- =====================================================

ALTER TABLE blog_authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_comments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS Policies
-- =====================================================

-- Blog Authors Policies
CREATE POLICY "Authors are viewable by everyone" 
  ON blog_authors FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their own author profile" 
  ON blog_authors FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all author profiles" 
  ON blog_authors FOR ALL
  USING (EXISTS (
    SELECT 1 FROM admins WHERE user_id = auth.uid()
  ));

-- Blog Posts Policies
CREATE POLICY "Published posts are viewable by everyone" 
  ON blog_posts FOR SELECT
  USING (status = 'published' AND published_at <= NOW());

CREATE POLICY "Authors can view their own posts" 
  ON blog_posts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM blog_authors ba 
    WHERE ba.id = blog_posts.author_id 
    AND ba.user_id = auth.uid()
  ));

CREATE POLICY "Authors can manage their own posts" 
  ON blog_posts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM blog_authors ba 
    WHERE ba.id = blog_posts.author_id 
    AND ba.user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage all posts" 
  ON blog_posts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM admins WHERE user_id = auth.uid()
  ));

-- Categories and Tags Policies
CREATE POLICY "Categories are viewable by everyone" 
  ON blog_categories FOR SELECT
  USING (true);

CREATE POLICY "Tags are viewable by everyone" 
  ON blog_tags FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage categories" 
  ON blog_categories FOR ALL
  USING (EXISTS (
    SELECT 1 FROM admins WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage tags" 
  ON blog_tags FOR ALL
  USING (EXISTS (
    SELECT 1 FROM admins WHERE user_id = auth.uid()
  ));

-- Junction Tables Policies
CREATE POLICY "Post categories viewable with post access"
  ON blog_post_categories FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM blog_posts bp
    WHERE bp.id = post_id
    AND (bp.status = 'published' OR EXISTS (
      SELECT 1 FROM blog_authors ba 
      WHERE ba.id = bp.author_id 
      AND ba.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM admins WHERE user_id = auth.uid()
    ))
  ));

CREATE POLICY "Authors can manage their post categories"
  ON blog_post_categories FOR ALL
  USING (EXISTS (
    SELECT 1 FROM blog_posts bp
    JOIN blog_authors ba ON ba.id = bp.author_id
    WHERE bp.id = post_id
    AND ba.user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage all post categories"
  ON blog_post_categories FOR ALL
  USING (EXISTS (
    SELECT 1 FROM admins WHERE user_id = auth.uid()
  ));

CREATE POLICY "Post tags viewable with post access"
  ON blog_post_tags FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM blog_posts bp
    WHERE bp.id = post_id
    AND (bp.status = 'published' OR EXISTS (
      SELECT 1 FROM blog_authors ba 
      WHERE ba.id = bp.author_id 
      AND ba.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM admins WHERE user_id = auth.uid()
    ))
  ));

CREATE POLICY "Authors can manage their post tags"
  ON blog_post_tags FOR ALL
  USING (EXISTS (
    SELECT 1 FROM blog_posts bp
    JOIN blog_authors ba ON ba.id = bp.author_id
    WHERE bp.id = post_id
    AND ba.user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage all post tags"
  ON blog_post_tags FOR ALL
  USING (EXISTS (
    SELECT 1 FROM admins WHERE user_id = auth.uid()
  ));

-- Comments Policies
CREATE POLICY "Approved comments are viewable by everyone"
  ON blog_comments FOR SELECT
  USING (status = 'approved');

CREATE POLICY "Users can view their own comments"
  ON blog_comments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create comments"
  ON blog_comments FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
    AND status = 'pending'
  );

CREATE POLICY "Users can update their own pending comments"
  ON blog_comments FOR UPDATE
  USING (
    user_id = auth.uid() 
    AND status = 'pending'
  );

CREATE POLICY "Admins can manage all comments"
  ON blog_comments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM admins WHERE user_id = auth.uid()
  ));

-- =====================================================
-- Storage Configuration
-- =====================================================

-- Create storage bucket for blog images (if storage extension is enabled)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('blog-images', 'blog-images', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Storage policies with quota enforcement (only create if storage schema exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
    -- Authors can upload images within quota
    EXECUTE 'CREATE POLICY "Authors can upload images within quota"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = ''blog-images'' AND
      auth.uid() IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM blog_authors ba
        WHERE ba.user_id = auth.uid()
      )
    )';

    -- Authors can manage their own images
    EXECUTE 'CREATE POLICY "Authors can manage their own images"
    ON storage.objects FOR ALL
    USING (
      bucket_id = ''blog-images'' AND
      owner = auth.uid()
    )';

    -- Public can view blog images
    EXECUTE 'CREATE POLICY "Public can view blog images"
    ON storage.objects FOR SELECT
    USING (bucket_id = ''blog-images'')';

    -- Admins can manage all blog images
    EXECUTE 'CREATE POLICY "Admins can manage all blog images"
    ON storage.objects FOR ALL
    USING (
      bucket_id = ''blog-images'' AND
      EXISTS (
        SELECT 1 FROM admins WHERE user_id = auth.uid()
      )
    )';
  END IF;
END $$;

-- =====================================================
-- Triggers
-- =====================================================

-- Auto-update timestamps
CREATE TRIGGER update_blog_authors_updated_at
  BEFORE UPDATE ON blog_authors
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

CREATE TRIGGER update_blog_categories_updated_at
  BEFORE UPDATE ON blog_categories
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

CREATE TRIGGER update_blog_comments_updated_at
  BEFORE UPDATE ON blog_comments
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

-- Full-text search vector trigger
CREATE OR REPLACE FUNCTION blog_posts_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.subtitle, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blog_posts_search_update 
  BEFORE INSERT OR UPDATE OF title, subtitle, content ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION blog_posts_search_trigger();

-- Reading time calculation trigger
CREATE OR REPLACE FUNCTION calculate_reading_time() RETURNS trigger AS $$
DECLARE
  word_count INTEGER;
  reading_speed CONSTANT INTEGER := 200; -- words per minute
BEGIN
  -- Simple word count estimation
  word_count := array_length(string_to_array(NEW.content, ' '), 1);
  NEW.reading_time_minutes := GREATEST(1, CEIL(word_count::FLOAT / reading_speed));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blog_posts_reading_time
  BEFORE INSERT OR UPDATE OF content ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION calculate_reading_time();

-- Audit content changes
CREATE OR REPLACE FUNCTION blog_audit_content_changes() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.content IS DISTINCT FROM NEW.content THEN
    INSERT INTO audit_logs (
      table_name,
      action,
      user_id,
      record_id,
      old_data,
      new_data,
      created_at
    ) VALUES (
      'blog_posts',
      'content_update',
      auth.uid(),
      NEW.id,
      jsonb_build_object(
        'content_length', length(OLD.content),
        'content_hash', encode(digest(OLD.content, 'sha256'), 'hex')
      ),
      jsonb_build_object(
        'content_length', length(NEW.content),
        'content_hash', encode(digest(NEW.content, 'sha256'), 'hex')
      ),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blog_audit_content
  AFTER UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION blog_audit_content_changes();

-- =====================================================
-- Helper Functions
-- =====================================================

-- Function to generate blog post slug
CREATE OR REPLACE FUNCTION generate_blog_slug(title TEXT) 
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Convert to lowercase and replace non-alphanumeric with hyphens
  base_slug := lower(title);
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  
  -- Check if slug exists
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM blog_posts WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Function to search similar posts using pgvector
CREATE OR REPLACE FUNCTION search_similar_posts(
  query_embedding vector(1536),
  match_count INT DEFAULT 5,
  threshold FLOAT DEFAULT 0.7
) RETURNS TABLE (
  id UUID,
  title TEXT,
  slug TEXT,
  excerpt TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bp.id,
    bp.title,
    bp.slug,
    bp.excerpt,
    1 - (bp.embedding <=> query_embedding) as similarity
  FROM blog_posts bp
  WHERE bp.status = 'published'
  AND bp.embedding IS NOT NULL
  AND 1 - (bp.embedding <=> query_embedding) >= threshold
  ORDER BY bp.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get post statistics
CREATE OR REPLACE FUNCTION get_blog_statistics(author_id_param UUID DEFAULT NULL)
RETURNS TABLE (
  total_posts BIGINT,
  published_posts BIGINT,
  draft_posts BIGINT,
  total_views BIGINT,
  total_comments BIGINT,
  avg_reading_time FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_posts,
    COUNT(*) FILTER (WHERE status = 'published')::BIGINT as published_posts,
    COUNT(*) FILTER (WHERE status = 'draft')::BIGINT as draft_posts,
    COALESCE(SUM(view_count), 0)::BIGINT as total_views,
    (SELECT COUNT(*) FROM blog_comments bc 
     JOIN blog_posts bp ON bc.post_id = bp.id 
     WHERE (author_id_param IS NULL OR bp.author_id = author_id_param)
     AND bc.status = 'approved')::BIGINT as total_comments,
    AVG(reading_time_minutes) as avg_reading_time
  FROM blog_posts
  WHERE author_id_param IS NULL OR author_id = author_id_param;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Initial Setup Data
-- =====================================================

-- Create default categories
INSERT INTO blog_categories (slug, name, description, display_order) VALUES
  ('announcements', 'Announcements', 'Platform updates and news', 1),
  ('tutorials', 'Tutorials', 'How-to guides and walkthroughs', 2),
  ('industry-insights', 'Industry Insights', 'Pay-per-call industry analysis', 3),
  ('case-studies', 'Case Studies', 'Success stories from our users', 4);

-- Create default tags  
INSERT INTO blog_tags (slug, name) VALUES
  ('getting-started', 'Getting Started'),
  ('best-practices', 'Best Practices'),
  ('updates', 'Updates'),
  ('tips-tricks', 'Tips & Tricks'),
  ('affiliate-marketing', 'Affiliate Marketing'),
  ('lead-generation', 'Lead Generation');

-- =====================================================
-- Grants
-- =====================================================

-- Grant necessary permissions to authenticated users
GRANT SELECT ON blog_posts TO authenticated;
GRANT SELECT ON blog_categories TO authenticated;
GRANT SELECT ON blog_tags TO authenticated;
GRANT SELECT ON blog_post_categories TO authenticated;
GRANT SELECT ON blog_post_tags TO authenticated;
GRANT SELECT ON blog_authors TO authenticated;
GRANT ALL ON blog_comments TO authenticated;

-- Grant permissions to service role for admin operations
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
```

---


## File: `supabase/migrations/README_blog_migration.md`

```markdown
# Blog CMS Migration Guide

## Overview

Migration `018_blog_cms_tables.sql` creates the complete blog CMS infrastructure for the DCE website, including:

- 7 core tables (posts, categories, tags, authors, comments, and junction tables)
- Comprehensive RLS policies with proper authentication
- Full-text search with PostgreSQL tsvector
- pgvector support for semantic search (1536-dimensional embeddings)
- Automated triggers for timestamps, search indexing, and audit logging
- Storage bucket configuration with quota enforcement

## Prerequisites

1. **Required Extensions** (automatically installed by migration):
   - `moddatetime` - For automatic timestamp updates
   - `pg_trgm` - For fuzzy text matching and search
   - `vector` - For semantic search with embeddings

2. **Existing Tables Required**:
   - `users` - For author authentication
   - `admins` - For admin access control
   - `audit_logs` - For content change tracking

## Testing Instructions

### 1. Apply Migration

```bash
# Local development
npx supabase migration up

# Or reset and reapply all migrations
npx supabase db reset

# Verify migration status
npx supabase migration list
```

### 2. Load Test Data

```bash
# Load blog seed data
psql "$DATABASE_URL" -f supabase/seed_blog.sql

# Or use Supabase CLI
npx supabase db push --include-seed
```

### 3. Verify Tables Created

```sql
-- Check all blog tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'blog_%'
ORDER BY table_name;

-- Expected output:
-- blog_authors
-- blog_categories
-- blog_comments
-- blog_post_categories
-- blog_post_tags
-- blog_posts
-- blog_tags
```

### 4. Test RLS Policies

```sql
-- Test as anonymous user (should only see published posts)
SET LOCAL role TO 'anon';
SELECT id, title, status FROM blog_posts;

-- Test as authenticated user who is an author
SET LOCAL role TO 'authenticated';
SET LOCAL request.jwt.claims.sub TO 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12';
SELECT id, title, status FROM blog_posts; -- Should see own drafts too

-- Test as admin
SET LOCAL request.jwt.claims.sub TO 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
SELECT id, title, status FROM blog_posts; -- Should see all posts

-- Reset role
RESET role;
```

### 5. Verify Indexes

```sql
-- List all blog-related indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename LIKE 'blog_%'
ORDER BY tablename, indexname;
```

### 6. Test Full-Text Search

```sql
-- Test search functionality
SELECT id, title, ts_rank(search_vector, query) as rank
FROM blog_posts, plainto_tsquery('english', 'pay per call') query
WHERE search_vector @@ query
ORDER BY rank DESC;

-- Test trigram search
SELECT id, title, similarity(title, 'fraud prevention') as sim
FROM blog_posts
WHERE title % 'fraud prevention'
ORDER BY sim DESC;
```

### 7. Test Storage Policies

```sql
-- Check storage bucket exists
SELECT * FROM storage.buckets WHERE id = 'blog-images';

-- Test quota calculation (as an author)
SET LOCAL role TO 'authenticated';
SET LOCAL request.jwt.claims.sub TO 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12';

-- This should work if under quota
INSERT INTO storage.objects (bucket_id, name, owner, metadata, path_tokens, size)
VALUES ('blog-images', 'test.jpg', current_setting('request.jwt.claims.sub')::uuid, '{}', '{test.jpg}', 1000000);
```

### 8. Test Triggers

```sql
-- Test automatic timestamp updates
UPDATE blog_posts 
SET title = 'Updated Title' 
WHERE slug = 'welcome-to-dependable-calls-blog';

-- Check updated_at changed
SELECT id, title, created_at, updated_at 
FROM blog_posts 
WHERE slug = 'welcome-to-dependable-calls-blog';

-- Test search vector update
UPDATE blog_posts 
SET content = 'New content for search testing' 
WHERE slug = 'draft-post-example';

-- Verify search vector updated
SELECT id, title, search_vector 
FROM blog_posts 
WHERE slug = 'draft-post-example';
```

### 9. Test Helper Functions

```sql
-- Test slug generation
SELECT generate_blog_slug('This is a Test Title!');
-- Expected: 'this-is-a-test-title'

-- Test duplicate slug handling
SELECT generate_blog_slug('Welcome to the Dependable Calls Blog');
-- Expected: 'welcome-to-the-dependable-calls-blog-1' (since original exists)

-- Test blog statistics
SELECT * FROM get_blog_statistics();
-- Should return aggregated stats for all posts

-- Test author-specific statistics
SELECT * FROM get_blog_statistics('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12');
```

## Rollback Instructions

If you need to rollback this migration:

```sql
-- Drop all blog tables (CASCADE removes dependent objects)
DROP TABLE IF EXISTS blog_comments CASCADE;
DROP TABLE IF EXISTS blog_post_tags CASCADE;
DROP TABLE IF EXISTS blog_post_categories CASCADE;
DROP TABLE IF EXISTS blog_tags CASCADE;
DROP TABLE IF EXISTS blog_categories CASCADE;
DROP TABLE IF EXISTS blog_posts CASCADE;
DROP TABLE IF EXISTS blog_authors CASCADE;

-- Remove storage bucket
DELETE FROM storage.buckets WHERE id = 'blog-images';

-- Remove storage policies
DROP POLICY IF EXISTS "Authors can upload images within quota" ON storage.objects;
DROP POLICY IF EXISTS "Authors can manage their own images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view blog images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all blog images" ON storage.objects;

-- Drop functions
DROP FUNCTION IF EXISTS blog_posts_search_trigger();
DROP FUNCTION IF EXISTS calculate_reading_time();
DROP FUNCTION IF EXISTS blog_audit_content_changes();
DROP FUNCTION IF EXISTS generate_blog_slug(TEXT);
DROP FUNCTION IF EXISTS search_similar_posts(vector(1536), INT, FLOAT);
DROP FUNCTION IF EXISTS get_blog_statistics(UUID);
```

## Common Issues & Solutions

### Issue: Migration fails with "extension does not exist"

**Solution**: Ensure your Supabase project has the required extensions enabled in the dashboard:
- Go to Database → Extensions
- Enable: `moddatetime`, `pg_trgm`, `vector`

### Issue: RLS policies blocking access

**Solution**: Check that:
1. User exists in `users` table
2. Author record exists in `blog_authors` 
3. For admins, record exists in `admins` table
4. JWT claims are properly set

### Issue: Storage upload fails

**Solution**: Verify:
1. Storage bucket exists
2. Author has quota available
3. File size is within limits
4. Proper authentication headers sent

## Next Steps

After successful migration:

1. Generate TypeScript types:
   ```bash
   npm run supabase:types
   ```

2. Create blog service layer:
   - See `src/services/blog.service.ts` (Phase 2)

3. Implement frontend components:
   - See implementation guide for component structure

## Performance Considerations

- The migration creates extensive indexes for optimal query performance
- Full-text search is pre-computed via triggers
- Consider adding materialized views for heavy queries
- Monitor `pg_stat_user_indexes` for index usage

## Security Notes

- All tables have RLS enabled by default
- Content sanitization should happen at application level
- Storage quotas prevent abuse
- Audit logging tracks all content changes
- Consider implementing rate limiting at API level
```

---


## File: `supabase/seed_blog.sql`

```sql
-- =====================================================
-- Blog CMS Seed Data for Development
-- =====================================================
-- This file contains sample data for testing the blog CMS
-- Run after the migration: psql $DATABASE_URL -f seed_blog.sql
-- =====================================================

-- Create test users if they don't exist
DO $$
DECLARE
  admin_user_id UUID;
  author1_id UUID;
  author2_id UUID;
  test_user_id UUID;
BEGIN
  -- Create admin user
  INSERT INTO users (id, email, name, role)
  VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'admin@dependablecalls.com', 'Admin User', 'admin')
  ON CONFLICT (id) DO NOTHING;
  
  admin_user_id := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  
  -- Create author users
  INSERT INTO users (id, email, name, role)
  VALUES 
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'john@dependablecalls.com', 'John Doe', 'supplier'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'jane@dependablecalls.com', 'Jane Smith', 'supplier'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'testuser@example.com', 'Test User', 'supplier')
  ON CONFLICT (id) DO NOTHING;
  
  author1_id := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12';
  author2_id := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13';
  test_user_id := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14';
  
  -- Create admin record
  INSERT INTO admins (user_id, created_at)
  VALUES (admin_user_id, NOW())
  ON CONFLICT (user_id) DO NOTHING;
END $$;

-- Create blog authors
INSERT INTO blog_authors (id, user_id, display_name, bio, avatar_url, social_links)
VALUES 
  (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Admin Team',
    'The Dependable Calls admin team manages platform updates and announcements.',
    'https://ui-avatars.com/api/?name=Admin+Team&background=3B82F6&color=fff',
    '{"twitter": "@dependablecalls", "linkedin": "dependablecalls"}'::jsonb
  ),
  (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    'John Doe',
    'John is a pay-per-call expert with over 10 years of experience in affiliate marketing.',
    'https://ui-avatars.com/api/?name=John+Doe&background=10B981&color=fff',
    '{"twitter": "@johndoe", "linkedin": "john-doe"}'::jsonb
  ),
  (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
    'Jane Smith',
    'Jane specializes in lead generation strategies and conversion optimization.',
    'https://ui-avatars.com/api/?name=Jane+Smith&background=F59E0B&color=fff',
    '{"twitter": "@janesmith", "linkedin": "jane-smith"}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- Create sample blog posts
INSERT INTO blog_posts (
  id, slug, title, subtitle, content, excerpt, featured_image_url,
  author_id, status, published_at, metadata, view_count, reading_time_minutes
)
VALUES 
  (
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'welcome-to-dependable-calls-blog',
    'Welcome to the Dependable Calls Blog',
    'Your source for pay-per-call insights and platform updates',
    E'# Welcome to Dependable Calls\n\nWe''re excited to launch our new blog where we''ll share:\n\n## Platform Updates\nStay informed about new features, improvements, and system updates.\n\n## Industry Insights\nLearn from our analysis of pay-per-call trends and best practices.\n\n## Success Stories\nDiscover how our users are achieving success with Dependable Calls.\n\n## Tutorials & Guides\nStep-by-step instructions to help you maximize your results.\n\n### What is Pay-Per-Call?\n\nPay-per-call is a performance marketing model where advertisers pay for qualified phone calls generated by publishers. It''s particularly effective for industries where customers prefer phone conversations:\n\n- **Home Services**: Plumbing, HVAC, roofing\n- **Legal Services**: Personal injury, bankruptcy, criminal defense\n- **Insurance**: Auto, home, life insurance quotes\n- **Healthcare**: Dental, medical procedures, rehabilitation\n\n### Why Dependable Calls?\n\nOur platform provides:\n\n1. **Real-time Tracking**: Monitor your calls as they happen\n2. **Advanced Fraud Detection**: Protect your campaigns from invalid traffic\n3. **Flexible Routing**: Send calls to the right buyers at the right time\n4. **Detailed Analytics**: Make data-driven decisions\n5. **Reliable Payments**: Get paid on time, every time\n\n### Getting Started\n\nReady to start? Here''s how:\n\n1. Sign up for an account\n2. Set up your first campaign\n3. Configure call tracking numbers\n4. Start receiving calls\n5. Track performance in real-time\n\nWe''re here to help you succeed. Check back regularly for new content!',
    'Welcome to the Dependable Calls blog - your source for pay-per-call insights, platform updates, and success stories.',
    'https://images.unsplash.com/photo-1522542550221-31fd19575a2d?w=1600&h=900&fit=crop',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'published',
    NOW() - INTERVAL '7 days',
    '{"seo_title": "Welcome to Dependable Calls Blog | Pay-Per-Call Platform", "seo_description": "Discover pay-per-call insights, platform updates, and success stories on the Dependable Calls blog."}'::jsonb,
    156,
    3
  ),
  (
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    'top-5-pay-per-call-verticals-2024',
    'Top 5 Pay-Per-Call Verticals for 2024',
    'Discover the most profitable industries for pay-per-call marketing',
    E'# Top 5 Pay-Per-Call Verticals for 2024\n\nAs we move through 2024, certain industries continue to dominate the pay-per-call landscape. Here are the top 5 verticals showing exceptional performance:\n\n## 1. Home Services\n\n**Average Payout: $35-$125 per call**\n\nHome services remain the backbone of pay-per-call:\n\n- **HVAC**: Peak seasons drive high demand\n- **Plumbing**: Emergency calls command premium rates\n- **Roofing**: Storm season creates surge opportunities\n- **Pest Control**: Recurring revenue potential\n\n### Key Success Factors:\n- Local SEO optimization\n- Seasonal campaign adjustments\n- 24/7 call availability\n\n## 2. Legal Services\n\n**Average Payout: $75-$500 per call**\n\nLegal verticals offer some of the highest payouts:\n\n- **Personal Injury**: Motor vehicle accidents, slip & fall\n- **Mass Tort**: Camp Lejeune, talcum powder, roundup\n- **Criminal Defense**: DUI, domestic violence\n- **Bankruptcy**: Chapter 7 and Chapter 13 filings\n\n### Compliance Requirements:\n- TCPA compliance mandatory\n- State bar advertising rules\n- Clear disclaimers required\n\n## 3. Insurance\n\n**Average Payout: $15-$75 per call**\n\nInsurance remains stable with consistent demand:\n\n- **Auto Insurance**: High volume, moderate payouts\n- **Health Insurance**: ACA enrollment periods\n- **Life Insurance**: Final expense popular with seniors\n- **Medicare**: Advantage plans and supplements\n\n## 4. Financial Services\n\n**Average Payout: $25-$150 per call**\n\nGrowing sector with diverse opportunities:\n\n- **Tax Relief**: IRS debt resolution\n- **Debt Consolidation**: Credit card and personal loans\n- **Business Funding**: MCA and equipment financing\n- **Credit Repair**: Score improvement services\n\n## 5. Healthcare & Wellness\n\n**Average Payout: $20-$200 per call**\n\nExpanding vertical with aging population:\n\n- **Dental**: Implants and cosmetic procedures\n- **Vision**: LASIK and cataract surgery\n- **Hearing**: Hearing aids and testing\n- **Addiction Treatment**: Rehab and recovery centers\n\n## Optimization Tips for All Verticals\n\n### 1. Quality Over Quantity\nFocus on generating qualified calls rather than volume. Pre-qualification saves everyone time.\n\n### 2. Geographic Targeting\nSome verticals perform better in specific regions. Use geo-targeting to maximize conversions.\n\n### 3. Time-of-Day Optimization\nDifferent verticals have different peak hours. Adjust your campaigns accordingly.\n\n### 4. Compliance First\nStay updated on regulations. Non-compliance can shut down campaigns instantly.\n\n## Looking Ahead\n\nThe pay-per-call industry continues to evolve. Success requires:\n\n- Staying informed about industry trends\n- Testing new traffic sources\n- Building strong buyer relationships\n- Maintaining compliance standards\n\nWhich vertical are you focusing on? Let us know in the comments!',
    'Explore the most profitable pay-per-call verticals for 2024, including home services, legal, insurance, and more.',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1600&h=900&fit=crop',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    'published',
    NOW() - INTERVAL '3 days',
    '{"seo_title": "Top 5 Pay-Per-Call Verticals 2024 | High-Paying Industries", "seo_description": "Discover the most profitable pay-per-call verticals for 2024. Learn average payouts and optimization strategies for each industry."}'::jsonb,
    342,
    5
  ),
  (
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
    'fraud-prevention-best-practices',
    'Fraud Prevention Best Practices for Pay-Per-Call',
    'Protect your campaigns from invalid traffic and fraudulent calls',
    E'# Fraud Prevention Best Practices for Pay-Per-Call\n\nFraud prevention is crucial for maintaining profitable pay-per-call campaigns. Here''s how to protect your business:\n\n## Common Types of Pay-Per-Call Fraud\n\n### 1. Repeat Callers\nThe same person calling multiple times to generate commissions.\n\n**Detection Methods:**\n- ANI (Automatic Number Identification) tracking\n- Voice fingerprinting technology\n- Call pattern analysis\n\n### 2. Call Centers\nOrganized operations making bulk calls with scripts.\n\n**Red Flags:**\n- High call volume from single location\n- Similar call durations\n- Background noise patterns\n\n### 3. Incentivized Traffic\nPaying users to make calls regardless of intent.\n\n**Warning Signs:**\n- Unusually high conversion rates\n- Short call durations\n- No follow-through on appointments\n\n## Prevention Strategies\n\n### Real-Time Monitoring\n\nImplement these monitoring practices:\n\n1. **Live Call Listening**\n   - Random quality checks\n   - Flagged number monitoring\n   - Suspicious pattern alerts\n\n2. **Analytics Dashboard**\n   - Geographic heat maps\n   - Conversion funnel analysis\n   - Publisher performance metrics\n\n### Technology Solutions\n\n```javascript\n// Example fraud detection logic\nconst fraudIndicators = {\n  repeatCaller: checkANIHistory(callerNumber),\n  shortDuration: callDuration < minimumThreshold,\n  suspiciousPattern: analyzeCallPattern(publisherId),\n  geoMismatch: !validateGeolocation(callerIP, callerANI)\n};\n\nif (Object.values(fraudIndicators).some(indicator => indicator)) {\n  flagForReview(callId);\n}\n```\n\n### Publisher Vetting\n\n**Initial Screening:**\n- Business verification\n- Traffic source disclosure\n- Reference checks\n- Test period requirements\n\n**Ongoing Monitoring:**\n- Quality scores\n- Conversion tracking\n- Customer feedback\n- Mystery shopping\n\n## Building a Fraud Prevention Framework\n\n### 1. Set Clear Guidelines\n\nDocument and communicate:\n- Acceptable traffic sources\n- Prohibited practices\n- Quality standards\n- Penalty structure\n\n### 2. Use Technology Wisely\n\nLeverage tools for:\n- Call recording and transcription\n- AI-powered anomaly detection\n- Behavioral analysis\n- Cross-reference databases\n\n### 3. Create Feedback Loops\n\nEstablish processes for:\n- Buyer complaint handling\n- Publisher dispute resolution\n- Continuous improvement\n- Industry intelligence sharing\n\n## Case Study: Reducing Fraud by 87%\n\nOne of our enterprise clients implemented our fraud prevention framework:\n\n**Before:**\n- 23% invalid call rate\n- $45,000 monthly fraud losses\n- 15% buyer churn\n\n**After:**\n- 3% invalid call rate\n- $6,000 monthly fraud losses\n- 2% buyer churn\n\n**Key Actions:**\n1. Implemented real-time ANI checking\n2. Required publisher phone verification\n3. Set minimum call duration requirements\n4. Created fraud score algorithm\n\n## Best Practices Checklist\n\n✅ Real-time call monitoring\n✅ Multi-layer verification\n✅ Publisher vetting process\n✅ Clear terms of service\n✅ Regular audits\n✅ Buyer feedback integration\n✅ Technology stack updates\n✅ Team training programs\n\n## Moving Forward\n\nFraud prevention is an ongoing process. Stay vigilant, adapt to new threats, and maintain open communication with your partners.\n\nRemember: It''s better to reject suspicious traffic than to risk your buyer relationships.\n\nQuestions about fraud prevention? Contact our support team for personalized guidance.',
    'Learn essential fraud prevention strategies for pay-per-call campaigns, including detection methods and technology solutions.',
    'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1600&h=900&fit=crop',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
    'published',
    NOW() - INTERVAL '1 day',
    '{"seo_title": "Pay-Per-Call Fraud Prevention Guide | Best Practices 2024", "seo_description": "Protect your pay-per-call campaigns from fraud. Learn detection methods, prevention strategies, and technology solutions."}'::jsonb,
    289,
    7
  ),
  (
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14',
    'setting-up-your-first-campaign',
    'Setting Up Your First Pay-Per-Call Campaign',
    'A step-by-step guide for beginners',
    E'# Setting Up Your First Pay-Per-Call Campaign\n\nStarting your first pay-per-call campaign can seem daunting. This guide will walk you through each step:\n\n## Step 1: Choose Your Vertical\n\nSelect an industry based on:\n- Your existing knowledge\n- Market demand\n- Payout potential\n- Competition level\n\n**Beginner-Friendly Verticals:**\n- Home services (HVAC, plumbing)\n- Auto insurance\n- Tax relief\n\n## Step 2: Find Buyers\n\nBefore generating calls, secure buyers:\n\n### Direct Advertisers\n- Higher payouts\n- Stable relationships\n- Specific requirements\n\n### Networks/Aggregators\n- Easier approval\n- Multiple options\n- Lower payouts\n\n## Step 3: Set Up Tracking\n\n### Phone Numbers\n- Use local or toll-free numbers\n- Dynamic number insertion (DNI)\n- Call recording capabilities\n\n### Analytics Platform\n- Real-time reporting\n- Conversion tracking\n- ROI calculation\n\n## Step 4: Create Your Campaign\n\n### Target Audience\nDefine your ideal caller:\n- Demographics\n- Geographic location\n- Intent signals\n- Pain points\n\n### Traffic Sources\n\n**Paid Search (Google Ads)**\n```\nPros: High intent, scalable\nCons: Expensive, competitive\nBudget: $50-100/day minimum\n```\n\n**SEO/Content Marketing**\n```\nPros: Free traffic, authority building\nCons: Time-intensive, slow results\nTimeline: 3-6 months\n```\n\n**Social Media**\n```\nPros: Targeting options, creative freedom\nCons: Lower intent, compliance issues\nPlatforms: Facebook, TikTok, Instagram\n```\n\n## Step 5: Optimize Your Funnel\n\n### Landing Page Elements\n\n1. **Headline**: Clear value proposition\n2. **Call-to-Action**: Prominent phone number\n3. **Trust Signals**: Reviews, badges, testimonials\n4. **Urgency**: Limited time offers\n5. **Mobile Optimization**: Click-to-call functionality\n\n### A/B Testing Ideas\n- Headlines and subheadings\n- Button colors and text\n- Form fields vs. direct call\n- Images and videos\n- Trust elements placement\n\n## Step 6: Launch and Monitor\n\n### Soft Launch Strategy\n\n**Week 1**: \n- Start with $50/day budget\n- Monitor every call\n- Note quality issues\n\n**Week 2**:\n- Optimize based on data\n- Increase budget if profitable\n- Test new ad copies\n\n**Week 3**:\n- Scale winning campaigns\n- Pause underperformers\n- Negotiate better payouts\n\n### Key Metrics to Track\n\n| Metric | Target | Importance |\n|--------|--------|------------|\n| Cost Per Call | < 50% of payout | Critical |\n| Conversion Rate | > 60% | High |\n| Average Call Duration | > 90 seconds | High |\n| ROI | > 30% | Critical |\n\n## Common Mistakes to Avoid\n\n### 1. Skipping Testing\nAlways start small and test before scaling.\n\n### 2. Ignoring Quality\nBad calls hurt buyer relationships.\n\n### 3. Poor Tracking\nYou can''t optimize what you don''t measure.\n\n### 4. Compliance Violations\nKnow and follow all regulations.\n\n## Your 30-Day Action Plan\n\n**Days 1-7**: Research and Planning\n- Choose vertical\n- Research competitors\n- Find buyers\n- Set up tracking\n\n**Days 8-14**: Campaign Creation\n- Build landing pages\n- Create ad campaigns\n- Set up call flows\n- Test everything\n\n**Days 15-21**: Launch and Optimize\n- Start with small budget\n- Monitor performance\n- Make adjustments\n- Document learnings\n\n**Days 22-30**: Scale and Expand\n- Increase budget on winners\n- Test new traffic sources\n- Negotiate better rates\n- Plan next campaign\n\n## Resources and Tools\n\n### Essential Tools:\n- **Call Tracking**: Dependable Calls Platform\n- **Landing Pages**: Unbounce, ClickFunnels\n- **Analytics**: Google Analytics, CallRail\n- **Compliance**: TCPA guidelines, Jornaya\n\n### Learning Resources:\n- Industry forums and communities\n- Webinars and conferences\n- Case studies and success stories\n- Mentorship programs\n\n## Success Story\n\n*"I started with a $500 budget in home services. By following this framework, I scaled to $10,000/month in profit within 6 months. The key was starting small, testing everything, and building strong buyer relationships."* - Sarah M., Affiliate Marketer\n\n## Next Steps\n\n1. **Choose your vertical** based on the criteria above\n2. **Sign up** for Dependable Calls to get your tracking numbers\n3. **Connect with buyers** in our marketplace\n4. **Launch your first campaign** following this guide\n\nNeed help? Our support team is here to guide you through every step.\n\n**Ready to start? [Sign up now](https://dependablecalls.com/signup) and get your first tracking number free!**',
    'Complete guide to launching your first pay-per-call campaign, from choosing a vertical to scaling your success.',
    'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1600&h=900&fit=crop',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'published',
    NOW() - INTERVAL '5 days',
    '{"seo_title": "How to Start a Pay-Per-Call Campaign | Beginner Guide 2024", "seo_description": "Step-by-step guide to setting up your first pay-per-call campaign. Learn vertical selection, buyer finding, and optimization strategies."}'::jsonb,
    521,
    8
  ),
  (
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15',
    'real-time-call-tracking-benefits',
    'The Power of Real-Time Call Tracking',
    'How instant data transforms campaign performance',
    E'# The Power of Real-Time Call Tracking\n\nIn pay-per-call marketing, information delay equals money lost. Real-time call tracking transforms how you manage campaigns.\n\n## Why Real-Time Matters\n\n### Instant Decision Making\n\n**Traditional Tracking:**\n- Daily or hourly reports\n- Delayed optimization\n- Missed opportunities\n- Reactive management\n\n**Real-Time Tracking:**\n- Immediate insights\n- Proactive adjustments\n- Opportunity capture\n- Predictive actions\n\n## Key Benefits of Real-Time Tracking\n\n### 1. Fraud Detection\n\nCatch fraudulent activity as it happens:\n- Duplicate calls flagged instantly\n- Suspicious patterns identified\n- Immediate blocking capability\n- Protect buyer relationships\n\n### 2. Budget Optimization\n\n```\nReal-Time Scenario:\n10:00 AM - Campaign launches at $50 CPL\n10:30 AM - CPL jumps to $120\n10:31 AM - Auto-pause triggered\n10:45 AM - Issue identified and fixed\n11:00 AM - Campaign resumes profitably\n\nSaved: $840 in potential losses\n```\n\n### 3. Quality Control\n\nMonitor call quality instantly:\n- Duration tracking\n- Conversion monitoring\n- Caller intent analysis\n- Publisher performance\n\n## Real-Time Features That Drive Results\n\n### Live Dashboard\n\n**Essential Metrics:**\n- Active calls counter\n- Conversion rates by source\n- Current spend vs. revenue\n- Publisher performance ranks\n\n### Instant Alerts\n\nSet notifications for:\n- High-value calls\n- Conversion rate drops\n- Budget thresholds\n- Unusual activity patterns\n\n### Dynamic Routing\n\nRoute calls based on:\n- Buyer availability\n- Geographic preferences\n- Call value scoring\n- Time-based rules\n\n## Implementation Guide\n\n### Step 1: Set Up Your Dashboard\n\nCustomize views for:\n- **Overview**: Key metrics at a glance\n- **Campaign View**: Detailed performance\n- **Publisher View**: Partner tracking\n- **Buyer View**: Client satisfaction\n\n### Step 2: Configure Alerts\n\n```javascript\n// Example alert configuration\nconst alertRules = [\n  {\n    metric: "conversionRate",\n    condition: "below",\n    threshold: 0.6,\n    action: "email + pause"\n  },\n  {\n    metric: "costPerConversion", \n    condition: "above",\n    threshold: 80,\n    action: "slack notification"\n  }\n];\n```\n\n### Step 3: Create Response Protocols\n\nDocument actions for common scenarios:\n\n**Conversion Drop Protocol:**\n1. Check buyer availability\n2. Review recent calls\n3. Contact top publishers\n4. Adjust targeting if needed\n\n## Case Studies\n\n### Case 1: Insurance Broker Saves $15,000\n\n**Challenge**: Overnight fraud attack\n**Solution**: Real-time alerts triggered at 2 AM\n**Action**: Auto-blocked suspicious sources\n**Result**: Prevented $15,000 in fraudulent charges\n\n### Case 2: Home Services Scales 300%\n\n**Challenge**: Identifying profitable hours\n**Solution**: Real-time heat mapping\n**Action**: Shifted budget to peak hours\n**Result**: 300% ROI improvement\n\n## Advanced Real-Time Strategies\n\n### Predictive Optimization\n\nUse real-time data for:\n- Demand forecasting\n- Budget allocation\n- Staffing decisions\n- Inventory management\n\n### Multi-Touch Attribution\n\nTrack the complete journey:\n- First touch: Ad click\n- Second touch: Form fill\n- Third touch: Phone call\n- Attribution: Weighted model\n\n### API Integration\n\nConnect real-time data to:\n- CRM systems\n- Business intelligence tools\n- Marketing automation\n- Financial platforms\n\n## Building a Real-Time Culture\n\n### Team Training\n\nEnsure your team can:\n- Read dashboards effectively\n- Respond to alerts quickly\n- Make data-driven decisions\n- Document learnings\n\n### Process Documentation\n\nCreate playbooks for:\n- Alert responses\n- Optimization workflows  \n- Escalation procedures\n- Performance reviews\n\n## ROI of Real-Time Tracking\n\n### Typical Results:\n\n| Metric | Before Real-Time | After Real-Time | Improvement |\n|--------|-----------------|-----------------|-------------|\n| Fraud Rate | 15% | 3% | -80% |\n| Response Time | 4 hours | 5 minutes | -98% |\n| Campaign ROI | 25% | 65% | +160% |\n| Buyer Satisfaction | 72% | 91% | +26% |\n\n## Getting Started with Real-Time\n\n### Week 1: Foundation\n- Set up dashboards\n- Configure basic alerts\n- Train team members\n\n### Week 2: Optimization\n- Refine alert thresholds\n- Create response protocols\n- Test automation rules\n\n### Week 3: Advanced Features\n- Implement API connections\n- Set up custom reports\n- Launch predictive models\n\n### Week 4: Scale\n- Roll out to all campaigns\n- Document best practices\n- Plan future enhancements\n\n## The Future of Real-Time\n\nEmerging capabilities:\n- AI-powered predictions\n- Voice analysis\n- Sentiment scoring\n- Automated optimization\n\nStay ahead by embracing real-time tracking today.\n\n**Ready to experience real-time tracking? [Start your free trial](https://dependablecalls.com/signup) and see the difference instantly.**',
    'Discover how real-time call tracking revolutionizes pay-per-call campaigns with instant insights and automated optimization.',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1600&h=900&fit=crop',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
    'published',
    NOW() - INTERVAL '2 days',
    '{"seo_title": "Real-Time Call Tracking Benefits | Pay-Per-Call Analytics", "seo_description": "Learn how real-time call tracking improves campaign performance, prevents fraud, and maximizes ROI in pay-per-call marketing."}'::jsonb,
    187,
    6
  ),
  (
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16',
    'draft-post-example',
    'Understanding Call Attribution Models',
    'A deep dive into attribution strategies',
    E'# Understanding Call Attribution Models\n\nThis is a draft post about call attribution models...\n\n## Introduction\n\nCall attribution is critical for understanding which marketing efforts drive phone calls.\n\n## Types of Attribution Models\n\n1. First Touch\n2. Last Touch  \n3. Multi-Touch\n4. Time Decay\n5. Custom Models\n\n[Content continues...]',
    'Learn about different call attribution models and how to choose the right one for your campaigns.',
    NULL,
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    'draft',
    NULL,
    '{"seo_title": "Call Attribution Models Explained", "seo_description": "Understanding different attribution models for pay-per-call campaigns."}'::jsonb,
    0,
    4
  );

-- Link posts to categories
INSERT INTO blog_post_categories (post_id, category_id)
SELECT 
  p.id as post_id,
  c.id as category_id
FROM blog_posts p
CROSS JOIN blog_categories c
WHERE 
  (p.slug = 'welcome-to-dependable-calls-blog' AND c.slug = 'announcements') OR
  (p.slug = 'top-5-pay-per-call-verticals-2024' AND c.slug = 'industry-insights') OR
  (p.slug = 'fraud-prevention-best-practices' AND c.slug = 'best-practices') OR
  (p.slug = 'setting-up-your-first-campaign' AND c.slug = 'tutorials') OR
  (p.slug = 'real-time-call-tracking-benefits' AND c.slug = 'industry-insights') OR
  (p.slug = 'draft-post-example' AND c.slug = 'tutorials');

-- Link posts to tags
INSERT INTO blog_post_tags (post_id, tag_id)
SELECT 
  p.id as post_id,
  t.id as tag_id
FROM blog_posts p
CROSS JOIN blog_tags t
WHERE 
  (p.slug = 'welcome-to-dependable-calls-blog' AND t.slug IN ('announcements', 'getting-started')) OR
  (p.slug = 'top-5-pay-per-call-verticals-2024' AND t.slug IN ('industry-insights', 'affiliate-marketing')) OR
  (p.slug = 'fraud-prevention-best-practices' AND t.slug IN ('best-practices', 'tips-tricks')) OR
  (p.slug = 'setting-up-your-first-campaign' AND t.slug IN ('getting-started', 'tutorials')) OR
  (p.slug = 'real-time-call-tracking-benefits' AND t.slug IN ('updates', 'best-practices')) OR
  (p.slug = 'draft-post-example' AND t.slug IN ('tutorials', 'lead-generation'));

-- Add some test comments (optional - for Phase 2)
INSERT INTO blog_comments (
  post_id, user_id, content, content_sanitized, status, ip_address, user_agent
)
SELECT
  p.id as post_id,
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14' as user_id,
  'Great article! This really helped me understand the basics.' as content,
  'Great article! This really helped me understand the basics.' as content_sanitized,
  'approved' as status,
  '192.168.1.100'::inet as ip_address,
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' as user_agent
FROM blog_posts p
WHERE p.slug = 'setting-up-your-first-campaign';

-- Update search vectors for all posts
UPDATE blog_posts
SET search_vector = 
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(subtitle, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(content, '')), 'C');

-- Add reading time for posts that don't have it calculated
UPDATE blog_posts
SET reading_time_minutes = GREATEST(1, CEIL(array_length(string_to_array(content, ' '), 1)::FLOAT / 200))
WHERE reading_time_minutes IS NULL;
```

---


# Documentation Files


## File: `SUPABASE_BLOG_CMS_IMPLEMENTATION_GUIDE.md`

```markdown
# Supabase-Based CMS Implementation Guide for DCE Website Blog

## Executive Summary

This guide provides a comprehensive implementation plan for creating a Supabase-based Content Management System (CMS) for the DCE website blog functionality. Currently, the blog links to an external URL (blog.dependablecalls.com), but this implementation will bring the blog in-house at the `/blog` route.

## Current State Analysis

### Existing Infrastructure
- **Frontend**: Vite + React + TypeScript (v5.8)
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **State Management**: Zustand
- **Data Fetching**: React Query (Tanstack Query)
- **Routing**: React Router v6
- **Styling**: Tailwind CSS

### Current Blog Implementation
- External links to `https://blog.dependablecalls.com`
- No internal blog functionality
- Blog links appear in:
  - `PublicLayout.tsx` navigation (desktop and mobile)
  - Footer navigation

### Existing Supabase Configuration
- Supabase client configured at `src/lib/supabase.ts`
- TypeScript database types at `src/types/database.ts`
- Extensive RLS policies and security measures already in place
- Existing patterns for audit logging and data tracking

## Database Schema Design

### Core Tables

#### 1. `blog_posts`
```sql
CREATE TABLE blog_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  content TEXT NOT NULL, -- Raw markdown
  content_sanitized TEXT, -- Sanitized HTML (generated via trigger)
  excerpt TEXT, -- Short preview text
  featured_image_url TEXT,
  author_id UUID REFERENCES blog_authors(id) NOT NULL,
  status TEXT CHECK (status IN ('draft', 'published', 'archived')) DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}', -- SEO meta, custom fields
  view_count INTEGER DEFAULT 0,
  reading_time_minutes INTEGER,
  search_vector tsvector,
  embedding vector(1536), -- For semantic search
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_status_published ON blog_posts(status, published_at DESC);
CREATE INDEX idx_blog_posts_author ON blog_posts(author_id);
CREATE INDEX idx_blog_posts_search ON blog_posts USING gin(search_vector);
CREATE INDEX idx_blog_posts_embedding ON blog_posts USING ivfflat (embedding vector_cosine_ops);

-- Enable pg_trgm for better text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_blog_posts_title_trgm ON blog_posts USING gin(title gin_trgm_ops);
```

#### 2. `blog_categories`
```sql
CREATE TABLE blog_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES blog_categories(id),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_blog_categories_slug ON blog_categories(slug);
CREATE INDEX idx_blog_categories_parent ON blog_categories(parent_id);
```

#### 3. `blog_tags`
```sql
CREATE TABLE blog_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_blog_tags_slug ON blog_tags(slug);
```

#### 4. `blog_post_categories`
```sql
CREATE TABLE blog_post_categories (
  post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES blog_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, category_id)
);
```

#### 5. `blog_post_tags`
```sql
CREATE TABLE blog_post_tags (
  post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES blog_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);
```

#### 6. `blog_authors`
```sql
CREATE TABLE blog_authors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  social_links JSONB DEFAULT '{}',
  storage_quota_mb INTEGER DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_blog_authors_user ON blog_authors(user_id);
```

#### 7. `blog_comments` (Optional - Phase 2)
```sql
CREATE TABLE blog_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  parent_id UUID REFERENCES blog_comments(id),
  content TEXT NOT NULL,
  content_sanitized TEXT,
  status TEXT CHECK (status IN ('pending', 'approved', 'spam', 'deleted')) DEFAULT 'pending',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_blog_comments_post ON blog_comments(post_id);
CREATE INDEX idx_blog_comments_user ON blog_comments(user_id);
CREATE INDEX idx_blog_comments_parent ON blog_comments(parent_id);
CREATE INDEX idx_blog_comments_status ON blog_comments(status);
```

### Row Level Security (RLS) Policies

```sql
-- Enable RLS on all blog tables
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_authors ENABLE ROW LEVEL SECURITY;

-- Blog Posts Policies
-- Public can read published posts
CREATE POLICY "Published posts are viewable by everyone" 
  ON blog_posts FOR SELECT
  USING (status = 'published' AND published_at <= NOW());

-- Authors can CRUD their own posts (FIXED)
CREATE POLICY "Authors can manage their own posts" 
  ON blog_posts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM blog_authors ba 
    WHERE ba.id = blog_posts.author_id 
    AND ba.user_id = auth.uid()
  ));

-- Admins can manage all posts
CREATE POLICY "Admins can manage all posts" 
  ON blog_posts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM admins WHERE user_id = auth.uid()
  ));

-- Categories and Tags are publicly readable
CREATE POLICY "Categories are viewable by everyone" 
  ON blog_categories FOR SELECT
  USING (true);

CREATE POLICY "Tags are viewable by everyone" 
  ON blog_tags FOR SELECT
  USING (true);

-- Only admins can manage categories and tags
CREATE POLICY "Admins can manage categories" 
  ON blog_categories FOR ALL
  USING (EXISTS (
    SELECT 1 FROM admins WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage tags" 
  ON blog_tags FOR ALL
  USING (EXISTS (
    SELECT 1 FROM admins WHERE user_id = auth.uid()
  ));

-- Post categories and tags policies (NEW)
CREATE POLICY "Post categories viewable with post access"
  ON blog_post_categories FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM blog_posts bp
    WHERE bp.id = post_id
    AND (bp.status = 'published' OR EXISTS (
      SELECT 1 FROM blog_authors ba 
      WHERE ba.id = bp.author_id 
      AND ba.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM admins WHERE user_id = auth.uid()
    ))
  ));

CREATE POLICY "Authors can manage their post categories"
  ON blog_post_categories FOR ALL
  USING (EXISTS (
    SELECT 1 FROM blog_posts bp
    JOIN blog_authors ba ON ba.id = bp.author_id
    WHERE bp.id = post_id
    AND ba.user_id = auth.uid()
  ));

CREATE POLICY "Post tags viewable with post access"
  ON blog_post_tags FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM blog_posts bp
    WHERE bp.id = post_id
    AND (bp.status = 'published' OR EXISTS (
      SELECT 1 FROM blog_authors ba 
      WHERE ba.id = bp.author_id 
      AND ba.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM admins WHERE user_id = auth.uid()
    ))
  ));

CREATE POLICY "Authors can manage their post tags"
  ON blog_post_tags FOR ALL
  USING (EXISTS (
    SELECT 1 FROM blog_posts bp
    JOIN blog_authors ba ON ba.id = bp.author_id
    WHERE bp.id = post_id
    AND ba.user_id = auth.uid()
  ));
```

### Automated Triggers

```sql
-- Auto-update timestamps
CREATE EXTENSION IF NOT EXISTS moddatetime;

CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

CREATE TRIGGER update_blog_categories_updated_at
  BEFORE UPDATE ON blog_categories
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

CREATE TRIGGER update_blog_authors_updated_at
  BEFORE UPDATE ON blog_authors
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

CREATE TRIGGER update_blog_comments_updated_at
  BEFORE UPDATE ON blog_comments
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

-- Full-text search trigger
CREATE OR REPLACE FUNCTION blog_posts_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.subtitle, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blog_posts_search_update 
  BEFORE INSERT OR UPDATE OF title, subtitle, content ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION blog_posts_search_trigger();

-- Audit trigger for content changes
CREATE OR REPLACE FUNCTION blog_audit_content_changes() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.content IS DISTINCT FROM NEW.content THEN
    INSERT INTO audit_logs (
      table_name,
      action,
      user_id,
      record_id,
      old_data,
      new_data,
      created_at
    ) VALUES (
      'blog_posts',
      'content_update',
      auth.uid(),
      NEW.id,
      jsonb_build_object('content', OLD.content),
      jsonb_build_object('content', NEW.content),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blog_audit_content
  AFTER UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION blog_audit_content_changes();

## Implementation Plan

### Phase 1: Database Setup and Basic CRUD (5-7 dev days)

1. **Create Migration File**
   - Add new migration: `supabase/migrations/018_blog_cms_tables.sql`
   - Include all table definitions, indexes, and RLS policies

2. **Update TypeScript Types**
   - Generate new database types
   - Create blog-specific type definitions in `src/types/blog.ts`

3. **Create Supabase Service Layer**
   - `src/services/blog.service.ts` - Core CRUD operations
   - Implement caching with React Query
   - Handle real-time subscriptions for live updates

### Phase 2: Frontend Components (6-8 dev days)

1. **Public Blog Pages**
   ```
   src/pages/public/blog/
   ├── BlogHomePage.tsx      // Blog listing page
   ├── BlogPostPage.tsx      // Individual post view
   ├── BlogCategoryPage.tsx  // Category listing
   ├── BlogTagPage.tsx       // Tag listing
   └── BlogSearchPage.tsx    // Search results
   ```

2. **Blog Components**
   ```
   src/components/blog/
   ├── BlogPostCard.tsx      // Post preview card
   ├── BlogPostContent.tsx   // Markdown renderer
   ├── BlogSidebar.tsx       // Categories, tags, recent posts
   ├── BlogPagination.tsx    // Pagination component
   └── BlogSearch.tsx        // Search component
   ```

3. **Admin CMS Components**
   ```
   src/components/blog/admin/
   ├── BlogPostEditor.tsx    // Rich text/markdown editor
   ├── BlogPostList.tsx      // Admin post management
   ├── BlogCategoryManager.tsx
   ├── BlogTagManager.tsx
   └── BlogMediaUploader.tsx // Image upload to Supabase Storage
   ```

### Phase 3: CMS Features (8-10 dev days)

1. **Rich Text Editor Integration**
   - Integrate TipTap with Supabase collaboration plugin
   - Image upload to Supabase Storage with AV scanning
   - Real-time preview with sanitization
   - Auto-save drafts to localStorage + Supabase

2. **SEO Optimization**
   - Dynamic meta tags
   - Sitemap generation
   - RSS feed endpoint

3. **Advanced Features**
   - Full-text search using PostgreSQL with pg_trgm
   - Related posts via pgvector semantic similarity
   - Reading time calculation
   - View count tracking with rate limiting

### Phase 4: Admin Dashboard (6-8 dev days)

1. **Blog Analytics**
   - Post performance metrics
   - Popular content tracking
   - Author statistics

2. **Content Management**
   - Bulk operations
   - Scheduled publishing
   - Content versioning

## Key Implementation Details

### 1. Routing Updates

Update `src/App.tsx` to include blog routes:

```tsx
// Public blog routes
<Route path="blog" element={<BlogLayout />}>
  <Route index element={<BlogHomePage />} />
  <Route path="post/:slug" element={<BlogPostPage />} />
  <Route path="category/:slug" element={<BlogCategoryPage />} />
  <Route path="tag/:slug" element={<BlogTagPage />} />
  <Route path="search" element={<BlogSearchPage />} />
</Route>

// Admin blog routes (protected)
<Route path="blog" element={<AdminBlogLayout />}>
  <Route index element={<BlogDashboard />} />
  <Route path="posts" element={<BlogPostList />} />
  <Route path="posts/new" element={<BlogPostEditor />} />
  <Route path="posts/:id/edit" element={<BlogPostEditor />} />
  <Route path="categories" element={<BlogCategoryManager />} />
  <Route path="tags" element={<BlogTagManager />} />
</Route>
```

### 2. Supabase Storage for Images

```sql
-- Create storage bucket with updated configuration
INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-images', 'blog-images', true);

-- Storage policies with quota enforcement
CREATE POLICY "Authors can upload images within quota"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'blog-images' AND
  EXISTS (
    SELECT 1 FROM blog_authors ba
    WHERE ba.user_id = auth.uid()
    AND (
      SELECT COALESCE(SUM(size), 0) 
      FROM storage.objects 
      WHERE bucket_id = 'blog-images' 
      AND owner = auth.uid()
    ) + size <= ba.storage_quota_mb * 1024 * 1024
  )
);

CREATE POLICY "Authors can manage their own images"
ON storage.objects FOR ALL
USING (
  bucket_id = 'blog-images' AND
  owner = auth.uid()
);

CREATE POLICY "Public can view blog images"
ON storage.objects FOR SELECT
USING (bucket_id = 'blog-images');
```

### 3. Real-time Features

```typescript
// Subscribe to new posts
const subscription = supabase
  .channel('blog_posts_changes')
  .on('postgres_changes', 
    { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'blog_posts',
      filter: 'status=eq.published'
    }, 
    handleNewPost
  )
  .subscribe();
```

### 4. Search Implementation with pgvector

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Function to generate embeddings (called from Edge Function)
CREATE OR REPLACE FUNCTION generate_blog_embedding(post_id UUID) 
RETURNS void AS $$
DECLARE
  post_content TEXT;
  embedding_vector vector(1536);
BEGIN
  SELECT title || ' ' || COALESCE(subtitle, '') || ' ' || content 
  INTO post_content
  FROM blog_posts 
  WHERE id = post_id;

  -- Call Edge Function to generate embedding via OpenAI
  -- This is a placeholder - actual implementation would use pg_net
  -- to call the Edge Function and get the embedding
  
  UPDATE blog_posts 
  SET embedding = embedding_vector 
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql;

-- Semantic search function
CREATE OR REPLACE FUNCTION search_similar_posts(
  query_embedding vector(1536),
  match_count INT DEFAULT 5
) RETURNS TABLE (
  id UUID,
  title TEXT,
  slug TEXT,
  excerpt TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bp.id,
    bp.title,
    bp.slug,
    bp.excerpt,
    1 - (bp.embedding <=> query_embedding) as similarity
  FROM blog_posts bp
  WHERE bp.status = 'published'
  AND bp.embedding IS NOT NULL
  ORDER BY bp.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;
```

## Security Considerations

1. **Content Sanitization**
   - Server-side sanitization via Edge Function
   - Client-side DOMPurify for double protection
   - Validate all user inputs with Zod schemas

2. **Access Control**
   - Only admins and designated authors can create/edit posts
   - Draft posts only visible to authors and admins
   - Implement proper CORS policies for image uploads

3. **Rate Limiting**
   - Implement rate limiting for comments (Phase 2)
   - Limit API calls for search functionality
   - Monitor for abuse patterns

## Performance Optimizations

1. **Caching Strategy**
   - Cache published posts with React Query
   - Implement stale-while-revalidate pattern
   - Use Supabase's built-in caching headers

2. **Lazy Loading**
   - Implement infinite scroll for blog listing
   - Lazy load images with intersection observer
   - Code split blog routes

3. **Database Optimizations**
   - Use materialized views for popular posts
   - Implement database-level pagination
   - Optimize queries with proper indexes

## Migration Strategy

1. **Phase 1**: Deploy database schema and basic functionality
2. **Phase 2**: Soft launch with limited content
3. **Phase 3**: Migrate existing content (if any)
4. **Phase 4**: Update all blog links to internal routes
5. **Phase 5**: Redirect old blog.dependablecalls.com URLs

## Monitoring and Analytics

1. **Performance Monitoring**
   - Track page load times
   - Monitor database query performance
   - Set up alerts for errors

2. **Content Analytics**
   - Track post views and engagement
   - Monitor search queries
   - Analyze user behavior

## Future Enhancements

1. **Phase 2 Features**
   - Comment system with moderation
   - Social sharing integration
   - Email subscription for new posts

2. **Phase 3 Features**
   - Multi-language support
   - A/B testing for headlines
   - Content recommendation engine

## Total Timeline Estimate

| Phase | Calendar Days | Dev Days | Key Risks |
|-------|--------------|----------|-----------|
| Database & Backend | 7-10 | 5-7 | Migration complexity, RLS testing |
| Frontend Components | 10-14 | 6-8 | Editor integration, performance |
| CMS Features | 14-18 | 8-10 | Sanitization edge cases, search accuracy |
| Dashboard & Analytics | 10-14 | 6-8 | Materialized view performance |
| **Total** | **41-56 days** | **25-33 days** | **6-8 weeks with buffer** |

## Recommended Next Steps

1. **Fix RLS Policies** - Correct author authentication with lateral joins
2. **Add Update Triggers** - Implement moddatetime for all tables  
3. **Storage Security** - Set up quota enforcement and AV scanning
4. **Choose Editor** - Evaluate TipTap vs alternatives
5. **Migration Script** - Plan HTML→Markdown conversion pipeline
6. **Security Audit** - Review all policies before deployment

## Conclusion

This implementation plan provides a robust, scalable foundation for a Supabase-based CMS that integrates seamlessly with the existing DCE website architecture. The modular approach allows for incremental deployment while maintaining security and performance standards.
```

---


# TypeScript Implementation Files


## File: `src/types/blog.ts`

```typescript
import type { Database } from './database'

// Database table types
export type BlogPostRow = Database['public']['Tables']['blog_posts']['Row']
export type BlogPostInsert = Database['public']['Tables']['blog_posts']['Insert']
export type BlogPostUpdate = Database['public']['Tables']['blog_posts']['Update']

export type BlogAuthorRow = Database['public']['Tables']['blog_authors']['Row']
export type BlogAuthorInsert = Database['public']['Tables']['blog_authors']['Insert']
export type BlogAuthorUpdate = Database['public']['Tables']['blog_authors']['Update']

export type BlogCategoryRow = Database['public']['Tables']['blog_categories']['Row']
export type BlogCategoryInsert = Database['public']['Tables']['blog_categories']['Insert']
export type BlogCategoryUpdate = Database['public']['Tables']['blog_categories']['Update']

export type BlogTagRow = Database['public']['Tables']['blog_tags']['Row']
export type BlogTagInsert = Database['public']['Tables']['blog_tags']['Insert']
export type BlogTagUpdate = Database['public']['Tables']['blog_tags']['Update']

export type BlogCommentRow = Database['public']['Tables']['blog_comments']['Row']
export type BlogCommentInsert = Database['public']['Tables']['blog_comments']['Insert']
export type BlogCommentUpdate = Database['public']['Tables']['blog_comments']['Update']

// Post status enum
export type PostStatus = 'draft' | 'published' | 'archived'

// Comment status enum
export type CommentStatus = 'pending' | 'approved' | 'spam' | 'deleted'

// Extended types with relations
export interface BlogPost extends BlogPostRow {
  author?: BlogAuthor
  categories?: BlogCategory[]
  tags?: BlogTag[]
  comments?: BlogComment[]
}

export interface BlogAuthor extends BlogAuthorRow {
  posts?: BlogPost[]
  postsCount?: number
  user?: {
    id: string
    email: string
    username?: string
  }
}

export interface BlogCategory extends BlogCategoryRow {
  posts?: BlogPost[]
  postsCount?: number
  parent?: BlogCategory
  children?: BlogCategory[]
}

export interface BlogTag extends BlogTagRow {
  posts?: BlogPost[]
  postsCount?: number
}

export interface BlogComment extends BlogCommentRow {
  post?: BlogPost
  user?: {
    id: string
    email: string
    username?: string
    avatar_url?: string
  }
  parent?: BlogComment
  replies?: BlogComment[]
}

// Pagination types
export interface PaginationParams {
  page?: number
  limit?: number
  offset?: number
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

// Filter and sort types
export interface BlogPostFilters {
  status?: PostStatus
  authorId?: string
  categoryId?: string
  categorySlug?: string
  tagId?: string
  tagSlug?: string
  search?: string
  startDate?: string
  endDate?: string
}

export type BlogPostSortBy = 
  | 'published_at'
  | 'created_at'
  | 'updated_at'
  | 'title'
  | 'view_count'

export type SortOrder = 'asc' | 'desc'

export interface BlogPostSort {
  by: BlogPostSortBy
  order: SortOrder
}

// Request types
export interface GetBlogPostsParams extends PaginationParams {
  filters?: BlogPostFilters
  sort?: BlogPostSort
  includeAuthor?: boolean
  includeCategories?: boolean
  includeTags?: boolean
}

export interface GetBlogPostParams {
  slug: string
  includeAuthor?: boolean
  includeCategories?: boolean
  includeTags?: boolean
  includeComments?: boolean
}

export interface CreateBlogPostData {
  title: string
  subtitle?: string
  content: string
  excerpt?: string
  featured_image_url?: string
  status?: PostStatus
  published_at?: string
  metadata?: Record<string, unknown>
  categoryIds?: string[]
  tagIds?: string[]
}

export interface UpdateBlogPostData extends Partial<CreateBlogPostData> {
  id: string
}

// Comment types
export interface GetCommentsParams extends PaginationParams {
  postId?: string
  userId?: string
  status?: CommentStatus
  parentId?: string | null
}

export interface CreateCommentData {
  post_id: string
  content: string
  parent_id?: string
}

export interface ModerateCommentData {
  id: string
  status: CommentStatus
}

// Statistics types
export interface BlogStatistics {
  totalPosts: number
  publishedPosts: number
  draftPosts: number
  totalViews: number
  totalComments: number
  avgReadingTime: number
}

export interface PopularTag {
  id: string
  name: string
  slug: string
  count: number
}

// SEO metadata types
export interface BlogSEOMetadata {
  title?: string
  description?: string
  keywords?: string[]
  ogImage?: string
  ogTitle?: string
  ogDescription?: string
  canonicalUrl?: string
  noIndex?: boolean
  noFollow?: boolean
}

// Author social links type
export interface AuthorSocialLinks {
  twitter?: string
  linkedin?: string
  github?: string
  website?: string
  facebook?: string
  instagram?: string
}

// Response types
export interface BlogPostResponse {
  post: BlogPost
  relatedPosts?: BlogPost[]
}

export interface AuthorProfileResponse {
  author: BlogAuthor
  statistics: BlogStatistics
  recentPosts: BlogPost[]
}

// Error types
export interface BlogError {
  code: string
  message: string
  details?: unknown
}

// Constants
export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived'
}

export const COMMENT_STATUS_LABELS: Record<CommentStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  spam: 'Spam',
  deleted: 'Deleted'
}

export const DEFAULT_PAGE_SIZE = 10
export const MAX_PAGE_SIZE = 100
```

---


## File: `src/services/blog.service.ts`

```typescript
import { from, rpc } from '../lib/supabase-optimized'
import type { 
  BlogPost, 
  BlogPostRow,
  BlogAuthor,
  BlogCategory,
  BlogTag,
  BlogComment,
  CreateBlogPostData,
  UpdateBlogPostData,
  GetBlogPostsParams,
  GetBlogPostParams,
  PaginatedResponse,
  BlogPostFilters,
  BlogPostSort,
  CreateCommentData,
  ModerateCommentData,
  GetCommentsParams,
  BlogStatistics,
  PopularTag,
  AuthorSocialLinks,
  BlogAuthorUpdate
} from '../types/blog'

export class BlogService {
  /**
   * Get paginated list of blog posts with filters
   */
  static async getPosts(params: GetBlogPostsParams): Promise<PaginatedResponse<BlogPost>> {
    const {
      page = 1,
      limit = 10,
      filters = {},
      sort = { by: 'published_at', order: 'desc' },
      includeAuthor = true,
      includeCategories = true,
      includeTags = true
    } = params

    // Calculate offset
    const offset = (page - 1) * limit

    // Start building query
    let query = from('blog_posts').select(`
      *,
      ${includeAuthor ? 'author:blog_authors(*)' : ''},
      ${includeCategories ? 'categories:blog_post_categories(category:blog_categories(*))' : ''},
      ${includeTags ? 'tags:blog_post_tags(tag:blog_tags(*))' : ''}
    `, { count: 'exact' })

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status)
    } else {
      // Default to published posts for public queries
      query = query.eq('status', 'published')
    }

    if (filters.authorId) {
      query = query.eq('author_id', filters.authorId)
    }

    if (filters.search) {
      query = query.textSearch('search_vector', filters.search)
    }

    if (filters.startDate) {
      query = query.gte('published_at', filters.startDate)
    }

    if (filters.endDate) {
      query = query.lte('published_at', filters.endDate)
    }

    // Apply category filter
    if (filters.categoryId || filters.categorySlug) {
      const categoryQuery = from('blog_categories').select('id')
      
      if (filters.categoryId) {
        categoryQuery.eq('id', filters.categoryId)
      } else if (filters.categorySlug) {
        categoryQuery.eq('slug', filters.categorySlug)
      }

      const { data: category } = await categoryQuery.single()
      
      if (category) {
        query = query.in('id', 
          from('blog_post_categories')
            .select('post_id')
            .eq('category_id', category.id)
        )
      }
    }

    // Apply tag filter
    if (filters.tagId || filters.tagSlug) {
      const tagQuery = from('blog_tags').select('id')
      
      if (filters.tagId) {
        tagQuery.eq('id', filters.tagId)
      } else if (filters.tagSlug) {
        tagQuery.eq('slug', filters.tagSlug)
      }

      const { data: tag } = await tagQuery.single()
      
      if (tag) {
        query = query.in('id',
          from('blog_post_tags')
            .select('post_id')
            .eq('tag_id', tag.id)
        )
      }
    }

    // Apply sorting
    query = query.order(sort.by, { ascending: sort.order === 'asc' })

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) throw error

    // Transform the data to match our BlogPost interface
    const posts: BlogPost[] = (data || []).map(post => ({
      ...post,
      categories: post.categories?.map((pc: any) => pc.category) || [],
      tags: post.tags?.map((pt: any) => pt.tag) || []
    }))

    return {
      data: posts,
      meta: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasNextPage: page < Math.ceil((count || 0) / limit),
        hasPreviousPage: page > 1
      }
    }
  }

  /**
   * Get a single blog post by slug
   */
  static async getPost(params: GetBlogPostParams): Promise<BlogPost | null> {
    const {
      slug,
      includeAuthor = true,
      includeCategories = true,
      includeTags = true,
      includeComments = false
    } = params

    let query = from('blog_posts').select(`
      *,
      ${includeAuthor ? 'author:blog_authors(*)' : ''},
      ${includeCategories ? 'categories:blog_post_categories(category:blog_categories(*))' : ''},
      ${includeTags ? 'tags:blog_post_tags(tag:blog_tags(*))' : ''},
      ${includeComments ? 'comments:blog_comments(*, user:users(id, email, username))' : ''}
    `)
      .eq('slug', slug)
      .eq('status', 'published')
      .single()

    const { data, error } = await query

    if (error || !data) return null

    // Increment view count
    await from('blog_posts')
      .update({ view_count: (data.view_count || 0) + 1 })
      .eq('id', data.id)

    // Transform the data
    return {
      ...data,
      categories: data.categories?.map((pc: any) => pc.category) || [],
      tags: data.tags?.map((pt: any) => pt.tag) || [],
      comments: includeComments ? (data.comments || []) : undefined
    }
  }

  /**
   * Create a new blog post
   */
  static async createPost(data: CreateBlogPostData): Promise<BlogPost> {
    const { categoryIds = [], tagIds = [], ...postData } = data

    // Generate slug if not provided
    let slug = postData.title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    // Check if slug exists and generate unique one
    const { data: existingPost } = await from('blog_posts')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existingPost) {
      slug = `${slug}-${Date.now()}`
    }

    // Create the post
    const { data: post, error: postError } = await from('blog_posts')
      .insert({
        ...postData,
        slug,
        status: postData.status || 'draft',
        published_at: postData.status === 'published' ? new Date().toISOString() : undefined
      })
      .select()
      .single()

    if (postError) throw postError

    // Add categories
    if (categoryIds.length > 0) {
      const { error: catError } = await from('blog_post_categories')
        .insert(categoryIds.map(categoryId => ({
          post_id: post.id,
          category_id: categoryId
        })))

      if (catError) throw catError
    }

    // Add tags
    if (tagIds.length > 0) {
      const { error: tagError } = await from('blog_post_tags')
        .insert(tagIds.map(tagId => ({
          post_id: post.id,
          tag_id: tagId
        })))

      if (tagError) throw tagError
    }

    return post
  }

  /**
   * Update an existing blog post
   */
  static async updatePost(data: UpdateBlogPostData): Promise<BlogPost> {
    const { id, categoryIds, tagIds, ...updateData } = data

    // Update the post
    const { data: post, error: postError } = await from('blog_posts')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (postError) throw postError

    // Update categories if provided
    if (categoryIds !== undefined) {
      // Remove existing categories
      await from('blog_post_categories')
        .delete()
        .eq('post_id', id)

      // Add new categories
      if (categoryIds.length > 0) {
        const { error: catError } = await from('blog_post_categories')
          .insert(categoryIds.map(categoryId => ({
            post_id: id,
            category_id: categoryId
          })))

        if (catError) throw catError
      }
    }

    // Update tags if provided
    if (tagIds !== undefined) {
      // Remove existing tags
      await from('blog_post_tags')
        .delete()
        .eq('post_id', id)

      // Add new tags
      if (tagIds.length > 0) {
        const { error: tagError } = await from('blog_post_tags')
          .insert(tagIds.map(tagId => ({
            post_id: id,
            tag_id: tagId
          })))

        if (tagError) throw tagError
      }
    }

    return post
  }

  /**
   * Delete a blog post
   */
  static async deletePost(id: string): Promise<void> {
    const { error } = await from('blog_posts')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  /**
   * Search blog posts
   */
  static async searchPosts(query: string, limit = 10): Promise<BlogPost[]> {
    const { data, error } = await from('blog_posts')
      .select('*, author:blog_authors(*)')
      .textSearch('search_vector', query)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return data || []
  }

  /**
   * Get all categories
   */
  static async getCategories(): Promise<BlogCategory[]> {
    const { data, error } = await from('blog_categories')
      .select('*')
      .order('display_order', { ascending: true })

    if (error) throw error

    return data || []
  }

  /**
   * Get category by slug
   */
  static async getCategoryBySlug(slug: string): Promise<BlogCategory | null> {
    const { data, error } = await from('blog_categories')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error) return null

    return data
  }

  /**
   * Get all tags
   */
  static async getTags(): Promise<BlogTag[]> {
    const { data, error } = await from('blog_tags')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error

    return data || []
  }

  /**
   * Get tag by slug
   */
  static async getTagBySlug(slug: string): Promise<BlogTag | null> {
    const { data, error } = await from('blog_tags')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error) return null

    return data
  }

  /**
   * Get popular tags
   */
  static async getPopularTags(limit = 10): Promise<PopularTag[]> {
    const { data, error } = await from('blog_tags')
      .select(`
        *,
        posts:blog_post_tags(count)
      `)
      .order('posts.count', { ascending: false })
      .limit(limit)

    if (error) throw error

    return (data || []).map(tag => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      count: tag.posts?.[0]?.count || 0
    }))
  }

  /**
   * Get author profile by user ID
   */
  static async getAuthorProfile(userId: string): Promise<BlogAuthor | null> {
    const { data, error } = await from('blog_authors')
      .select('*, user:users(id, email, username)')
      .eq('user_id', userId)
      .single()

    if (error) return null

    return data
  }

  /**
   * Update author profile
   */
  static async updateAuthorProfile(userId: string, updates: Partial<BlogAuthorUpdate>): Promise<BlogAuthor> {
    const { data, error } = await from('blog_authors')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error

    return data
  }

  /**
   * Get comments for a post
   */
  static async getComments(params: GetCommentsParams): Promise<PaginatedResponse<BlogComment>> {
    const { postId, userId, status = 'approved', parentId = null, page = 1, limit = 20 } = params
    const offset = (page - 1) * limit

    let query = from('blog_comments').select(`
      *,
      user:users(id, email, username, avatar_url),
      replies:blog_comments(count)
    `, { count: 'exact' })

    if (postId) {
      query = query.eq('post_id', postId)
    }

    if (userId) {
      query = query.eq('user_id', userId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (parentId !== undefined) {
      query = parentId === null 
        ? query.is('parent_id', null)
        : query.eq('parent_id', parentId)
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) throw error

    return {
      data: data || [],
      meta: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasNextPage: page < Math.ceil((count || 0) / limit),
        hasPreviousPage: page > 1
      }
    }
  }

  /**
   * Create a new comment
   */
  static async createComment(data: CreateCommentData): Promise<BlogComment> {
    const { data: comment, error } = await from('blog_comments')
      .insert({
        ...data,
        status: 'pending' // All new comments start as pending
      })
      .select('*, user:users(id, email, username, avatar_url)')
      .single()

    if (error) throw error

    return comment
  }

  /**
   * Moderate a comment
   */
  static async moderateComment(data: ModerateCommentData): Promise<BlogComment> {
    const { data: comment, error } = await from('blog_comments')
      .update({
        status: data.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', data.id)
      .select()
      .single()

    if (error) throw error

    return comment
  }

  /**
   * Get blog statistics
   */
  static async getStatistics(authorId?: string): Promise<BlogStatistics> {
    const { data, error } = await rpc('get_blog_statistics', {
      author_id_param: authorId || null
    })

    if (error) throw error

    const stats = data?.[0]

    return {
      totalPosts: stats?.total_posts || 0,
      publishedPosts: stats?.published_posts || 0,
      draftPosts: stats?.draft_posts || 0,
      totalViews: stats?.total_views || 0,
      totalComments: stats?.total_comments || 0,
      avgReadingTime: stats?.avg_reading_time || 0
    }
  }

  /**
   * Get similar posts using vector search
   */
  static async getSimilarPosts(postId: string, limit = 5): Promise<BlogPost[]> {
    // First get the post's embedding
    const { data: post } = await from('blog_posts')
      .select('embedding')
      .eq('id', postId)
      .single()

    if (!post?.embedding) return []

    // Search for similar posts
    const { data, error } = await rpc('search_similar_posts', {
      query_embedding: post.embedding,
      match_count: limit + 1 // Include self
    })

    if (error) throw error

    // Filter out the current post and return
    return (data || [])
      .filter(p => p.id !== postId)
      .slice(0, limit)
  }
}
```

---


## File: `src/hooks/useBlog.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BlogService } from '../services/blog.service'
import type {
  GetBlogPostsParams,
  GetBlogPostParams,
  CreateBlogPostData,
  UpdateBlogPostData,
  CreateCommentData,
  ModerateCommentData,
  GetCommentsParams,
  BlogAuthorUpdate
} from '../types/blog'

// Query key factory for blog-related queries
export const blogQueryKeys = {
  all: ['blog'] as const,
  posts: {
    all: ['blog', 'posts'] as const,
    lists: () => [...blogQueryKeys.posts.all, 'list'] as const,
    list: (params: GetBlogPostsParams) => [...blogQueryKeys.posts.lists(), params] as const,
    details: () => [...blogQueryKeys.posts.all, 'detail'] as const,
    detail: (slug: string) => [...blogQueryKeys.posts.details(), slug] as const,
    search: (query: string) => [...blogQueryKeys.posts.all, 'search', query] as const,
    similar: (postId: string) => [...blogQueryKeys.posts.all, 'similar', postId] as const,
  },
  categories: {
    all: ['blog', 'categories'] as const,
    detail: (slug: string) => [...blogQueryKeys.categories.all, slug] as const,
  },
  tags: {
    all: ['blog', 'tags'] as const,
    detail: (slug: string) => [...blogQueryKeys.tags.all, slug] as const,
    popular: () => [...blogQueryKeys.tags.all, 'popular'] as const,
  },
  authors: {
    all: ['blog', 'authors'] as const,
    profile: (userId: string) => [...blogQueryKeys.authors.all, userId] as const,
  },
  comments: {
    all: ['blog', 'comments'] as const,
    list: (params: GetCommentsParams) => [...blogQueryKeys.comments.all, 'list', params] as const,
  },
  statistics: {
    all: ['blog', 'statistics'] as const,
    author: (authorId: string) => [...blogQueryKeys.statistics.all, authorId] as const,
    global: () => [...blogQueryKeys.statistics.all, 'global'] as const,
  },
}

/**
 * Hook to fetch paginated blog posts
 */
export function useBlogPosts(params: GetBlogPostsParams = {}) {
  return useQuery({
    queryKey: blogQueryKeys.posts.list(params),
    queryFn: () => BlogService.getPosts(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to fetch a single blog post by slug
 */
export function useBlogPost(params: GetBlogPostParams) {
  return useQuery({
    queryKey: blogQueryKeys.posts.detail(params.slug),
    queryFn: () => BlogService.getPost(params),
    enabled: !!params.slug,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

/**
 * Hook to search blog posts
 */
export function useSearchBlogPosts(query: string, limit = 10) {
  return useQuery({
    queryKey: blogQueryKeys.posts.search(query),
    queryFn: () => BlogService.searchPosts(query, limit),
    enabled: query.length > 2,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

/**
 * Hook to get similar blog posts
 */
export function useSimilarPosts(postId: string, limit = 5) {
  return useQuery({
    queryKey: blogQueryKeys.posts.similar(postId),
    queryFn: () => BlogService.getSimilarPosts(postId, limit),
    enabled: !!postId,
    staleTime: 30 * 60 * 1000, // 30 minutes
  })
}

/**
 * Hook to create a new blog post
 */
export function useCreatePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateBlogPostData) => BlogService.createPost(data),
    onSuccess: () => {
      // Invalidate posts list to refetch
      queryClient.invalidateQueries({ queryKey: blogQueryKeys.posts.lists() })
    },
  })
}

/**
 * Hook to update a blog post
 */
export function useUpdatePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateBlogPostData) => BlogService.updatePost(data),
    onSuccess: (updatedPost) => {
      // Invalidate specific post
      queryClient.invalidateQueries({ 
        queryKey: blogQueryKeys.posts.detail(updatedPost.slug) 
      })
      // Invalidate posts list
      queryClient.invalidateQueries({ queryKey: blogQueryKeys.posts.lists() })
    },
  })
}

/**
 * Hook to delete a blog post
 */
export function useDeletePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => BlogService.deletePost(id),
    onSuccess: () => {
      // Invalidate posts list
      queryClient.invalidateQueries({ queryKey: blogQueryKeys.posts.lists() })
    },
  })
}

/**
 * Hook to fetch all categories
 */
export function useBlogCategories() {
  return useQuery({
    queryKey: blogQueryKeys.categories.all,
    queryFn: () => BlogService.getCategories(),
    staleTime: 30 * 60 * 1000, // 30 minutes
  })
}

/**
 * Hook to fetch a category by slug
 */
export function useBlogCategory(slug: string) {
  return useQuery({
    queryKey: blogQueryKeys.categories.detail(slug),
    queryFn: () => BlogService.getCategoryBySlug(slug),
    enabled: !!slug,
    staleTime: 30 * 60 * 1000, // 30 minutes
  })
}

/**
 * Hook to fetch all tags
 */
export function useBlogTags() {
  return useQuery({
    queryKey: blogQueryKeys.tags.all,
    queryFn: () => BlogService.getTags(),
    staleTime: 30 * 60 * 1000, // 30 minutes
  })
}

/**
 * Hook to fetch a tag by slug
 */
export function useBlogTag(slug: string) {
  return useQuery({
    queryKey: blogQueryKeys.tags.detail(slug),
    queryFn: () => BlogService.getTagBySlug(slug),
    enabled: !!slug,
    staleTime: 30 * 60 * 1000, // 30 minutes
  })
}

/**
 * Hook to fetch popular tags
 */
export function usePopularTags(limit = 10) {
  return useQuery({
    queryKey: blogQueryKeys.tags.popular(),
    queryFn: () => BlogService.getPopularTags(limit),
    staleTime: 15 * 60 * 1000, // 15 minutes
  })
}

/**
 * Hook to fetch author profile
 */
export function useAuthorProfile(userId: string) {
  return useQuery({
    queryKey: blogQueryKeys.authors.profile(userId),
    queryFn: () => BlogService.getAuthorProfile(userId),
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

/**
 * Hook to update author profile
 */
export function useUpdateAuthorProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, updates }: { userId: string; updates: Partial<BlogAuthorUpdate> }) =>
      BlogService.updateAuthorProfile(userId, updates),
    onSuccess: (_, variables) => {
      // Invalidate author profile
      queryClient.invalidateQueries({
        queryKey: blogQueryKeys.authors.profile(variables.userId),
      })
    },
  })
}

/**
 * Hook to fetch comments
 */
export function useComments(params: GetCommentsParams) {
  return useQuery({
    queryKey: blogQueryKeys.comments.list(params),
    queryFn: () => BlogService.getComments(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

/**
 * Hook to create a comment
 */
export function useCreateComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateCommentData) => BlogService.createComment(data),
    onSuccess: (_, variables) => {
      // Invalidate comments for the post
      queryClient.invalidateQueries({
        queryKey: blogQueryKeys.comments.list({ postId: variables.post_id }),
      })
    },
  })
}

/**
 * Hook to moderate a comment
 */
export function useModerateComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: ModerateCommentData) => BlogService.moderateComment(data),
    onSuccess: () => {
      // Invalidate all comments lists
      queryClient.invalidateQueries({
        queryKey: blogQueryKeys.comments.all,
      })
    },
  })
}

/**
 * Hook to fetch blog statistics
 */
export function useBlogStatistics(authorId?: string) {
  return useQuery({
    queryKey: authorId 
      ? blogQueryKeys.statistics.author(authorId)
      : blogQueryKeys.statistics.global(),
    queryFn: () => BlogService.getStatistics(authorId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to prefetch a blog post
 */
export function usePrefetchBlogPost() {
  const queryClient = useQueryClient()

  return (params: GetBlogPostParams) => {
    return queryClient.prefetchQuery({
      queryKey: blogQueryKeys.posts.detail(params.slug),
      queryFn: () => BlogService.getPost(params),
      staleTime: 10 * 60 * 1000, // 10 minutes
    })
  }
}

/**
 * Hook for optimistic updates when creating/updating posts
 */
export function useOptimisticPost() {
  const queryClient = useQueryClient()

  const optimisticCreate = (data: CreateBlogPostData) => {
    // Add optimistic post to cache
    queryClient.setQueryData(
      blogQueryKeys.posts.lists(),
      (old: any) => {
        if (!old) return old
        return {
          ...old,
          data: [
            {
              id: 'temp-' + Date.now(),
              ...data,
              slug: data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              view_count: 0,
              author_id: 'current-user', // This should come from auth context
            },
            ...old.data,
          ],
        }
      }
    )
  }

  const optimisticUpdate = (data: UpdateBlogPostData) => {
    // Update post in cache optimistically
    queryClient.setQueryData(
      blogQueryKeys.posts.lists(),
      (old: any) => {
        if (!old) return old
        return {
          ...old,
          data: old.data.map((post: any) =>
            post.id === data.id
              ? { ...post, ...data, updated_at: new Date().toISOString() }
              : post
          ),
        }
      }
    )
  }

  return { optimisticCreate, optimisticUpdate }
}
```

---


## File: `src/hooks/useBlogRealtime.ts`

```typescript
import { useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRealtimeSubscription } from './useRealtimeSubscription'
import { blogQueryKeys } from './useBlog'
import type { BlogPost, BlogComment } from '../types/blog'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

/**
 * Hook to subscribe to new blog posts in real-time
 */
export function useNewBlogPosts(options?: {
  authorId?: string
  categoryId?: string
  enabled?: boolean
  onNewPost?: (post: BlogPost) => void
}) {
  const queryClient = useQueryClient()
  const { authorId, categoryId, enabled = true, onNewPost } = options || {}

  // Build filter string
  const filters: string[] = ['status=eq.published']
  if (authorId) filters.push(`author_id=eq.${authorId}`)
  
  const handleInsert = useCallback(
    (payload: RealtimePostgresChangesPayload<BlogPost>) => {
      if (payload.new) {
        // Call custom handler if provided
        onNewPost?.(payload.new as BlogPost)

        // Invalidate posts list to show new post
        queryClient.invalidateQueries({ 
          queryKey: blogQueryKeys.posts.lists() 
        })
      }
    },
    [queryClient, onNewPost]
  )

  return useRealtimeSubscription({
    table: 'blog_posts',
    filter: filters.join(' AND '),
    event: 'INSERT',
    enabled,
    onInsert: handleInsert,
  })
}

/**
 * Hook to subscribe to updates for a specific blog post
 */
export function useBlogPostUpdates(postId: string, options?: {
  enabled?: boolean
  onUpdate?: (post: BlogPost) => void
}) {
  const queryClient = useQueryClient()
  const { enabled = true, onUpdate } = options || {}

  const handleUpdate = useCallback(
    (payload: RealtimePostgresChangesPayload<BlogPost>) => {
      if (payload.new) {
        const updatedPost = payload.new as BlogPost
        
        // Call custom handler if provided
        onUpdate?.(updatedPost)

        // Update the specific post in cache
        queryClient.setQueryData(
          blogQueryKeys.posts.detail(updatedPost.slug),
          updatedPost
        )

        // Invalidate posts list
        queryClient.invalidateQueries({ 
          queryKey: blogQueryKeys.posts.lists() 
        })
      }
    },
    [queryClient, onUpdate]
  )

  return useRealtimeSubscription({
    table: 'blog_posts',
    filter: `id=eq.${postId}`,
    event: 'UPDATE',
    enabled: enabled && !!postId,
    onUpdate: handleUpdate,
  })
}

/**
 * Hook to subscribe to new comments on a blog post
 */
export function useBlogComments(postId: string, options?: {
  enabled?: boolean
  onNewComment?: (comment: BlogComment) => void
  onCommentUpdate?: (comment: BlogComment) => void
  onCommentDelete?: (comment: BlogComment) => void
}) {
  const queryClient = useQueryClient()
  const { 
    enabled = true, 
    onNewComment, 
    onCommentUpdate, 
    onCommentDelete 
  } = options || {}

  const handleInsert = useCallback(
    (payload: RealtimePostgresChangesPayload<BlogComment>) => {
      if (payload.new) {
        const newComment = payload.new as BlogComment
        
        // Call custom handler if provided
        onNewComment?.(newComment)

        // Invalidate comments for this post
        queryClient.invalidateQueries({ 
          queryKey: blogQueryKeys.comments.list({ postId }) 
        })

        // Update post comment count if needed
        queryClient.invalidateQueries({ 
          queryKey: blogQueryKeys.posts.detail(postId) 
        })
      }
    },
    [queryClient, postId, onNewComment]
  )

  const handleUpdate = useCallback(
    (payload: RealtimePostgresChangesPayload<BlogComment>) => {
      if (payload.new) {
        const updatedComment = payload.new as BlogComment
        
        // Call custom handler if provided
        onCommentUpdate?.(updatedComment)

        // Invalidate comments for this post
        queryClient.invalidateQueries({ 
          queryKey: blogQueryKeys.comments.list({ postId }) 
        })
      }
    },
    [queryClient, postId, onCommentUpdate]
  )

  const handleDelete = useCallback(
    (payload: RealtimePostgresChangesPayload<BlogComment>) => {
      if (payload.old) {
        const deletedComment = payload.old as BlogComment
        
        // Call custom handler if provided
        onCommentDelete?.(deletedComment)

        // Invalidate comments for this post
        queryClient.invalidateQueries({ 
          queryKey: blogQueryKeys.comments.list({ postId }) 
        })

        // Update post comment count
        queryClient.invalidateQueries({ 
          queryKey: blogQueryKeys.posts.detail(postId) 
        })
      }
    },
    [queryClient, postId, onCommentDelete]
  )

  return useRealtimeSubscription({
    table: 'blog_comments',
    filter: `post_id=eq.${postId}`,
    enabled: enabled && !!postId,
    onInsert: handleInsert,
    onUpdate: handleUpdate,
    onDelete: handleDelete,
  })
}

/**
 * Hook to subscribe to author profile updates
 */
export function useAuthorUpdates(authorId: string, options?: {
  enabled?: boolean
  onUpdate?: (author: any) => void
}) {
  const queryClient = useQueryClient()
  const { enabled = true, onUpdate } = options || {}

  const handleUpdate = useCallback(
    (payload: RealtimePostgresChangesPayload<any>) => {
      if (payload.new) {
        // Call custom handler if provided
        onUpdate?.(payload.new)

        // Invalidate author profile
        queryClient.invalidateQueries({ 
          queryKey: blogQueryKeys.authors.profile(authorId) 
        })

        // Invalidate posts by this author
        queryClient.invalidateQueries({ 
          queryKey: blogQueryKeys.posts.lists() 
        })
      }
    },
    [queryClient, authorId, onUpdate]
  )

  return useRealtimeSubscription({
    table: 'blog_authors',
    filter: `id=eq.${authorId}`,
    event: 'UPDATE',
    enabled: enabled && !!authorId,
    onUpdate: handleUpdate,
  })
}

/**
 * Hook to subscribe to blog statistics updates
 */
export function useBlogStatsRealtime(options?: {
  authorId?: string
  enabled?: boolean
  aggregationWindow?: number
}) {
  const queryClient = useQueryClient()
  const { authorId, enabled = true, aggregationWindow = 5000 } = options || {}

  // For global stats, we'll need to listen to multiple tables
  const postsSubscription = useRealtimeSubscription({
    table: 'blog_posts',
    filter: authorId ? `author_id=eq.${authorId}` : undefined,
    enabled,
    onChange: () => {
      // Debounce stats invalidation
      setTimeout(() => {
        queryClient.invalidateQueries({ 
          queryKey: authorId 
            ? blogQueryKeys.statistics.author(authorId)
            : blogQueryKeys.statistics.global()
        })
      }, aggregationWindow)
    },
  })

  const commentsSubscription = useRealtimeSubscription({
    table: 'blog_comments',
    enabled: enabled && !authorId, // Only for global stats
    onChange: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ 
          queryKey: blogQueryKeys.statistics.global()
        })
      }, aggregationWindow)
    },
  })

  return {
    postsSubscription,
    commentsSubscription,
    isConnected: postsSubscription.isConnected && (!authorId || commentsSubscription.isConnected),
    error: postsSubscription.error || commentsSubscription.error,
  }
}

/**
 * Hook to subscribe to all blog-related real-time updates for a dashboard
 */
export function useBlogDashboardRealtime(options?: {
  authorId?: string
  enabled?: boolean
}) {
  const { authorId, enabled = true } = options || {}

  // Subscribe to new posts
  const newPosts = useNewBlogPosts({
    authorId,
    enabled,
  })

  // Subscribe to stats updates
  const stats = useBlogStatsRealtime({
    authorId,
    enabled,
    aggregationWindow: 10000, // 10 seconds for dashboard
  })

  // Subscribe to new comments on author's posts if authorId is provided
  const comments = useRealtimeSubscription({
    table: 'blog_comments',
    enabled: enabled && !!authorId,
    onInsert: (payload) => {
      // Could show a notification here
      console.log('New comment on your post:', payload.new)
    },
  })

  return {
    newPosts,
    stats,
    comments,
    isConnected: newPosts.isConnected && stats.isConnected && comments.isConnected,
    error: newPosts.error || stats.error || comments.error,
  }
}
```

---


## File: `src/store/blogStore.ts`

```typescript
import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import type { 
  BlogPostFilters, 
  BlogPostSort, 
  PostStatus,
  CreateBlogPostData 
} from '../types/blog'

interface BlogEditorState {
  // Draft post data
  draft: Partial<CreateBlogPostData> | null
  isDraftSaved: boolean
  lastSavedAt: Date | null

  // Editor preferences
  editorMode: 'markdown' | 'wysiwyg'
  previewMode: 'desktop' | 'mobile' | 'split'
  sidebarOpen: boolean
  wordWrapEnabled: boolean
  autosaveEnabled: boolean
  autosaveInterval: number // in seconds

  // Actions
  setDraft: (draft: Partial<CreateBlogPostData>) => void
  updateDraft: (updates: Partial<CreateBlogPostData>) => void
  clearDraft: () => void
  markDraftSaved: () => void
  setEditorMode: (mode: 'markdown' | 'wysiwyg') => void
  setPreviewMode: (mode: 'desktop' | 'mobile' | 'split') => void
  toggleSidebar: () => void
  setWordWrap: (enabled: boolean) => void
  setAutosave: (enabled: boolean, interval?: number) => void
}

interface BlogFilterState {
  // Current filters
  filters: BlogPostFilters
  sort: BlogPostSort
  searchQuery: string
  
  // Pagination
  currentPage: number
  pageSize: number

  // Selected items
  selectedPostIds: string[]
  selectedCategoryId: string | null
  selectedTagId: string | null

  // Actions
  setFilters: (filters: Partial<BlogPostFilters>) => void
  resetFilters: () => void
  setSort: (sort: BlogPostSort) => void
  setSearchQuery: (query: string) => void
  setCurrentPage: (page: number) => void
  setPageSize: (size: number) => void
  togglePostSelection: (postId: string) => void
  selectAllPosts: (postIds: string[]) => void
  clearPostSelection: () => void
  setSelectedCategory: (categoryId: string | null) => void
  setSelectedTag: (tagId: string | null) => void
}

interface BlogUIState {
  // Layout preferences
  viewMode: 'grid' | 'list' | 'compact'
  showFilters: boolean
  showMetrics: boolean
  
  // Modal states
  isCreateModalOpen: boolean
  isEditModalOpen: boolean
  editingPostId: string | null
  isDeleteModalOpen: boolean
  deletingPostId: string | null
  
  // Feature toggles
  enableComments: boolean
  enableRealtime: boolean
  showDrafts: boolean

  // Actions
  setViewMode: (mode: 'grid' | 'list' | 'compact') => void
  toggleFilters: () => void
  toggleMetrics: () => void
  openCreateModal: () => void
  closeCreateModal: () => void
  openEditModal: (postId: string) => void
  closeEditModal: () => void
  openDeleteModal: (postId: string) => void
  closeDeleteModal: () => void
  setEnableComments: (enabled: boolean) => void
  setEnableRealtime: (enabled: boolean) => void
  setShowDrafts: (show: boolean) => void
}

// Editor Store - Persisted for draft recovery
export const useBlogEditorStore = create<BlogEditorState>()(
  persist(
    subscribeWithSelector((set) => ({
      // Initial state
      draft: null,
      isDraftSaved: true,
      lastSavedAt: null,
      editorMode: 'markdown',
      previewMode: 'split',
      sidebarOpen: true,
      wordWrapEnabled: true,
      autosaveEnabled: true,
      autosaveInterval: 30,

      // Actions
      setDraft: (draft) => set({ 
        draft, 
        isDraftSaved: false 
      }),
      
      updateDraft: (updates) => set((state) => ({ 
        draft: state.draft ? { ...state.draft, ...updates } : updates,
        isDraftSaved: false 
      })),
      
      clearDraft: () => set({ 
        draft: null, 
        isDraftSaved: true,
        lastSavedAt: null 
      }),
      
      markDraftSaved: () => set({ 
        isDraftSaved: true, 
        lastSavedAt: new Date() 
      }),
      
      setEditorMode: (mode) => set({ editorMode: mode }),
      
      setPreviewMode: (mode) => set({ previewMode: mode }),
      
      toggleSidebar: () => set((state) => ({ 
        sidebarOpen: !state.sidebarOpen 
      })),
      
      setWordWrap: (enabled) => set({ wordWrapEnabled: enabled }),
      
      setAutosave: (enabled, interval) => set({ 
        autosaveEnabled: enabled,
        ...(interval && { autosaveInterval: interval })
      }),
    })),
    {
      name: 'blog-editor-storage',
      partialize: (state) => ({
        draft: state.draft,
        editorMode: state.editorMode,
        previewMode: state.previewMode,
        wordWrapEnabled: state.wordWrapEnabled,
        autosaveEnabled: state.autosaveEnabled,
        autosaveInterval: state.autosaveInterval,
      }),
    }
  )
)

// Filter Store - Session only
export const useBlogFilterStore = create<BlogFilterState>((set) => ({
  // Initial state
  filters: {},
  sort: { by: 'published_at', order: 'desc' },
  searchQuery: '',
  currentPage: 1,
  pageSize: 10,
  selectedPostIds: [],
  selectedCategoryId: null,
  selectedTagId: null,

  // Actions
  setFilters: (filters) => set((state) => ({ 
    filters: { ...state.filters, ...filters },
    currentPage: 1 // Reset to first page on filter change
  })),
  
  resetFilters: () => set({ 
    filters: {}, 
    searchQuery: '',
    currentPage: 1,
    selectedCategoryId: null,
    selectedTagId: null
  }),
  
  setSort: (sort) => set({ 
    sort,
    currentPage: 1 // Reset to first page on sort change
  }),
  
  setSearchQuery: (query) => set({ 
    searchQuery: query,
    currentPage: 1 // Reset to first page on search
  }),
  
  setCurrentPage: (page) => set({ currentPage: page }),
  
  setPageSize: (size) => set({ 
    pageSize: size,
    currentPage: 1 // Reset to first page on page size change
  }),
  
  togglePostSelection: (postId) => set((state) => ({
    selectedPostIds: state.selectedPostIds.includes(postId)
      ? state.selectedPostIds.filter(id => id !== postId)
      : [...state.selectedPostIds, postId]
  })),
  
  selectAllPosts: (postIds) => set({ selectedPostIds: postIds }),
  
  clearPostSelection: () => set({ selectedPostIds: [] }),
  
  setSelectedCategory: (categoryId) => set({ 
    selectedCategoryId: categoryId,
    filters: categoryId 
      ? { categoryId } 
      : {}
  }),
  
  setSelectedTag: (tagId) => set({ 
    selectedTagId: tagId,
    filters: tagId 
      ? { tagId } 
      : {}
  }),
}))

// UI Store - Persisted for user preferences
export const useBlogUIStore = create<BlogUIState>()(
  persist(
    (set) => ({
      // Initial state
      viewMode: 'grid',
      showFilters: true,
      showMetrics: true,
      isCreateModalOpen: false,
      isEditModalOpen: false,
      editingPostId: null,
      isDeleteModalOpen: false,
      deletingPostId: null,
      enableComments: true,
      enableRealtime: true,
      showDrafts: false,

      // Actions
      setViewMode: (mode) => set({ viewMode: mode }),
      
      toggleFilters: () => set((state) => ({ 
        showFilters: !state.showFilters 
      })),
      
      toggleMetrics: () => set((state) => ({ 
        showMetrics: !state.showMetrics 
      })),
      
      openCreateModal: () => set({ isCreateModalOpen: true }),
      
      closeCreateModal: () => set({ isCreateModalOpen: false }),
      
      openEditModal: (postId) => set({ 
        isEditModalOpen: true, 
        editingPostId: postId 
      }),
      
      closeEditModal: () => set({ 
        isEditModalOpen: false, 
        editingPostId: null 
      }),
      
      openDeleteModal: (postId) => set({ 
        isDeleteModalOpen: true, 
        deletingPostId: postId 
      }),
      
      closeDeleteModal: () => set({ 
        isDeleteModalOpen: false, 
        deletingPostId: null 
      }),
      
      setEnableComments: (enabled) => set({ enableComments: enabled }),
      
      setEnableRealtime: (enabled) => set({ enableRealtime: enabled }),
      
      setShowDrafts: (show) => set({ showDrafts: show }),
    }),
    {
      name: 'blog-ui-storage',
      partialize: (state) => ({
        viewMode: state.viewMode,
        showFilters: state.showFilters,
        showMetrics: state.showMetrics,
        enableComments: state.enableComments,
        enableRealtime: state.enableRealtime,
        showDrafts: state.showDrafts,
      }),
    }
  )
)

// Combined hook for convenience
export function useBlogStore() {
  const editor = useBlogEditorStore()
  const filters = useBlogFilterStore()
  const ui = useBlogUIStore()

  return {
    editor,
    filters,
    ui,
  }
}

// Selectors
export const blogSelectors = {
  // Editor selectors
  hasDraft: (state: BlogEditorState) => state.draft !== null,
  isDraftValid: (state: BlogEditorState) => {
    const draft = state.draft
    return draft?.title && draft?.content && draft?.title.length > 0
  },
  
  // Filter selectors
  hasActiveFilters: (state: BlogFilterState) => {
    return Object.keys(state.filters).length > 0 || state.searchQuery.length > 0
  },
  getActiveFilterCount: (state: BlogFilterState) => {
    let count = Object.keys(state.filters).length
    if (state.searchQuery) count++
    return count
  },
  
  // UI selectors
  hasOpenModals: (state: BlogUIState) => {
    return state.isCreateModalOpen || state.isEditModalOpen || state.isDeleteModalOpen
  },
}
```

---


# Frontend Components


---

## Summary

This document contains all the files created for the Supabase Blog CMS implementation.

### Completed Files:
- Database migration (018_blog_cms_tables.sql)
- Migration documentation (README_blog_migration.md)
- Seed data (seed_blog.sql)
- Implementation guide (SUPABASE_BLOG_CMS_IMPLEMENTATION_GUIDE.md)

### Pending Implementation:
- TypeScript types and services
- Frontend components
- Admin interface
- Advanced features (search, SEO, analytics)

Generated on: 2025-07-29 11:09:24
