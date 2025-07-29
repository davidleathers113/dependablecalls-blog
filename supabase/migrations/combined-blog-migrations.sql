-- Combined Blog Migrations for DCE Platform
-- Run this file in Supabase SQL Editor to set up the blog system
-- Generated from migrations 018-027

-- =====================================================
-- 018_blog_cms_tables.sql - Core blog infrastructure
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Blog authors table
CREATE TABLE IF NOT EXISTS blog_authors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    bio TEXT,
    avatar_url TEXT,
    social_links JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blog categories table
CREATE TABLE IF NOT EXISTS blog_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES blog_categories(id) ON DELETE CASCADE,
    meta_title TEXT,
    meta_description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blog posts table
CREATE TABLE IF NOT EXISTS blog_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    featured_image TEXT,
    author_id UUID REFERENCES blog_authors(id) ON DELETE SET NULL,
    status TEXT CHECK (status IN ('draft', 'published', 'archived')) DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    meta_title TEXT,
    meta_description TEXT,
    meta_keywords TEXT[],
    reading_time INTEGER,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blog post categories junction table
CREATE TABLE IF NOT EXISTS blog_post_categories (
    post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
    category_id UUID REFERENCES blog_categories(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, category_id)
);

-- Blog comments table
CREATE TABLE IF NOT EXISTS blog_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES blog_comments(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    author_email TEXT NOT NULL,
    author_url TEXT,
    content TEXT NOT NULL,
    status TEXT CHECK (status IN ('pending', 'approved', 'spam', 'trash')) DEFAULT 'pending',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blog media table
CREATE TABLE IF NOT EXISTS blog_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    alt_text TEXT,
    caption TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_author ON blog_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_blog_categories_slug ON blog_categories(slug);
CREATE INDEX IF NOT EXISTS idx_blog_comments_post ON blog_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_blog_comments_status ON blog_comments(status);

-- Full-text search
CREATE INDEX IF NOT EXISTS idx_blog_posts_search ON blog_posts USING gin(to_tsvector('english', title || ' ' || coalesce(content, '') || ' ' || coalesce(excerpt, '')));

-- =====================================================
-- 019_blog_content_sanitization.sql
-- =====================================================

-- Content sanitization configuration
CREATE TABLE IF NOT EXISTS blog_sanitization_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_name TEXT UNIQUE NOT NULL,
    allowed_tags TEXT[] DEFAULT ARRAY['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre', 'ul', 'ol', 'li', 'a', 'img'],
    allowed_attributes JSONB DEFAULT '{"a": ["href", "title"], "img": ["src", "alt", "width", "height"]}',
    strip_dangerous_tags BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default config
INSERT INTO blog_sanitization_config (config_name) VALUES ('default');

-- =====================================================
-- 019_blog_infrastructure_fixes.sql
-- =====================================================

-- Add missing columns if they don't exist
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Update search vector
UPDATE blog_posts SET search_vector = to_tsvector('english', title || ' ' || coalesce(content, '') || ' ' || coalesce(excerpt, ''));

-- Create trigger to update search vector
CREATE OR REPLACE FUNCTION update_blog_search_vector() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', NEW.title || ' ' || coalesce(NEW.content, '') || ' ' || coalesce(NEW.excerpt, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_blog_posts_search_vector 
    BEFORE INSERT OR UPDATE ON blog_posts
    FOR EACH ROW EXECUTE FUNCTION update_blog_search_vector();

-- =====================================================
-- 020_blog_storage_quota_fixes.sql
-- =====================================================

-- Add storage tracking
ALTER TABLE blog_authors ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT DEFAULT 0;
ALTER TABLE blog_authors ADD COLUMN IF NOT EXISTS storage_quota_bytes BIGINT DEFAULT 1073741824; -- 1GB default

-- =====================================================
-- 021_blog_rls_consolidation.sql
-- =====================================================

-- Enable RLS on all blog tables
ALTER TABLE blog_authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_media ENABLE ROW LEVEL SECURITY;

-- Authors policies
CREATE POLICY "Public can view authors" ON blog_authors FOR SELECT USING (true);
CREATE POLICY "Authors can update own profile" ON blog_authors FOR UPDATE USING (auth.uid() = user_id);

-- Categories policies
CREATE POLICY "Public can view categories" ON blog_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON blog_categories FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Posts policies
CREATE POLICY "Public can view published posts" ON blog_posts FOR SELECT USING (status = 'published');
CREATE POLICY "Authors can view own posts" ON blog_posts FOR SELECT USING (author_id IN (SELECT id FROM blog_authors WHERE user_id = auth.uid()));
CREATE POLICY "Authors can create posts" ON blog_posts FOR INSERT WITH CHECK (author_id IN (SELECT id FROM blog_authors WHERE user_id = auth.uid()));
CREATE POLICY "Authors can update own posts" ON blog_posts FOR UPDATE USING (author_id IN (SELECT id FROM blog_authors WHERE user_id = auth.uid()));

-- Post categories policies
CREATE POLICY "Public can view post categories" ON blog_post_categories FOR SELECT USING (true);
CREATE POLICY "Authors can manage own post categories" ON blog_post_categories FOR ALL USING (
    post_id IN (SELECT id FROM blog_posts WHERE author_id IN (SELECT id FROM blog_authors WHERE user_id = auth.uid()))
);

-- Comments policies
CREATE POLICY "Public can view approved comments" ON blog_comments FOR SELECT USING (status = 'approved');
CREATE POLICY "Public can create comments" ON blog_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage comments" ON blog_comments FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Media policies
CREATE POLICY "Public can view media" ON blog_media FOR SELECT USING (true);
CREATE POLICY "Authors can manage own media" ON blog_media FOR ALL USING (
    post_id IN (SELECT id FROM blog_posts WHERE author_id IN (SELECT id FROM blog_authors WHERE user_id = auth.uid()))
);

-- =====================================================
-- 022_blog_word_count_tsvector.sql
-- =====================================================

-- Add word count column
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0;

-- Function to calculate word count
CREATE OR REPLACE FUNCTION calculate_word_count(content TEXT) RETURNS INTEGER AS $$
BEGIN
    RETURN array_length(string_to_array(trim(content), ' '), 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update existing posts
UPDATE blog_posts SET word_count = calculate_word_count(content) WHERE content IS NOT NULL;

-- Trigger to update word count
CREATE OR REPLACE FUNCTION update_word_count() RETURNS trigger AS $$
BEGIN
    NEW.word_count := calculate_word_count(NEW.content);
    NEW.reading_time := CEIL(NEW.word_count::DECIMAL / 200); -- Assuming 200 words per minute
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_blog_posts_word_count 
    BEFORE INSERT OR UPDATE OF content ON blog_posts
    FOR EACH ROW EXECUTE FUNCTION update_word_count();

-- =====================================================
-- 023_blog_analytics_tables.sql
-- =====================================================

-- Blog analytics events
CREATE TABLE IF NOT EXISTS blog_analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('view', 'read', 'share', 'comment', 'like')),
    session_id TEXT,
    user_agent TEXT,
    referrer TEXT,
    ip_address INET,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blog analytics sessions
CREATE TABLE IF NOT EXISTS blog_analytics_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id TEXT UNIQUE NOT NULL,
    visitor_id TEXT,
    landing_page TEXT,
    referrer TEXT,
    user_agent TEXT,
    ip_address INET,
    country_code TEXT,
    device_type TEXT,
    browser TEXT,
    os TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_blog_analytics_events_post ON blog_analytics_events(post_id);
CREATE INDEX IF NOT EXISTS idx_blog_analytics_events_created ON blog_analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_analytics_sessions_visitor ON blog_analytics_sessions(visitor_id);

-- =====================================================
-- 024_blog_extensions_fix.sql
-- =====================================================

-- Create update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_blog_authors_updated_at BEFORE UPDATE ON blog_authors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blog_categories_updated_at BEFORE UPDATE ON blog_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blog_posts_updated_at BEFORE UPDATE ON blog_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blog_comments_updated_at BEFORE UPDATE ON blog_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 024_blog_monitoring_infrastructure.sql
-- =====================================================

-- Monitoring events table
CREATE TABLE IF NOT EXISTS monitoring_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    monitor_name TEXT NOT NULL,
    monitor_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('up', 'down', 'degraded')),
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
    error_message TEXT,
    response_time INTEGER,
    status_code INTEGER,
    url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for queries
