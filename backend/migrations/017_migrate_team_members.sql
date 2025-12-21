-- Migrate existing team members from app_settings JSON to contacts table
DO $$
DECLARE
    team_data JSONB;
    member JSONB;
BEGIN
    -- Get existing team members from app_settings
    SELECT value::jsonb INTO team_data
    FROM app_settings
    WHERE key = 'TEAM_MEMBERS';
    
    -- If team members exist, migrate them
    IF team_data IS NOT NULL THEN
        FOR member IN SELECT * FROM jsonb_array_elements(team_data)
        LOOP
            INSERT INTO contacts (name, email, role, slack_user_id, notes)
            VALUES (
                member->>'name',
                member->>'email',
                COALESCE(member->>'role', 'Internal'),
                member->>'slack_user_id',
                'Migrated from team members'
            )
            ON CONFLICT DO NOTHING;
        END LOOP;
        
        RAISE NOTICE 'Migrated team members to contacts table';
    END IF;
END $$;
