-- =====================================================
-- ALIEN PORTAL: Fix app_settings RLS Policy
-- Run this SQL in Supabase SQL Editor
-- =====================================================

-- This fixes the issue where service role cannot access app_settings
-- because the RLS policy requires auth.uid() which doesn't exist in service role context

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Only superadmin can access settings" ON app_settings;

-- Create new policy that allows service role access
-- Service role bypasses RLS by having auth.uid() = NULL
CREATE POLICY "Superadmin and service role can access settings" ON app_settings
    FOR ALL USING (
        -- Allow if using service role (no auth context)
        auth.uid() IS NULL
        OR
        -- Allow if user is superadmin
        EXISTS (SELECT 1 FROM portal_users WHERE id = auth.uid() AND role = 'superadmin')
    );

-- Verify the policy was created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'app_settings';

-- =====================================================
-- DONE! Settings should now be accessible via admin_db
-- =====================================================