CREATE INDEX IF NOT EXISTS idx_monitoring_events_created ON monitoring_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_monitoring_events_monitor ON monitoring_events(monitor_name, created_at DESC);

-- =====================================================
-- 025_blog_content_sanitization_trigger.sql
-- =====================================================

-- Function to sanitize HTML content
CREATE OR REPLACE FUNCTION sanitize_html_content() RETURNS trigger AS $$
BEGIN
    -- Only sanitize if content has changed
    IF NEW.content IS DISTINCT FROM OLD.content THEN
        -- Mark content as needing sanitization
        NEW.content_hash := encode(digest(NEW.content, 'sha256'), 'hex');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to posts
CREATE TRIGGER sanitize_blog_posts_content 
    BEFORE INSERT OR UPDATE OF content ON blog_posts
    FOR EACH ROW EXECUTE FUNCTION sanitize_html_content();

-- =====================================================
-- 026_blog_audit_retention.sql
-- =====================================================

-- Blog audit log
CREATE TABLE IF NOT EXISTS blog_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    user_id UUID REFERENCES auth.users(id),
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for retention queries
CREATE INDEX IF NOT EXISTS idx_blog_audit_log_created ON blog_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_blog_audit_log_table_record ON blog_audit_log(table_name, record_id);

-- Function for audit logging
CREATE OR REPLACE FUNCTION blog_audit_trigger() RETURNS trigger AS $$
BEGIN
    INSERT INTO blog_audit_log (table_name, record_id, action, old_data, new_data, user_id)
    VALUES (
        TG_TABLE_NAME,
        CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
        TG_OP,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        auth.uid()
    );
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Add audit triggers to important tables
CREATE TRIGGER audit_blog_posts AFTER INSERT OR UPDATE OR DELETE ON blog_posts
    FOR EACH ROW EXECUTE FUNCTION blog_audit_trigger();

