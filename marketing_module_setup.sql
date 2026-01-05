-- MARKETING & CRM MODULE SETUP (V2)
-- Goal: Documentation database (CoA, SDS, TDS), Certifications (ZDHC, GOTS, etc.), Visit Reporting, and Team Scheduling.

-- 0. HELPER FUNCTIONS (Ensure they exist for RLS)
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
    
    RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. UPDATE TEAM MEMBER ROLES
-- Add 'marketing' and 'marketing_manager' to roles
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_role_check;
ALTER TABLE team_members ADD CONSTRAINT team_members_role_check CHECK (role IN ('admin', 'operator', 'viewer', 'marketing', 'marketing_manager'));

-- 2. PRODUCT DOCUMENTS (CoA, SDS, TDS)
CREATE TABLE IF NOT EXISTS product_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id), -- Owner
    inventory_id BIGINT NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    doc_type TEXT NOT NULL CHECK (doc_type IN ('CoA', 'SDS', 'TDS', 'Other')),
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PRODUCT CERTIFICATIONS (ZDHC, Oeko-Tex, GOTS, etc.)
CREATE TABLE IF NOT EXISTS product_certifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    inventory_id BIGINT NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    cert_name TEXT NOT NULL, -- 'ZDHC', 'Oeko-Tex', 'GOTS'
    status TEXT NOT NULL CHECK (status IN ('Valid', 'Expired', 'Pending', 'NA')),
    expiry_date DATE,
    certificate_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CRM: VISIT REPORTS
CREATE TABLE IF NOT EXISTS marketing_visits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id), -- Owner
    visitor_id UUID NOT NULL REFERENCES auth.users(id), -- The marketing person
    customer_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    visit_type TEXT NOT NULL CHECK (visit_type IN ('Potential', 'Current')),
    report_content TEXT,
    next_action TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. MARKETING PLANS (Weekly Program)
CREATE TABLE IF NOT EXISTS marketing_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id), -- Owner
    manager_id UUID NOT NULL REFERENCES auth.users(id), -- Program maker
    staff_id UUID NOT NULL REFERENCES auth.users(id), -- Program followee
    week_start_date DATE NOT NULL,
    plan_data JSONB NOT NULL, -- [{day: 'Monday', tasks: '...'}]
    status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Confirmed', 'Completed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ENABLE RLS
ALTER TABLE product_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_plans ENABLE ROW LEVEL SECURITY;

-- 7. RLS POLICIES (Using existing has_access helper)
-- CoA/SDS/TDS
CREATE POLICY "Team access product_documents" ON product_documents FOR SELECT USING (has_access(user_id));
CREATE POLICY "Team insert product_documents" ON product_documents FOR INSERT WITH CHECK (has_access(user_id));
CREATE POLICY "Team update product_documents" ON product_documents FOR UPDATE USING (has_access(user_id));
CREATE POLICY "Team delete product_documents" ON product_documents FOR DELETE USING (has_access(user_id) AND get_user_role(user_id) IN ('admin', 'marketing_manager'));

-- Certifications
CREATE POLICY "Team access product_certifications" ON product_certifications FOR SELECT USING (has_access(user_id));
CREATE POLICY "Team insert product_certifications" ON product_certifications FOR INSERT WITH CHECK (has_access(user_id));
CREATE POLICY "Team update product_certifications" ON product_certifications FOR UPDATE USING (has_access(user_id));
CREATE POLICY "Team delete product_certifications" ON product_certifications FOR DELETE USING (has_access(user_id) AND get_user_role(user_id) IN ('admin', 'marketing_manager'));

-- Visit Reports
CREATE POLICY "Team access marketing_visits" ON marketing_visits FOR SELECT USING (has_access(user_id));
CREATE POLICY "Team insert marketing_visits" ON marketing_visits FOR INSERT WITH CHECK (has_access(user_id));
CREATE POLICY "Team update marketing_visits" ON marketing_visits FOR UPDATE USING (has_access(user_id));

-- Marketing Plans
CREATE POLICY "Team access marketing_plans" ON marketing_plans FOR SELECT USING (has_access(user_id));
CREATE POLICY "Team manager manage marketing_plans" ON marketing_plans FOR ALL USING (has_access(user_id) AND get_user_role(user_id) IN ('admin', 'marketing_manager'));
