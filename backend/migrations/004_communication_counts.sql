-- =====================================================
-- ALIEN PORTAL: Communication Counts & Email Improvements
-- Run this SQL in Supabase SQL Editor
-- =====================================================

-- 1. Add communication count columns to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS comm_count_internal INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS comm_count_external INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS comm_count_meetings INTEGER DEFAULT 0;

-- 2. Add email sent date column to communication_logs
ALTER TABLE communication_logs 
ADD COLUMN IF NOT EXISTS email_sent_date TIMESTAMPTZ;

-- 3. Create table for unmatched emails (manual review)
CREATE TABLE IF NOT EXISTS unmatched_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_email TEXT NOT NULL,
    from_name TEXT,
    to_emails TEXT[],
    cc_emails TEXT[],
    subject TEXT,
    body TEXT,
    received_at TIMESTAMPTZ DEFAULT NOW(),
    slack_ts TEXT,
    matched BOOLEAN DEFAULT false,
    assigned_project_id UUID REFERENCES projects(id),
    notes TEXT
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_comm_logs_email_date ON communication_logs(email_sent_date DESC);
CREATE INDEX IF NOT EXISTS idx_unmatched_emails_matched ON unmatched_emails(matched) WHERE matched = false;

-- 5. Function to update communication counts
CREATE OR REPLACE FUNCTION update_project_comm_counts(p_project_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE projects
    SET 
        comm_count_internal = (
            SELECT COUNT(*) FROM communication_logs 
            WHERE project_id = p_project_id AND source = 'slack'
        ),
        comm_count_external = (
            SELECT COUNT(*) FROM communication_logs 
            WHERE project_id = p_project_id AND source = 'email'
        )
    WHERE id = p_project_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger to auto-update counts when communication_logs changes
CREATE OR REPLACE FUNCTION trigger_update_comm_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM update_project_comm_counts(NEW.project_id);
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM update_project_comm_counts(OLD.project_id);
    ELSIF TG_OP = 'UPDATE' AND NEW.project_id != OLD.project_id THEN
        PERFORM update_project_comm_counts(OLD.project_id);
        PERFORM update_project_comm_counts(NEW.project_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_comm_counts_trigger ON communication_logs;
CREATE TRIGGER update_comm_counts_trigger
    AFTER INSERT OR UPDATE OR DELETE ON communication_logs
    FOR EACH ROW EXECUTE FUNCTION trigger_update_comm_counts();

-- 7. Backfill existing counts for all projects
DO $$
DECLARE
    project_record RECORD;
BEGIN
    FOR project_record IN SELECT id FROM projects LOOP
        PERFORM update_project_comm_counts(project_record.id);
    END LOOP;
END $$;

-- 8. Add RLS for unmatched_emails table
ALTER TABLE unmatched_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can view unmatched emails" ON unmatched_emails
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM portal_users 
            WHERE id = auth.uid() 
            AND role IN ('superadmin', 'internal')
        )
    );

CREATE POLICY "Internal users can manage unmatched emails" ON unmatched_emails
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM portal_users 
            WHERE id = auth.uid() 
            AND role IN ('superadmin', 'internal')
        )
    );

-- =====================================================
-- Verification Query
-- =====================================================
SELECT 
    client_name,
    comm_count_internal as slack_msgs,
    comm_count_external as emails,
    comm_count_meetings as meetings
FROM projects
ORDER BY client_name
LIMIT 10;

-- =====================================================
-- DONE! Communication counts are now cached and auto-updated.
-- =====================================================
