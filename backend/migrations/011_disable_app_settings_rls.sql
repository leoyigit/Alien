-- =====================================================
-- ALIEN PORTAL: Fix Settings Access - Disable RLS
-- Run this SQL in Supabase SQL Editor
-- =====================================================

-- The RLS policy approach isn't working with the Python Supabase client
-- Since all /api/settings/* endpoints are protected by @require_role('superadmin'),
-- we can safely disable RLS on this table

-- Disable RLS on app_settings
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
    tablename, 
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity = false THEN '✅ RLS Disabled - Settings will be accessible'
        ELSE '❌ RLS Still Enabled - Settings will be blocked'
    END as status
FROM pg_tables 
WHERE tablename = 'app_settings';

-- Verify settings exist
SELECT count(*) as total_settings FROM app_settings;

-- =====================================================
-- DONE! Refresh Settings page - fields should now appear
-- =====================================================
