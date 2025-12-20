-- =====================================================
-- ALIEN PORTAL: Fix New User Signup - Add Status Field
-- Run this SQL in Supabase SQL Editor
-- =====================================================

-- The handle_new_user() trigger doesn't set the status field
-- This causes new signups to have NULL status instead of 'pending'

-- Update the trigger function to include status
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    user_role_val user_role;
BEGIN
    -- Auto-assign role based on email domain
    IF NEW.email LIKE '%@flyrank.com' OR NEW.email LIKE '%@powercommerce.com' THEN
        user_role_val := 'internal';
    ELSIF NEW.email LIKE '%@shopline.com' THEN
        user_role_val := 'shopline';
    ELSE
        user_role_val := 'merchant';
    END IF;

    -- Insert with status = 'pending' for new users
    INSERT INTO public.portal_users (id, email, display_name, role, status)
    VALUES (
        NEW.id, 
        NEW.email, 
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), 
        user_role_val,
        'pending'  -- All new users start as pending
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix existing users that might have NULL status
UPDATE portal_users 
SET status = 'approved' 
WHERE status IS NULL;

-- Verify all users have a status
SELECT email, role, status, created_at 
FROM portal_users 
ORDER BY created_at DESC;

-- =====================================================
-- DONE! New signups will now have 'pending' status
-- Existing users with NULL status are set to 'approved'
-- =====================================================
