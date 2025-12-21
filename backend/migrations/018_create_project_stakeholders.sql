-- Create project_stakeholders junction table
-- Links projects to contacts (many-to-many relationship)
CREATE TABLE IF NOT EXISTS project_stakeholders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    role TEXT, -- Optional: PM, Dev, Client Contact, etc.
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    added_by UUID, -- User who added this stakeholder
    UNIQUE(project_id, contact_id) -- Prevent duplicates
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_stakeholders_project ON project_stakeholders(project_id);
CREATE INDEX IF NOT EXISTS idx_project_stakeholders_contact ON project_stakeholders(contact_id);

-- Migrate existing stakeholders from JSON to junction table
DO $$
DECLARE
    project_record RECORD;
    stakeholder JSONB;
    found_contact_id UUID;
BEGIN
    -- Loop through all projects
    FOR project_record IN SELECT id, stakeholders FROM projects WHERE stakeholders IS NOT NULL
    LOOP
        -- Loop through stakeholders array
        FOR stakeholder IN SELECT * FROM jsonb_array_elements(project_record.stakeholders)
        LOOP
            -- Try to find matching contact by email
            SELECT id INTO found_contact_id
            FROM contacts
            WHERE email = stakeholder->>'email'
            LIMIT 1;
            
            -- If contact found, create stakeholder link
            IF found_contact_id IS NOT NULL THEN
                INSERT INTO project_stakeholders (project_id, contact_id, role)
                VALUES (project_record.id, found_contact_id, stakeholder->>'role')
                ON CONFLICT (project_id, contact_id) DO NOTHING;
            ELSE
                -- If no matching contact, create one
                INSERT INTO contacts (name, email, role, notes)
                VALUES (
                    stakeholder->>'name',
                    stakeholder->>'email',
                    COALESCE(stakeholder->>'role', 'Merchant'),
                    'Migrated from project stakeholders'
                )
                RETURNING id INTO found_contact_id;
                
                -- Link to project
                INSERT INTO project_stakeholders (project_id, contact_id, role)
                VALUES (project_record.id, found_contact_id, stakeholder->>'role')
                ON CONFLICT (project_id, contact_id) DO NOTHING;
            END IF;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Migrated stakeholders to project_stakeholders table';
END $$;
