-- AUTOMATICALLY LINK JOINING USERS TO TEAMS
-- This trigger runs every time a new user signs up via Supabase Auth.
-- It checks if there is a pending invitation (team_members) for their email.
-- If found, it links the new User ID to the invitation.

-- 1. Create the function
CREATE OR REPLACE FUNCTION public.handle_new_user_invite()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the team_members table where the email matches
  UPDATE public.team_members
  SET member_id = NEW.id
  WHERE member_email = NEW.email;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created_link_team ON auth.users;

CREATE TRIGGER on_auth_user_created_link_team
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_invite();

-- 3. (Optional) Security Policy Update (Ensure authenticated users can read their own membership)
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own membership"
ON team_members FOR SELECT
USING (auth.uid() = member_id OR auth.uid() = owner_id);

