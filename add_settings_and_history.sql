-- 1. Global Settings Table
DROP TABLE IF EXISTS settings;
CREATE TABLE IF NOT EXISTS settings (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES team_members(id),
    setting_key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Calculation History Table (Decoupled Price Calculator)
CREATE TABLE IF NOT EXISTS calculation_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES team_members(id),
    recipe_id BIGINT REFERENCES recipes(id),
    product_name TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    unit_cost NUMERIC NOT NULL,
    unit_price NUMERIC NOT NULL,
    currency TEXT NOT NULL,
    breakdown JSONB NOT NULL,
    parameters JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Extend Sales table for detailed costing
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS raw_material_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS packaging_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS overhead_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS financing_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_production_cost NUMERIC DEFAULT 0;

-- 4. Initial Global Settings
INSERT INTO settings (setting_key, value) VALUES 
('global_overhead_rate', '0.2'::jsonb),
('monthly_interest_rate', '4.0'::jsonb),
('company_name', '"Grohn Tekstil Kimyasal Ürünler San. Tic. Ltd. Şti."'::jsonb),
('company_address', '"Velimeşe OSB, Kervancı Ticaret Merkezi, B-12 Ergene / Tekirdağ"'::jsonb),
('company_email', '"grohn@grohn.com.tr"'::jsonb),
('company_phone', '"+90 539 880 23 46"'::jsonb),
('company_tax_office', '"Çorlu V.D."'::jsonb),
('company_tax_no', '"4111172813"'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;
