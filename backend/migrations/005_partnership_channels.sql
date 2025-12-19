-- Migration 005: Partnership Channels Support
-- Adds ability to mark channels as partnerships (not client projects)
-- These channels track communication but don't appear in Projects/PM Station

-- Add partnership flag to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS is_partnership BOOLEAN DEFAULT false;

-- Add index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_projects_is_partnership ON projects(is_partnership);

-- Add comment for documentation
COMMENT ON COLUMN projects.is_partnership IS 'True for partnership/internal channels (e.g., shopline-partnership), false for client projects';

-- Note: Channels will be marked manually via Scanner UI
-- No auto-detection to give full control over classification
