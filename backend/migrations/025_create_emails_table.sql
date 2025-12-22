-- =====================================================
-- ALIEN PORTAL: Create Emails Table for AI Sync
-- This table stores email communications for AI vector stores
-- =====================================================

-- 1. Create emails table
CREATE TABLE IF NOT EXISTS emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    from_email TEXT NOT NULL,
    from_name TEXT,
    to_email TEXT,
    to_name TEXT,
    cc_emails TEXT[],
    subject TEXT,
    body TEXT,
    sent_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_emails_project_id ON emails(project_id);
CREATE INDEX IF NOT EXISTS idx_emails_sent_date ON emails(sent_date DESC);
CREATE INDEX IF NOT EXISTS idx_emails_created_at ON emails(created_at DESC);

-- 3. Add RLS policies
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

-- Internal users can view all emails
CREATE POLICY "Internal users can view all emails" ON emails
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM portal_users 
            WHERE id = auth.uid() 
            AND role IN ('superadmin', 'internal')
        )
    );

-- External users can only view emails for their assigned projects
CREATE POLICY "External users can view their project emails" ON emails
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM portal_users pu
            JOIN projects p ON p.id = emails.project_id
            WHERE pu.id = auth.uid() 
            AND pu.role = 'external'
            AND pu.assigned_projects @> ARRAY[emails.project_id]
        )
    );

-- Internal users can manage emails
CREATE POLICY "Internal users can manage emails" ON emails
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM portal_users 
            WHERE id = auth.uid() 
            AND role IN ('superadmin', 'internal')
        )
    );

-- 4. Optional: Migrate existing email data from communication_logs
-- Uncomment the following if you want to migrate existing data:

/*
INSERT INTO emails (project_id, from_email, from_name, to_email, subject, body, sent_date, created_at)
SELECT 
    project_id,
    COALESCE(metadata->>'from_email', 'unknown@example.com') as from_email,
    metadata->>'from_name' as from_name,
    metadata->>'to_email' as to_email,
    metadata->>'subject' as subject,
    message as body,
    email_sent_date as sent_date,
    created_at
FROM communication_logs
WHERE source = 'email'
ON CONFLICT (id) DO NOTHING;
*/

-- =====================================================
-- Verification Query
-- =====================================================
SELECT 
    COUNT(*) as total_emails,
    COUNT(DISTINCT project_id) as projects_with_emails
FROM emails;

-- =====================================================
-- DONE! Emails table created and ready for AI sync.
-- =====================================================
