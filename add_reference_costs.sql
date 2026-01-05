-- Add reference cost columns for detailed production costing
ALTER TABLE inventory 
ADD COLUMN IF NOT EXISTS ref_overhead_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS ref_packaging_id INTEGER REFERENCES inventory(id),
ADD COLUMN IF NOT EXISTS ref_shipping_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS ref_monthly_interest NUMERIC DEFAULT 4;
