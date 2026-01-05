-- Coupons Table
CREATE TABLE IF NOT EXISTS store_coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
    discount_value NUMERIC(10, 2) NOT NULL,
    min_order_amount NUMERIC(10, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    expiry_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE store_coupons ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public can view coupons for validation" ON store_coupons
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admin can manage coupons" ON store_coupons
    FOR ALL USING (auth.jwt() ->> 'email' = 'your_email@example.com');

-- Add a demo coupon
INSERT INTO store_coupons (code, discount_type, discount_value, min_order_amount)
VALUES ('WELCOME10', 'percentage', 10.00, 50.00)
ON CONFLICT (code) DO NOTHING;
