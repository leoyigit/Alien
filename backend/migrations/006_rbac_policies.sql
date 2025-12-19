-- Migration 006: Row Level Security and Access Control
-- Implements role-based access control for internal/external/merchant users

-- Enable RLS on projects table if not already enabled
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Enable RLS on communication_logs table
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "projects_select_policy" ON projects;
DROP POLICY IF EXISTS "comm_logs_select_policy" ON communication_logs;

-- ============================================
-- PROJECTS TABLE POLICIES
-- ============================================

-- Policy: All authenticated users can SELECT projects based on role
CREATE POLICY "projects_select_policy"
ON projects FOR SELECT
TO authenticated
USING (
  -- Superadmin sees everything
  (auth.jwt() ->> 'role' = 'superadmin')
  OR
  -- Internal team (flyrank.com, powercommerce.com) sees everything
  (
    auth.jwt() ->> 'role' = 'internal'
    OR auth.jwt() ->> 'email' LIKE '%@flyrank.com'
    OR auth.jwt() ->> 'email' LIKE '%@powercommerce.com'
  )
  OR
  -- Shopline users see external channels and partnerships only
  (
    auth.jwt() ->> 'email' LIKE '%@shopline.com'
    AND (
      channel_id_external IS NOT NULL 
      OR is_partnership = true
    )
  )
  OR
  -- Merchants see only their assigned projects
  (
    auth.jwt() ->> 'role' = 'merchant'
    AND id IN (
      SELECT unnest(assigned_projects)
      FROM portal_users
      WHERE id = (auth.jwt() ->> 'user_id')::uuid
    )
  )
);

-- Policy: Only internal team and superadmin can INSERT projects
CREATE POLICY "projects_insert_policy"
ON projects FOR INSERT
TO authenticated
WITH CHECK (
  auth.jwt() ->> 'role' IN ('superadmin', 'internal')
  OR auth.jwt() ->> 'email' LIKE '%@flyrank.com'
  OR auth.jwt() ->> 'email' LIKE '%@powercommerce.com'
);

-- Policy: Only internal team and superadmin can UPDATE projects
CREATE POLICY "projects_update_policy"
ON projects FOR UPDATE
TO authenticated
USING (
  auth.jwt() ->> 'role' IN ('superadmin', 'internal')
  OR auth.jwt() ->> 'email' LIKE '%@flyrank.com'
  OR auth.jwt() ->> 'email' LIKE '%@powercommerce.com'
)
WITH CHECK (
  auth.jwt() ->> 'role' IN ('superadmin', 'internal')
  OR auth.jwt() ->> 'email' LIKE '%@flyrank.com'
  OR auth.jwt() ->> 'email' LIKE '%@powercommerce.com'
);

-- Policy: Only superadmin can DELETE projects
CREATE POLICY "projects_delete_policy"
ON projects FOR DELETE
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'superadmin'
);

-- ============================================
-- COMMUNICATION_LOGS TABLE POLICIES
-- ============================================

-- Policy: Users can only see communication logs for projects they have access to
CREATE POLICY "comm_logs_select_policy"
ON communication_logs FOR SELECT
TO authenticated
USING (
  -- Check if user has access to the project
  project_id IN (
    SELECT id FROM projects
    -- This will use the projects RLS policy automatically
  )
);

-- Policy: Only internal team can INSERT communication logs
CREATE POLICY "comm_logs_insert_policy"
ON communication_logs FOR INSERT
TO authenticated
WITH CHECK (
  auth.jwt() ->> 'role' IN ('superadmin', 'internal')
  OR auth.jwt() ->> 'email' LIKE '%@flyrank.com'
  OR auth.jwt() ->> 'email' LIKE '%@powercommerce.com'
);

-- Policy: Only internal team can UPDATE communication logs
CREATE POLICY "comm_logs_update_policy"
ON communication_logs FOR UPDATE
TO authenticated
USING (
  auth.jwt() ->> 'role' IN ('superadmin', 'internal')
)
WITH CHECK (
  auth.jwt() ->> 'role' IN ('superadmin', 'internal')
);

-- Policy: Only superadmin can DELETE communication logs
CREATE POLICY "comm_logs_delete_policy"
ON communication_logs FOR DELETE
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'superadmin'
);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if user is internal team
CREATE OR REPLACE FUNCTION is_internal_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    (auth.jwt() ->> 'role' IN ('superadmin', 'internal'))
    OR (auth.jwt() ->> 'email' LIKE '%@flyrank.com')
    OR (auth.jwt() ->> 'email' LIKE '%@powercommerce.com');
$$;

-- Function to check if user can access project
CREATE OR REPLACE FUNCTION can_access_project(project_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS(
    SELECT 1 FROM projects 
    WHERE id = project_uuid
    -- Uses projects RLS policy
  );
$$;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON POLICY "projects_select_policy" ON projects IS 
'Restricts project visibility based on user role and email domain';

COMMENT ON POLICY "comm_logs_select_policy" ON communication_logs IS
'Users can only see communication logs for projects they have access to via projects RLS';

COMMENT ON FUNCTION is_internal_user() IS
'Helper function to check if current user is internal team (flyrank.com or powercommerce.com)';

COMMENT ON FUNCTION can_access_project(uuid) IS
'Helper function to check if current user can access a specific project';
