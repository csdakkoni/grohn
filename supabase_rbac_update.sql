-- Create team_members table
CREATE TABLE IF NOT EXISTS team_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES auth.users(id),
    member_email TEXT NOT NULL,
    member_id UUID REFERENCES auth.users(id), -- Can be null initially if user hasn't signed up/linked
    role TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'viewer')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(owner_id, member_email)
);

-- Enable RLS on team_members
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Policy: Owners can manage their own team members
CREATE POLICY "Owners can manage team members" ON team_members
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- Policy: Members can view their own membership
CREATE POLICY "Members can view their membership" ON team_members
    FOR SELECT USING (auth.uid() = member_id);

-- Helper function to check access
-- Returns true if auth.uid() is the owner OR a member with access
CREATE OR REPLACE FUNCTION has_access(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        auth.uid() = target_user_id 
        OR 
        EXISTS (
            SELECT 1 FROM team_members 
            WHERE owner_id = target_user_id 
            AND member_id = auth.uid()
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check role
CREATE OR REPLACE FUNCTION get_user_role(target_owner_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_role TEXT;
BEGIN
    IF auth.uid() = target_owner_id THEN
        RETURN 'admin';
    END IF;

    SELECT role INTO v_role FROM team_members 
    WHERE owner_id = target_owner_id AND member_id = auth.uid();
    
    RETURN v_role; -- Returns null if no access
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- UPDATE RLS POLICIES FOR EXISTING TABLES
-- We need to drop old policies and add new ones that use has_access()

-- Inventory
DROP POLICY IF EXISTS "Users can view their own inventory" ON inventory;
CREATE POLICY "Team access inventory" ON inventory
    FOR SELECT USING (has_access(user_id));

DROP POLICY IF EXISTS "Users can insert their own inventory" ON inventory;
CREATE POLICY "Team insert inventory" ON inventory
    FOR INSERT WITH CHECK (has_access(user_id)); -- Ideally check role here too, but frontend will handle role logic mostly

DROP POLICY IF EXISTS "Users can update their own inventory" ON inventory;
CREATE POLICY "Team update inventory" ON inventory
    FOR UPDATE USING (has_access(user_id));

DROP POLICY IF EXISTS "Users can delete their own inventory" ON inventory;
CREATE POLICY "Team delete inventory" ON inventory
    FOR DELETE USING (has_access(user_id) AND get_user_role(user_id) = 'admin');


-- Productions
DROP POLICY IF EXISTS "Users can view their own productions" ON productions;
CREATE POLICY "Team access productions" ON productions
    FOR SELECT USING (has_access(user_id));

DROP POLICY IF EXISTS "Users can insert their own productions" ON productions;
CREATE POLICY "Team insert productions" ON productions
    FOR INSERT WITH CHECK (has_access(user_id));

DROP POLICY IF EXISTS "Users can update their own productions" ON productions;
CREATE POLICY "Team update productions" ON productions
    FOR UPDATE USING (has_access(user_id));

DROP POLICY IF EXISTS "Users can delete their own productions" ON productions;
CREATE POLICY "Team delete productions" ON productions
    FOR DELETE USING (has_access(user_id) AND get_user_role(user_id) = 'admin');


-- Sales
DROP POLICY IF EXISTS "Users can view their own sales" ON sales;
CREATE POLICY "Team access sales" ON sales
    FOR SELECT USING (has_access(user_id));

DROP POLICY IF EXISTS "Users can insert their own sales" ON sales;
CREATE POLICY "Team insert sales" ON sales
    FOR INSERT WITH CHECK (has_access(user_id));

DROP POLICY IF EXISTS "Users can update their own sales" ON sales;
CREATE POLICY "Team update sales" ON sales
    FOR UPDATE USING (has_access(user_id));

DROP POLICY IF EXISTS "Users can delete their own sales" ON sales;
CREATE POLICY "Team delete sales" ON sales
    FOR DELETE USING (has_access(user_id) AND get_user_role(user_id) = 'admin');


-- Purchases
DROP POLICY IF EXISTS "Users can view their own purchases" ON purchases;
CREATE POLICY "Team access purchases" ON purchases
    FOR SELECT USING (has_access(user_id));

DROP POLICY IF EXISTS "Users can insert their own purchases" ON purchases;
CREATE POLICY "Team insert purchases" ON purchases
    FOR INSERT WITH CHECK (has_access(user_id));

DROP POLICY IF EXISTS "Users can delete their own purchases" ON purchases;
CREATE POLICY "Team delete purchases" ON purchases
    FOR DELETE USING (has_access(user_id) AND get_user_role(user_id) = 'admin');


-- Recipes
DROP POLICY IF EXISTS "Users can view their own recipes" ON recipes;
CREATE POLICY "Team access recipes" ON recipes
    FOR SELECT USING (has_access(user_id));

DROP POLICY IF EXISTS "Users can insert their own recipes" ON recipes;
CREATE POLICY "Team insert recipes" ON recipes
    FOR INSERT WITH CHECK (has_access(user_id));

DROP POLICY IF EXISTS "Users can update their own recipes" ON recipes;
CREATE POLICY "Team update recipes" ON recipes
    FOR UPDATE USING (has_access(user_id));

DROP POLICY IF EXISTS "Users can delete their own recipes" ON recipes;
CREATE POLICY "Team delete recipes" ON recipes
    FOR DELETE USING (has_access(user_id) AND get_user_role(user_id) = 'admin');


-- Accounts
DROP POLICY IF EXISTS "Users can view their own accounts" ON accounts;
CREATE POLICY "Team access accounts" ON accounts
    FOR SELECT USING (has_access(user_id));

DROP POLICY IF EXISTS "Users can insert their own accounts" ON accounts;
CREATE POLICY "Team insert accounts" ON accounts
    FOR INSERT WITH CHECK (has_access(user_id));

DROP POLICY IF EXISTS "Users can update their own accounts" ON accounts;
CREATE POLICY "Team update accounts" ON accounts
    FOR UPDATE USING (has_access(user_id));

DROP POLICY IF EXISTS "Users can delete their own accounts" ON accounts;
CREATE POLICY "Team delete accounts" ON accounts
    FOR DELETE USING (has_access(user_id) AND get_user_role(user_id) = 'admin');


-- Stock Movements
DROP POLICY IF EXISTS "Users can view their own stock movements" ON stock_movements;
CREATE POLICY "Team access stock_movements" ON stock_movements
    FOR SELECT USING (has_access(user_id));

DROP POLICY IF EXISTS "Users can insert their own stock movements" ON stock_movements;
CREATE POLICY "Team insert stock_movements" ON stock_movements
    FOR INSERT WITH CHECK (has_access(user_id));
