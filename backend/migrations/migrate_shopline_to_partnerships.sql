-- One-time migration: Move shopline-partnership and shopline-internal to partnerships
-- Run this in Supabase SQL Editor

UPDATE projects 
SET is_partnership = true 
WHERE client_name IN ('shopline-partnership', 'shopline-internal')
  AND is_partnership = false;

-- Verify the update
SELECT id, client_name, is_partnership 
FROM projects 
WHERE client_name IN ('shopline-partnership', 'shopline-internal');
