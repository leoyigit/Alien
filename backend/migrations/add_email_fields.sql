# Database Migration for Email Support
# Run this SQL in your Supabase SQL Editor

-- Add email-specific fields to communication_logs table
ALTER TABLE communication_logs 
ADD COLUMN IF NOT EXISTS sender_email TEXT,
ADD COLUMN IF NOT EXISTS subject TEXT;

-- Create index on sender_email for faster lookups
CREATE INDEX IF NOT EXISTS idx_comm_logs_sender_email ON communication_logs(sender_email);

-- Create index on source for filtering
CREATE INDEX IF NOT EXISTS idx_comm_logs_source ON communication_logs(source);

COMMENT ON COLUMN communication_logs.sender_email IS 'Email address of the sender (for email-sourced messages)';
COMMENT ON COLUMN communication_logs.subject IS 'Email subject line (for email-sourced messages)';
