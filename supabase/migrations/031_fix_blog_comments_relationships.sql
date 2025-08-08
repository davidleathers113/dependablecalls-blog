-- Fix blog comments table relationships and foreign key constraints
-- This migration addresses PostgREST 400 errors by fixing relationship syntax requirements

BEGIN;

-- =====================================================
-- Add explicit foreign key constraint names for PostgREST
-- =====================================================

-- Add explicit constraint name for self-referencing parent_id relationship
-- This fixes PostgREST "replies:blog_comments!parent_id(count)" syntax
ALTER TABLE blog_comments 
DROP CONSTRAINT IF EXISTS blog_comments_parent_id_fkey;

ALTER TABLE blog_comments 
ADD CONSTRAINT blog_comments_parent_id_fkey 
FOREIGN KEY (parent_id) REFERENCES blog_comments(id) ON DELETE CASCADE;

-- =====================================================
-- Fix user relationship to use user_profiles
-- =====================================================

-- First, check if we need to update the user_id foreign key
-- The blog_comments table currently references "users" but we have "user_profiles"

-- Drop the existing user_id constraint if it exists
ALTER TABLE blog_comments 
DROP CONSTRAINT IF EXISTS blog_comments_user_id_fkey;

-- Add proper foreign key to user_profiles
ALTER TABLE blog_comments 
ADD CONSTRAINT blog_comments_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE SET NULL;

-- =====================================================
-- Create convenience view for PostgREST if needed
-- =====================================================

-- Create a users view that maps to user_profiles for compatibility
-- This allows the existing "user:users(...)" syntax to work
DROP VIEW IF EXISTS public.users;

CREATE VIEW public.users AS
SELECT 
  up.id,
  au.email,
  up.display_name as username,
  up.avatar_url,
  up.first_name,
  up.last_name,
  up.company_name,
  up.role,
  up.created_at,
  up.updated_at
FROM public.user_profiles up
JOIN auth.users au ON au.id = up.user_id;

-- Grant appropriate permissions on the view
GRANT SELECT ON public.users TO anon;
GRANT SELECT ON public.users TO authenticated;

-- =====================================================
-- Add indexes for performance
-- =====================================================

-- Ensure we have proper indexes for the foreign key relationships
CREATE INDEX IF NOT EXISTS idx_blog_comments_parent_id ON blog_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_blog_comments_user_id ON blog_comments(user_id);

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON CONSTRAINT blog_comments_parent_id_fkey ON blog_comments 
IS 'Self-referencing foreign key with explicit constraint name for PostgREST compatibility';

COMMENT ON CONSTRAINT blog_comments_user_id_fkey ON blog_comments 
IS 'References user_profiles table for user information';

COMMENT ON VIEW public.users 
IS 'Compatibility view mapping user_profiles to users for blog comments';

COMMIT;