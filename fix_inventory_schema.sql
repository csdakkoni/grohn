-- Adding missing currency columns for reference costs
ALTER TABLE inventory 
ADD COLUMN IF NOT EXISTS overhead_currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS shipping_currency TEXT DEFAULT 'TRY';

-- Ensure reference cost columns exist (safety)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'ref_overhead_cost') THEN
        ALTER TABLE inventory ADD COLUMN ref_overhead_cost NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'ref_packaging_id') THEN
        ALTER TABLE inventory ADD COLUMN ref_packaging_id INTEGER REFERENCES inventory(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'ref_shipping_cost') THEN
        ALTER TABLE inventory ADD COLUMN ref_shipping_cost NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'ref_monthly_interest') THEN
        ALTER TABLE inventory ADD COLUMN ref_monthly_interest NUMERIC DEFAULT 4;
    END IF;
END $$;
