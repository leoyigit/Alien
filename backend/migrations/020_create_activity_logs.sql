-- Create activity logs table for tracking all platform operations
-- Superadmins can monitor syncs, AI usage, contact updates, etc.

CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES profiles(id),
    user_name TEXT,
    action_type TEXT NOT NULL, -- 'sync_contacts', 'sync_ai', 'sync_stakeholders', 'ai_chat', etc.
    resource_type TEXT, -- 'project', 'contact', 'global', etc.
    resource_id UUID,
    resource_name TEXT,
    status TEXT NOT NULL, -- 'success', 'error', 'in_progress'
    details JSONB, -- Additional data (error messages, counts, etc.)
    duration_ms INTEGER
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_status ON activity_logs(status);
CREATE INDEX IF NOT EXISTS idx_activity_logs_resource ON activity_logs(resource_type, resource_id);

-- Comments for documentation
COMMENT ON TABLE activity_logs IS 'Activity log for tracking all platform operations';
COMMENT ON COLUMN activity_logs.action_type IS 'Type of action: sync_contacts, sync_ai, ai_chat, contact_create, etc.';
COMMENT ON COLUMN activity_logs.status IS 'Status: success, error, in_progress';
COMMENT ON COLUMN activity_logs.details IS 'Additional data like error messages, counts, etc.';
