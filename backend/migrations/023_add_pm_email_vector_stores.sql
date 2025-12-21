-- Add PM data and email vector store columns to projects table
-- Expanding from 2 to 4 vector stores per project

ALTER TABLE projects
ADD COLUMN pm_vector_store_id TEXT,
ADD COLUMN pm_assistant_id TEXT,
ADD COLUMN email_vector_store_id TEXT,
ADD COLUMN email_assistant_id TEXT,
ADD COLUMN last_sync_pm TIMESTAMP WITH TIME ZONE,
ADD COLUMN last_sync_emails TIMESTAMP WITH TIME ZONE;

-- Add comments for documentation
COMMENT ON COLUMN projects.pm_vector_store_id IS 'Vector store for PM inputs (notes, blockers, updates, URLs, launch dates)';
COMMENT ON COLUMN projects.pm_assistant_id IS 'Assistant for PM data queries';
COMMENT ON COLUMN projects.email_vector_store_id IS 'Vector store for email communications';
COMMENT ON COLUMN projects.email_assistant_id IS 'Assistant for email queries';
COMMENT ON COLUMN projects.last_sync_pm IS 'Last time PM data was synced to vector store';
COMMENT ON COLUMN projects.last_sync_emails IS 'Last time emails were synced to vector store';
