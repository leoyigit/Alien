-- Add AI assistant fields to projects table
-- Each project gets 2 vector stores and 2 assistants (internal/external)

ALTER TABLE projects
ADD COLUMN internal_vector_store_id TEXT,
ADD COLUMN external_vector_store_id TEXT,
ADD COLUMN internal_assistant_id TEXT,
ADD COLUMN external_assistant_id TEXT,
ADD COLUMN last_sync_internal TIMESTAMP WITH TIME ZONE,
ADD COLUMN last_sync_external TIMESTAMP WITH TIME ZONE,
ADD COLUMN sync_status TEXT DEFAULT 'pending';

-- Add index for sync status queries
CREATE INDEX IF NOT EXISTS idx_projects_sync_status ON projects(sync_status);

-- Add comments for documentation
COMMENT ON COLUMN projects.internal_vector_store_id IS 'OpenAI vector store ID for internal communications (Slack internal channel)';
COMMENT ON COLUMN projects.external_vector_store_id IS 'OpenAI vector store ID for external communications (Slack external channel)';
COMMENT ON COLUMN projects.internal_assistant_id IS 'OpenAI assistant ID for internal team (superadmin + internal only)';
COMMENT ON COLUMN projects.external_assistant_id IS 'OpenAI assistant ID for external users (Shopline + merchants)';
COMMENT ON COLUMN projects.sync_status IS 'Status: pending, syncing, synced, error';
