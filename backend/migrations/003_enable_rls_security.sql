-- =====================================================
-- ALIEN PORTAL: Security Fix - Enable RLS on All Tables
-- Run this SQL in Supabase SQL Editor to fix security warnings
-- =====================================================

-- Enable RLS on all public tables
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_users ENABLE ROW LEVEL SECURITY;

-- Note: report_history already has RLS enabled from migration 002

-- =====================================================
-- RLS Policies for communication_logs
-- =====================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their project logs" ON communication_logs;
DROP POLICY IF EXISTS "Internal users can view all logs" ON communication_logs;

-- Policy: Users can view logs for their assigned projects
CREATE POLICY "Users can view their project logs" ON communication_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM portal_users 
            WHERE id = auth.uid() 
            AND (
                role IN ('superadmin', 'internal') 
                OR project_id = ANY(assigned_projects)
            )
        )
    );

-- Policy: Internal users can insert logs
CREATE POLICY "Internal users can insert logs" ON communication_logs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM portal_users 
            WHERE id = auth.uid() 
            AND role IN ('superadmin', 'internal')
        )
    );

-- =====================================================
-- RLS Policies for projects
-- =====================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their projects" ON projects;
DROP POLICY IF EXISTS "Internal users can view all projects" ON projects;
DROP POLICY IF EXISTS "Internal users can modify projects" ON projects;

-- Policy: Users can view their assigned projects
CREATE POLICY "Users can view their projects" ON projects
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM portal_users 
            WHERE id = auth.uid() 
            AND (
                role IN ('superadmin', 'internal') 
                OR id = ANY(
                    SELECT unnest(assigned_projects) 
                    FROM portal_users 
                    WHERE portal_users.id = auth.uid()
                )
            )
        )
    );

-- Policy: Internal users can insert/update/delete projects
CREATE POLICY "Internal users can modify projects" ON projects
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM portal_users 
            WHERE id = auth.uid() 
            AND role IN ('superadmin', 'internal')
        )
    );

-- =====================================================
-- Verify RLS is enabled
-- =====================================================

-- This query should show 'true' for all tables
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('communication_logs', 'projects', 'app_settings', 'portal_users', 'report_history')
ORDER BY tablename;

-- =====================================================
-- DONE! All security warnings should be resolved.
-- =====================================================
