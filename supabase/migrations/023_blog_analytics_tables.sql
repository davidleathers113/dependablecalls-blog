-- =====================================================
-- Blog Analytics Tables Migration
-- =====================================================
-- This migration creates comprehensive analytics tables
-- for the blog system to support detailed tracking
-- and performance optimization
-- =====================================================

-- =====================================================
-- Core Analytics Tables
-- =====================================================

-- Page Views Analytics
CREATE TABLE blog_page_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_slug TEXT NOT NULL,
  session_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  user_id UUID REFERENCES users(id),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  referrer TEXT,
  user_agent TEXT,
  viewport_width INTEGER,
  viewport_height INTEGER,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  is_unique_view BOOLEAN DEFAULT TRUE,
  ip_address INET,
  country_code CHAR(2),
  city TEXT,
  device_type TEXT CHECK (device_type IN ('desktop', 'mobile', 'tablet')),
  browser_name TEXT,
  os_name TEXT
);

-- Reading Progress Analytics
CREATE TABLE blog_reading_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_slug TEXT NOT NULL,
  session_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  scroll_depth DECIMAL(3,2) CHECK (scroll_depth >= 0 AND scroll_depth <= 1),
  time_spent INTEGER NOT NULL, -- milliseconds
  reading_speed DECIMAL(8,2), -- words per minute
  completion_rate DECIMAL(3,2) CHECK (completion_rate >= 0 AND completion_rate <= 1),
  viewport_height INTEGER,
  content_height INTEGER
);

-- Engagement Events Analytics
CREATE TABLE blog_engagement_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('cta_click', 'newsletter_signup', 'comment_posted', 'share_click', 'like', 'bookmark')),
  post_slug TEXT NOT NULL,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES users(id),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  element_id TEXT,
  element_text TEXT,
  target_url TEXT,
  share_platform TEXT, -- for share events
  metadata JSONB DEFAULT '{}'
);

-- Search Analytics
CREATE TABLE blog_search_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query TEXT NOT NULL,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES users(id),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  results_count INTEGER NOT NULL DEFAULT 0,
  selected_result_index INTEGER,
  selected_result_slug TEXT,
  time_to_click INTEGER, -- milliseconds from search to click
  no_results BOOLEAN DEFAULT FALSE,
  search_location TEXT DEFAULT 'header' -- header, sidebar, etc.
);

-- Performance Metrics
CREATE TABLE blog_performance_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('page_load', 'image_load', 'first_contentful_paint', 'largest_contentful_paint', 'cumulative_layout_shift')),
  post_slug TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  value DECIMAL(10,2) NOT NULL, -- milliseconds or score
  user_agent TEXT,
  connection_type TEXT,
  device_memory INTEGER, -- GB
  network_effective_type TEXT, -- slow-2g, 2g, 3g, 4g
  is_slow_connection BOOLEAN DEFAULT FALSE
);

-- A/B Test Events
CREATE TABLE blog_ab_test_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  test_name TEXT NOT NULL,
  variant TEXT NOT NULL CHECK (variant IN ('control', 'variant_a', 'variant_b', 'variant_c')),
  post_slug TEXT NOT NULL,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES users(id),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  conversion_event TEXT,
  converted BOOLEAN DEFAULT FALSE,
  conversion_value DECIMAL(10,2) -- for revenue tracking
);

-- User Journey Tracking
CREATE TABLE blog_user_journeys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES users(id),
  page_sequence INTEGER NOT NULL,
  section_type TEXT NOT NULL CHECK (section_type IN ('home', 'post_detail', 'category_list', 'tag_list', 'author_profile', 'search_results')),
  page_slug TEXT,
  entry_time TIMESTAMPTZ NOT NULL,
  exit_time TIMESTAMPTZ,
  time_spent INTEGER, -- milliseconds
  scroll_depth DECIMAL(3,2),
  exit_type TEXT CHECK (exit_type IN ('navigation', 'close', 'bounce', 'conversion'))
);

