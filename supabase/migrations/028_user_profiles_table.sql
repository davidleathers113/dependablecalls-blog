-- Migration: 028_user_profiles_table.sql
-- Description: Create user_profiles table for extended user information with role-based access
-- Author: DCE Platform Team
-- Date: 2025-08-07

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing objects if they exist (for idempotency)
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) CHECK (role IN ('supplier', 'buyer', 'admin', 'network')),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    display_name VARCHAR(200),
    company_name VARCHAR(255),
    phone VARCHAR(20),
    avatar_url TEXT,
    bio TEXT,
    website_url TEXT,
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    email_notifications BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT false,
    sms_notifications BOOLEAN DEFAULT false,
    preferences JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    search_visibility BOOLEAN DEFAULT true, -- Whether profile appears in search results
    last_active_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_profile UNIQUE (user_id)
);

-- Create indexes for performance
CREATE INDEX idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX idx_user_profiles_company ON public.user_profiles(company_name);
CREATE INDEX idx_user_profiles_search_visibility ON public.user_profiles(search_visibility) WHERE search_visibility = true;
CREATE INDEX idx_user_profiles_last_active ON public.user_profiles(last_active_at DESC);
CREATE INDEX idx_user_profiles_created_at ON public.user_profiles(created_at DESC);

-- Add GIN index for JSONB columns for efficient queries
CREATE INDEX idx_user_profiles_preferences_gin ON public.user_profiles USING gin(preferences);
CREATE INDEX idx_user_profiles_metadata_gin ON public.user_profiles USING gin(metadata);

-- Add full-text search capabilities
ALTER TABLE public.user_profiles ADD COLUMN search_vector tsvector;

-- Create function to update search vector
CREATE OR REPLACE FUNCTION update_user_profile_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.display_name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.first_name || ' ' || NEW.last_name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.company_name, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.bio, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.role, '')), 'D');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic search vector updates
CREATE TRIGGER update_user_profile_search_vector_trigger
    BEFORE INSERT OR UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_user_profile_search_vector();

-- Create GIN index for full-text search
CREATE INDEX idx_user_profiles_search_vector ON public.user_profiles USING gin(search_vector);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_user_profiles_updated_at();

-- Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON public.user_profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Policy: Admins can update all profiles
CREATE POLICY "Admins can update all profiles" ON public.user_profiles
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Policy: Network role can view all profiles
CREATE POLICY "Network can view all profiles" ON public.user_profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'network'
        )
    );

-- Policy: Buyers can view supplier profiles (for discovery)
CREATE POLICY "Buyers can view supplier profiles" ON public.user_profiles
    FOR SELECT
    USING (
        role = 'supplier' 
        AND search_visibility = true
        AND EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'buyer'
        )
    );

-- Policy: Suppliers can view buyer profiles (for campaigns)
CREATE POLICY "Suppliers can view buyer profiles" ON public.user_profiles
    FOR SELECT
    USING (
        role = 'buyer'
        AND search_visibility = true
        AND EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'supplier'
        )
    );

-- Policy: New users can insert their own profile
CREATE POLICY "Users can create own profile" ON public.user_profiles
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Extract role from raw_user_meta_data or default to null
    INSERT INTO public.user_profiles (
        user_id,
        role,
        email_notifications,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'role', NULL),
        true,
        NOW(),
        NOW()
    );
    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        -- Profile already exists, do nothing
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-create profile on user signup
CREATE TRIGGER on_auth_user_created_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- Function to sync user email updates
CREATE OR REPLACE FUNCTION public.sync_user_email_to_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the display_name if it was using the old email
    UPDATE public.user_profiles
    SET 
        display_name = CASE 
            WHEN display_name = OLD.email THEN NEW.email
            ELSE display_name
        END,
        updated_at = NOW()
    WHERE user_id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync email changes
CREATE TRIGGER on_auth_user_email_updated
    AFTER UPDATE OF email ON auth.users
    FOR EACH ROW
    WHEN (OLD.email IS DISTINCT FROM NEW.email)
    EXECUTE FUNCTION public.sync_user_email_to_profile();

-- Grant permissions for authenticated users
GRANT SELECT ON public.user_profiles TO authenticated;
GRANT UPDATE (
    first_name, 
    last_name, 
    display_name, 
    company_name, 
    phone, 
    avatar_url, 
    bio, 
    website_url,
    timezone,
    language,
    email_notifications,
    push_notifications,
    sms_notifications,
    preferences,
    search_visibility
) ON public.user_profiles TO authenticated;
GRANT INSERT ON public.user_profiles TO authenticated;

-- Grant permissions for service role (for admin operations)
GRANT ALL ON public.user_profiles TO service_role;

-- Add helpful comments
COMMENT ON TABLE public.user_profiles IS 'Extended user profile information for DCE platform users';
COMMENT ON COLUMN public.user_profiles.role IS 'User role: supplier, buyer, admin, or network';
COMMENT ON COLUMN public.user_profiles.search_visibility IS 'Whether this profile appears in search results';
COMMENT ON COLUMN public.user_profiles.preferences IS 'User preferences in JSON format';
COMMENT ON COLUMN public.user_profiles.metadata IS 'Additional metadata for extensibility';
COMMENT ON COLUMN public.user_profiles.search_vector IS 'Full-text search vector for profile discovery';