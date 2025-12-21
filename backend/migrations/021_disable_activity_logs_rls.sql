-- Disable RLS on activity_logs table to prevent authentication issues
-- Only superadmins should access this table via API endpoints

ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;