-- Newsletter Signups (for conversion tracking)
CREATE TABLE blog_newsletter_signups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  session_id TEXT NOT NULL,
  post_slug TEXT, -- post that led to signup
  signup_location TEXT NOT NULL, -- inline, popup, sidebar, footer
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  source_campaign TEXT,
  confirmed BOOLEAN DEFAULT FALSE,
  confirmed_at TIMESTAMPTZ
);

-- =====================================================
-- Aggregated Analytics Views
-- =====================================================

-- Daily Post Analytics Summary
CREATE VIEW blog_daily_post_analytics AS
SELECT 
  post_slug,
  DATE(timestamp) as date,
  COUNT(*) as total_views,
  COUNT(DISTINCT visitor_id) as unique_views,
  COUNT(DISTINCT session_id) as unique_sessions,
  COUNT(CASE WHEN is_unique_view THEN 1 END) as first_time_views,
  COUNT(CASE WHEN referrer LIKE '%google%' THEN 1 END) as google_referrals,
  COUNT(CASE WHEN referrer LIKE '%facebook%' THEN 1 END) as facebook_referrals,
  COUNT(CASE WHEN referrer LIKE '%twitter%' THEN 1 END) as twitter_referrals,
  COUNT(CASE WHEN device_type = 'mobile' THEN 1 END) as mobile_views,
  COUNT(CASE WHEN device_type = 'desktop' THEN 1 END) as desktop_views,
  COUNT(CASE WHEN device_type = 'tablet' THEN 1 END) as tablet_views
FROM blog_page_views
GROUP BY post_slug, DATE(timestamp);

-- Post Engagement Summary
CREATE VIEW blog_post_engagement_summary AS
SELECT 
  post_slug,
  COUNT(CASE WHEN event_type = 'cta_click' THEN 1 END) as cta_clicks,
  COUNT(CASE WHEN event_type = 'newsletter_signup' THEN 1 END) as newsletter_signups,
  COUNT(CASE WHEN event_type = 'share_click' THEN 1 END) as shares,
  COUNT(CASE WHEN event_type = 'comment_posted' THEN 1 END) as comments,
  COUNT(CASE WHEN event_type = 'like' THEN 1 END) as likes,
  COUNT(CASE WHEN event_type = 'bookmark' THEN 1 END) as bookmarks,
  COUNT(DISTINCT session_id) as engaged_sessions
FROM blog_engagement_events
GROUP BY post_slug;