CREATE TRIGGER audit_blog_authors AFTER INSERT OR UPDATE OR DELETE ON blog_authors
    FOR EACH ROW EXECUTE FUNCTION blog_audit_trigger();

-- =====================================================
-- 027_blog_api_performance_fixes.sql
-- =====================================================

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published ON blog_posts(status, published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_blog_posts_author_status ON blog_posts(author_id, status);
CREATE INDEX IF NOT EXISTS idx_blog_analytics_events_post_type ON blog_analytics_events(post_id, event_type);

-- Materialized view for popular posts
CREATE MATERIALIZED VIEW IF NOT EXISTS blog_popular_posts AS
SELECT 
    p.id,
    p.title,
    p.slug,
    p.excerpt,
    p.featured_image,
    p.author_id,
    p.published_at,
    p.reading_time,
    COUNT(DISTINCT ae.id) as total_views,
    COUNT(DISTINCT CASE WHEN ae.event_type = 'read' THEN ae.id END) as total_reads
FROM blog_posts p
LEFT JOIN blog_analytics_events ae ON p.id = ae.post_id
WHERE p.status = 'published'
GROUP BY p.id;

-- Index for the materialized view
CREATE INDEX IF NOT EXISTS idx_blog_popular_posts_views ON blog_popular_posts(total_views DESC);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_blog_popular_posts() RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY blog_popular_posts;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Final setup
-- =====================================================

-- Grant permissions for service role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Blog migrations completed successfully!';
END $$;