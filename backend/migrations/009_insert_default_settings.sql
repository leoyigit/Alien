-- =====================================================
-- ALIEN PORTAL: Insert Default Settings
-- Run this SQL in Supabase SQL Editor
-- =====================================================

-- This creates default setting records for all API keys
-- so they appear in the Settings UI even if not configured yet

-- Insert default settings with empty values
-- Using ON CONFLICT to avoid duplicates if settings already exist
INSERT INTO app_settings (key, value, is_secret, description) VALUES
    -- Slack Integration
    ('SLACK_BOT_TOKEN', '', true, 'Slack Bot OAuth Token (xoxb-...)'),
    ('SLACK_SIGNING_SECRET', '', true, 'Slack App Signing Secret'),
    ('SLACK_APP_TOKEN', '', true, 'Slack App-Level Token (xapp-...)'),
    
    -- OpenAI Integration
    ('OPENAI_API_KEY', '', true, 'OpenAI API Key (sk-...)'),
    ('OPENAI_ASSISTANT_ID', '', true, 'OpenAI Assistant ID (asst_...)'),
    ('OPENAI_VECTOR_STORE_ID_INTERNAL', '', true, 'Vector Store for Internal Data'),
    ('OPENAI_VECTOR_STORE_ID_EXTERNAL', '', true, 'Vector Store for External Data')
ON CONFLICT (key) DO UPDATE SET
    description = EXCLUDED.description,
    is_secret = EXCLUDED.is_secret;

-- Verify settings were created
SELECT key, description, is_secret, 
       CASE WHEN value = '' THEN '(empty)' ELSE '(configured)' END as status
FROM app_settings
WHERE key IN (
    'SLACK_BOT_TOKEN', 
    'SLACK_SIGNING_SECRET', 
    'SLACK_APP_TOKEN',
    'OPENAI_API_KEY', 
    'OPENAI_ASSISTANT_ID',
    'OPENAI_VECTOR_STORE_ID_INTERNAL',
    'OPENAI_VECTOR_STORE_ID_EXTERNAL'
)
ORDER BY key;

-- =====================================================
-- DONE! Refresh Settings page to see input fields
-- =====================================================