-- Search Performance Summary
CREATE VIEW blog_search_performance AS
SELECT 
  query,
  COUNT(*) as search_count,
  AVG(results_count) as avg_results_count,
  COUNT(CASE WHEN selected_result_index IS NOT NULL THEN 1 END) as clicks,
  ROUND(
    COUNT(CASE WHEN selected_result_index IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 
    2
  ) as click_through_rate,
  COUNT(CASE WHEN no_results THEN 1 END) as no_results_count,
  AVG(time_to_click) FILTER (WHERE time_to_click IS NOT NULL) as avg_time_to_click
FROM blog_search_analytics
GROUP BY query
ORDER BY search_count DESC;

-- =====================================================
-- Indexes for Performance
-- =====================================================

-- Page Views Indexes
CREATE INDEX idx_blog_page_views_post_slug ON blog_page_views(post_slug);
CREATE INDEX idx_blog_page_views_timestamp ON blog_page_views(timestamp);
CREATE INDEX idx_blog_page_views_session_id ON blog_page_views(session_id);
CREATE INDEX idx_blog_page_views_visitor_id ON blog_page_views(visitor_id);
CREATE INDEX idx_blog_page_views_user_id ON blog_page_views(user_id);
CREATE INDEX idx_blog_page_views_date ON blog_page_views(DATE(timestamp));

-- Reading Progress Indexes
CREATE INDEX idx_blog_reading_progress_post_slug ON blog_reading_progress(post_slug);
CREATE INDEX idx_blog_reading_progress_session_id ON blog_reading_progress(session_id);
CREATE INDEX idx_blog_reading_progress_timestamp ON blog_reading_progress(timestamp);

-- Engagement Events Indexes
CREATE INDEX idx_blog_engagement_events_post_slug ON blog_engagement_events(post_slug);
CREATE INDEX idx_blog_engagement_events_event_type ON blog_engagement_events(event_type);
CREATE INDEX idx_blog_engagement_events_timestamp ON blog_engagement_events(timestamp);
CREATE INDEX idx_blog_engagement_events_session_id ON blog_engagement_events(session_id);

-- Search Analytics Indexes
CREATE INDEX idx_blog_search_analytics_query ON blog_search_analytics(query);
CREATE INDEX idx_blog_search_analytics_timestamp ON blog_search_analytics(timestamp);
CREATE INDEX idx_blog_search_analytics_session_id ON blog_search_analytics(session_id);

-- Performance Metrics Indexes
CREATE INDEX idx_blog_performance_metrics_post_slug ON blog_performance_metrics(post_slug);
CREATE INDEX idx_blog_performance_metrics_metric_type ON blog_performance_metrics(metric_type);
CREATE INDEX idx_blog_performance_metrics_timestamp ON blog_performance_metrics(timestamp);

-- A/B Test Indexes
CREATE INDEX idx_blog_ab_test_events_test_name ON blog_ab_test_events(test_name);
CREATE INDEX idx_blog_ab_test_events_variant ON blog_ab_test_events(variant);
CREATE INDEX idx_blog_ab_test_events_session_id ON blog_ab_test_events(session_id);

-- User Journey Indexes
CREATE INDEX idx_blog_user_journeys_session_id ON blog_user_journeys(session_id);
CREATE INDEX idx_blog_user_journeys_entry_time ON blog_user_journeys(entry_time);

-- =====================================================
-- Functions for Analytics Operations
-- =====================================================

-- Function to increment post view count (called from blog-analytics.ts)
CREATE OR REPLACE FUNCTION increment_post_view_count(post_slug TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE blog_posts 
  SET view_count = view_count + 1,
      updated_at = NOW()
  WHERE slug = post_slug AND status = 'published';
  
  -- Log the update for monitoring
  INSERT INTO audit_logs (
    table_name,
    operation,
    record_id,
    changed_data
  ) SELECT 
    'blog_posts',
    'UPDATE',
    id::text,
    jsonb_build_object('field', 'view_count', 'action', 'increment')
  FROM blog_posts 
  WHERE slug = post_slug;
END;
$$;

-- Function to get post analytics summary
CREATE OR REPLACE FUNCTION get_post_analytics_summary(
  p_post_slug TEXT,
  p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  total_views BIGINT,
  unique_views BIGINT,
  avg_time_spent NUMERIC,
  avg_scroll_depth NUMERIC,
  bounce_rate NUMERIC,
  engagement_events BIGINT,
  conversion_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH view_stats AS (
    SELECT 
      COUNT(*) as total_views,
      COUNT(DISTINCT visitor_id) as unique_views
    FROM blog_page_views 
    WHERE post_slug = p_post_slug 
      AND timestamp >= NOW() - INTERVAL '1 day' * p_days_back
  ),
  reading_stats AS (
    SELECT 
      AVG(time_spent) as avg_time_spent,
      AVG(scroll_depth) as avg_scroll_depth
    FROM blog_reading_progress 
    WHERE post_slug = p_post_slug 
      AND timestamp >= NOW() - INTERVAL '1 day' * p_days_back
  ),
  engagement_stats AS (
    SELECT COUNT(*) as engagement_events
    FROM blog_engagement_events 
    WHERE post_slug = p_post_slug 
      AND timestamp >= NOW() - INTERVAL '1 day' * p_days_back
  ),
  journey_stats AS (
    SELECT 
      COUNT(CASE WHEN page_sequence = 1 AND exit_type = 'bounce' THEN 1 END) as bounces,
      COUNT(CASE WHEN page_sequence = 1 THEN 1 END) as entries
    FROM blog_user_journeys 
    WHERE page_slug = p_post_slug 
      AND entry_time >= NOW() - INTERVAL '1 day' * p_days_back
  ),
  conversion_stats AS (
    SELECT COUNT(*) as conversions
    FROM blog_newsletter_signups 
    WHERE post_slug = p_post_slug 
      AND timestamp >= NOW() - INTERVAL '1 day' * p_days_back
  )
  SELECT 
    v.total_views,
    v.unique_views,
    COALESCE(r.avg_time_spent, 0),
    COALESCE(r.avg_scroll_depth, 0),
    CASE 
      WHEN j.entries > 0 THEN ROUND(j.bounces * 100.0 / j.entries, 2)
      ELSE 0
    END as bounce_rate,
    e.engagement_events,
    CASE 
      WHEN v.unique_views > 0 THEN ROUND(c.conversions * 100.0 / v.unique_views, 2)
      ELSE 0
    END as conversion_rate
  FROM view_stats v
  CROSS JOIN reading_stats r
  CROSS JOIN engagement_stats e
  CROSS JOIN journey_stats j
  CROSS JOIN conversion_stats c;
END;
$$;

-- Function to get popular posts
CREATE OR REPLACE FUNCTION get_popular_posts(
  p_days_back INTEGER DEFAULT 7,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  post_slug TEXT,
  post_title TEXT,
  view_count BIGINT,
  unique_views BIGINT,
  engagement_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bp.slug,
    bp.title,
    COUNT(bpv.*) as view_count,
    COUNT(DISTINCT bpv.visitor_id) as unique_views,
    -- Simple engagement score: views + engagements * 5
    (COUNT(bpv.*) + COUNT(bee.*) * 5)::NUMERIC as engagement_score
  FROM blog_posts bp
  LEFT JOIN blog_page_views bpv ON bp.slug = bpv.post_slug 
    AND bpv.timestamp >= NOW() - INTERVAL '1 day' * p_days_back
  LEFT JOIN blog_engagement_events bee ON bp.slug = bee.post_slug 
    AND bee.timestamp >= NOW() - INTERVAL '1 day' * p_days_back
  WHERE bp.status = 'published'
    AND bp.published_at IS NOT NULL
  GROUP BY bp.slug, bp.title
  ORDER BY engagement_score DESC
  LIMIT p_limit;
END;
$$;

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on all analytics tables
ALTER TABLE blog_page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_engagement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_search_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_ab_test_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_user_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_newsletter_signups ENABLE ROW LEVEL SECURITY;

-- Admin full access policies
CREATE POLICY "Admin full access to page views" ON blog_page_views
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND user_metadata->>'userType' = 'admin'
    )
  );

CREATE POLICY "Admin full access to reading progress" ON blog_reading_progress
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND user_metadata->>'userType' = 'admin'
    )
  );

