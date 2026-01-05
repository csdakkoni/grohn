-- CLEANUP TEST USERS
-- Deletes the specified users from auth system and team records to allow fresh testing.

-- 1. Remove from team invitations/memberships first (Public Schema)
DELETE FROM public.team_members 
WHERE member_email IN ('aslan.erdm@gmail.com', 'csdakkoni@icloud.com');

-- 2. Remove from Auth Users (Supabase Auth Schema)
-- content of auth.users is protected, but this standard SQL usually works in SQL Editor
DELETE FROM auth.users 
WHERE email IN ('aslan.erdm@gmail.com', 'csdakkoni@icloud.com');

-- 3. Cleanup any data they might have created as owners (Optional, but good for fresh start)
-- WARNING: This deletes data created by these users if they were 'owners'
DELETE FROM public.accounts WHERE user_id IN (
    SELECT id FROM auth.users WHERE email IN ('aslan.erdm@gmail.com', 'csdakkoni@icloud.com')
);
DELETE FROM public.inventory WHERE user_id IN (
    SELECT id FROM auth.users WHERE email IN ('aslan.erdm@gmail.com', 'csdakkoni@icloud.com')
);
-- ... (other tables would cascade if FKs are set, but main ones are cleared)
