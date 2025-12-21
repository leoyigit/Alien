-- Remove foreign key constraint from activity_logs.user_id
-- This allows logging even if user is deleted or doesn't exist in profiles

ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_user_id_fkey;

-- Make user_id nullable (optional)
ALTER TABLE activity_logs ALTER COLUMN user_id DROP NOT NULL;
