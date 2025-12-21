-- Add slack_user_id column to team_members table for DM functionality
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS slack_user_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_team_members_slack_user_id ON team_members(slack_user_id);
