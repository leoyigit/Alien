-- =====================================================
-- ALIEN PORTAL: Verify Settings and RLS Configuration
-- Run this SQL in Supabase SQL Editor to diagnose the issue
-- =====================================================

-- 1. Check if settings exist in the database
SELECT 
    key, 
    CASE WHEN value = '' THEN '(empty)' ELSE '(configured)' END as status,
    is_secret,
    description,
    updated_at
FROM app_settings
ORDER BY key;

-- 2. Check current RLS policies on app_settings
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'app_settings';

-- 3. Check if RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'app_settings';

-- 4. Test if service role can bypass RLS
-- This should return rows if service role is working
SET ROLE postgres;  -- Simulate service role
SELECT count(*) as total_settings FROM app_settings;
RESET ROLE;

-- =====================================================
-- Expected Results:
-- - Query 1 should show 7 settings
-- - Query 2 should show the updated policy allowing auth.uid() IS NULL
-- - Query 3 should show rls_enabled = true
-- - Query 4 should return count > 0
-- =====================================================
