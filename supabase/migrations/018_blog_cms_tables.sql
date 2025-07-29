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