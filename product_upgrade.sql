-- [AGORALOOM - PRODUCT SCHEMA UPGRADE]
-- Run this if you see errors about missing columns like care_instructions or material

ALTER TABLE store_products 
ADD COLUMN IF NOT EXISTS material TEXT,
ADD COLUMN IF NOT EXISTS care_instructions TEXT,
ADD COLUMN IF NOT EXISTS size_guide TEXT;

-- Notify Supabase to refresh its schema cache
NOTIFY pgrst, 'reload schema';