CREATE POLICY "Admin full access to engagement events" ON blog_engagement_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND user_metadata->>'userType' = 'admin'
    )
  );

CREATE POLICY "Admin full access to search analytics" ON blog_search_analytics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND user_metadata->>'userType' = 'admin'
    )
  );

CREATE POLICY "Admin full access to performance metrics" ON blog_performance_metrics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND user_metadata->>'userType' = 'admin'
    )
  );

CREATE POLICY "Admin full access to ab test events" ON blog_ab_test_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND user_metadata->>'userType' = 'admin'
    )
  );

CREATE POLICY "Admin full access to user journeys" ON blog_user_journeys
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND user_metadata->>'userType' = 'admin'
    )
  );

CREATE POLICY "Admin full access to newsletter signups" ON blog_newsletter_signups
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND user_metadata->>'userType' = 'admin'
    )
  );

-- Anonymous insert policies for client-side tracking
CREATE POLICY "Allow anonymous inserts to page views" ON blog_page_views
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous inserts to reading progress" ON blog_reading_progress
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous inserts to engagement events" ON blog_engagement_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous inserts to search analytics" ON blog_search_analytics
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous inserts to performance metrics" ON blog_performance_metrics
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous inserts to ab test events" ON blog_ab_test_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous inserts to user journeys" ON blog_user_journeys
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous inserts to newsletter signups" ON blog_newsletter_signups
  FOR INSERT WITH CHECK (true);

