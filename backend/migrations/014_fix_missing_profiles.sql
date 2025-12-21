-- =====================================================
-- ALIEN PORTAL: Fix Missing User Profiles
-- Run this SQL in Supabase SQL Editor
-- =====================================================

-- This fixes users who exist in auth.users but not in portal_users
-- This can happen if the trigger failed or RLS was blocking it

-- 1. Find users with missing profiles
SELECT 
    au.id,
    au.email,
    au.created_at,
    'MISSING PROFILE' as status
FROM auth.users au
LEFT JOIN portal_users pu ON au.id = pu.id
WHERE pu.id IS NULL
ORDER BY au.created_at DESC;

-- 2. Create missing profiles for all users
-- This will auto-assign roles based on email domain
INSERT INTO portal_users (id, email, display_name, role, status)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)) as display_name,
    CASE 
        WHEN au.email LIKE '%@flyrank.com' OR au.email LIKE '%@powercommerce.com' THEN 'internal'::user_role
        WHEN au.email LIKE '%@shopline.com' THEN 'shopline'::user_role
        ELSE 'merchant'::user_role
    END as role,
    'pending' as status
FROM auth.users au
LEFT JOIN portal_users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 3. Verify all users now have profiles
SELECT 
    COUNT(*) as total_auth_users,
    (SELECT COUNT(*) FROM portal_users) as total_portal_users,
    CASE 
        WHEN COUNT(*) = (SELECT COUNT(*) FROM portal_users) THEN '✅ All users have profiles'
        ELSE '❌ Some users still missing profiles'
    END as status
FROM auth.users;

-- 4. Show newly created profiles
SELECT email, role, status, created_at 
FROM portal_users 
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC;

-- =====================================================
-- DONE! All users should now have profiles
-- Client can now login successfully
-- =====================================================
