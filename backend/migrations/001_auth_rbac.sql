-- =====================================================
-- ALIEN PORTAL: Authentication & RBAC Migration
-- Run this SQL in Supabase SQL Editor
-- =====================================================

-- 1. Create user_role enum
CREATE TYPE user_role AS ENUM ('superadmin', 'internal', 'shopline', 'merchant');

-- 2. Create users table (extends Supabase auth.users)
CREATE TABLE public.portal_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT,
    role user_role NOT NULL DEFAULT 'merchant',
    assigned_projects UUID[] DEFAULT '{}',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Row Level Security for portal_users
ALTER TABLE portal_users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own profile
CREATE POLICY "Users can view own profile" ON portal_users
    FOR SELECT USING (auth.uid() = id);

-- Policy: Superadmin/Internal can view all users
CREATE POLICY "Admin can view all users" ON portal_users
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM portal_users WHERE id = auth.uid() AND role IN ('superadmin', 'internal'))
    );

-- Policy: Only superadmin can insert/update/delete users
CREATE POLICY "Superadmin can manage users" ON portal_users
    FOR ALL USING (
        EXISTS (SELECT 1 FROM portal_users WHERE id = auth.uid() AND role = 'superadmin')
    );

-- 4. Create settings table (for API keys)
CREATE TABLE public.app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    is_secret BOOLEAN DEFAULT true,
    description TEXT,
    updated_by UUID REFERENCES portal_users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Restrict settings to superadmin only
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only superadmin can access settings" ON app_settings
    FOR ALL USING (
        EXISTS (SELECT 1 FROM portal_users WHERE id = auth.uid() AND role = 'superadmin')
    );

-- 5. Function to get current user role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role AS $$
    SELECT role FROM portal_users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 6. Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    user_role_val user_role;
BEGIN
    -- Auto-assign role based on email domain
    IF NEW.email LIKE '%@flyrank.com' OR NEW.email LIKE '%@powercommerce.com' THEN
        user_role_val := 'internal';
    ELSIF NEW.email LIKE '%@shopline.com' THEN
        user_role_val := 'shopline';
    ELSE
        user_role_val := 'merchant';
    END IF;

    INSERT INTO public.portal_users (id, email, display_name, role)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), user_role_val);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Insert initial settings (optional defaults)
INSERT INTO app_settings (key, value, is_secret, description) VALUES
    ('SLACK_BOT_TOKEN', '', true, 'Slack Bot OAuth Token'),
    ('SLACK_SIGNING_SECRET', '', true, 'Slack App Signing Secret'),
    ('OPENAI_API_KEY', '', true, 'OpenAI API Key for AI features')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- MANUAL STEP: After first signup as leo@flyrank.com
-- Run this to promote yourself to superadmin:
-- 
-- UPDATE portal_users SET role = 'superadmin' WHERE email = 'leo@flyrank.com';
-- =====================================================