-- Authors can read analytics for their own posts
CREATE POLICY "Authors can read their post analytics" ON blog_page_views
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM blog_posts bp
      JOIN blog_authors ba ON bp.author_id = ba.id
      WHERE bp.slug = post_slug
      AND ba.user_id = auth.uid()
    )
  );

-- =====================================================
-- Data Retention Policy
-- =====================================================

-- Function to clean up old analytics data (GDPR compliance)
CREATE OR REPLACE FUNCTION cleanup_old_analytics_data()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER := 0;
  retention_days INTEGER := 365; -- 1 year retention
BEGIN
  -- Delete old page views
  DELETE FROM blog_page_views 
  WHERE timestamp < NOW() - INTERVAL '1 day' * retention_days;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Delete old reading progress
  DELETE FROM blog_reading_progress 
  WHERE timestamp < NOW() - INTERVAL '1 day' * retention_days;
  
  -- Delete old engagement events
  DELETE FROM blog_engagement_events 
  WHERE timestamp < NOW() - INTERVAL '1 day' * retention_days;
  
  -- Delete old search analytics
  DELETE FROM blog_search_analytics 
  WHERE timestamp < NOW() - INTERVAL '1 day' * retention_days;
  
  -- Delete old performance metrics
  DELETE FROM blog_performance_metrics 
  WHERE timestamp < NOW() - INTERVAL '1 day' * retention_days;
  
  -- Delete old A/B test events
  DELETE FROM blog_ab_test_events 
  WHERE timestamp < NOW() - INTERVAL '1 day' * retention_days;
  
  -- Delete old user journeys
  DELETE FROM blog_user_journeys 
  WHERE entry_time < NOW() - INTERVAL '1 day' * retention_days;
  
  -- Keep newsletter signups longer (they're valuable)
  DELETE FROM blog_newsletter_signups 
  WHERE timestamp < NOW() - INTERVAL '1 day' * (retention_days * 2);
  
  RETURN deleted_count;
END;
$$;

-- =====================================================
-- Triggers and Automation
-- =====================================================

-- Trigger to update blog_posts.updated_at when analytics change
CREATE OR REPLACE FUNCTION update_post_analytics_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update the blog post's updated_at when significant analytics events occur
  IF TG_TABLE_NAME = 'blog_engagement_events' AND NEW.event_type IN ('comment_posted', 'share_click') THEN
    UPDATE blog_posts 
    SET updated_at = NOW() 
    WHERE slug = NEW.post_slug;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_post_analytics_timestamp
  AFTER INSERT ON blog_engagement_events
  FOR EACH ROW
  EXECUTE FUNCTION update_post_analytics_timestamp();

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE blog_page_views IS 'Tracks individual page views with visitor identification';
COMMENT ON TABLE blog_reading_progress IS 'Tracks user reading behavior and engagement depth';
COMMENT ON TABLE blog_engagement_events IS 'Tracks user interactions and conversions';
COMMENT ON TABLE blog_search_analytics IS 'Tracks search queries and result interactions';
COMMENT ON TABLE blog_performance_metrics IS 'Tracks page performance and loading times';
COMMENT ON TABLE blog_ab_test_events IS 'Tracks A/B test participation and conversions';
COMMENT ON TABLE blog_user_journeys IS 'Tracks user navigation paths through the blog';
COMMENT ON TABLE blog_newsletter_signups IS 'Tracks newsletter conversion events';

COMMENT ON FUNCTION increment_post_view_count(TEXT) IS 'Safely increments the view count for a blog post';
COMMENT ON FUNCTION get_post_analytics_summary(TEXT, INTEGER) IS 'Returns comprehensive analytics summary for a specific post';
COMMENT ON FUNCTION get_popular_posts(INTEGER, INTEGER) IS 'Returns most popular posts based on engagement metrics';
COMMENT ON FUNCTION cleanup_old_analytics_data() IS 'Removes old analytics data for GDPR compliance';