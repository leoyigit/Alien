-- =====================================================
-- ALIEN PORTAL: Fix Portal Users Access - Disable RLS
-- Run this SQL in Supabase SQL Editor
-- =====================================================

-- Similar to app_settings, the portal_users table has RLS enabled
-- which is blocking the /auth/users endpoint even with service role key
-- Since the endpoint is protected by @require_role('superadmin'),
-- we can safely disable RLS

-- Disable RLS on portal_users
ALTER TABLE portal_users DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
    tablename, 
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity = false THEN '✅ RLS Disabled - Users will be accessible'
        ELSE '❌ RLS Still Enabled - Users will be blocked'
    END as status
FROM pg_tables 
WHERE tablename = 'portal_users';

-- Verify users exist
SELECT count(*) as total_users FROM portal_users;

-- Show all users (for verification)
SELECT id, email, display_name, role, status, created_at 
FROM portal_users 
ORDER BY created_at DESC;

-- =====================================================
-- DONE! Refresh Settings page and click Portal Users tab
-- =====================================================
