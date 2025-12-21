-- Create contacts table to replace team_members JSON storage
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT,
    role TEXT, -- 'PM', 'Dev', 'Both', 'Internal', 'External', 'Merchant'
    slack_user_id TEXT,
    phone TEXT,
    company TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Slack users cache table to avoid rate limits
CREATE TABLE IF NOT EXISTS slack_users_cache (
    user_id TEXT PRIMARY KEY,
    email TEXT,
    name TEXT,
    real_name TEXT,
    profile_data JSONB,
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_role ON contacts(role);
CREATE INDEX IF NOT EXISTS idx_contacts_slack_user_id ON contacts(slack_user_id);
CREATE INDEX IF NOT EXISTS idx_slack_cache_email ON slack_users_cache(email);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
