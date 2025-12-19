-- Migration 007: Contacts Management
-- Centralized contact management with project associations

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    company TEXT,
    role TEXT, -- Merchant, Partner, Shopline, Internal
    slack_user_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contact-Project associations (many-to-many)
CREATE TABLE IF NOT EXISTS contact_projects (
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    PRIMARY KEY (contact_id, project_id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_slack ON contacts(slack_user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_role ON contacts(role);
CREATE INDEX IF NOT EXISTS idx_contact_projects_contact ON contact_projects(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_projects_project ON contact_projects(project_id);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_contacts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_contacts_timestamp();

-- Comments
COMMENT ON TABLE contacts IS 'Centralized contact management';
COMMENT ON TABLE contact_projects IS 'Associates contacts with projects';
