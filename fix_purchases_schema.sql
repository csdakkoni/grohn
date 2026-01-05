-- ==========================================
-- FIX PURCHASES SCHEMA
-- Run this in your Supabase SQL Editor
-- ==========================================

-- 1. Add item_type column if it doesn't exist
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS item_type TEXT;

-- 2. Populate item_type for existing records from inventory table
UPDATE purchases p
SET item_type = i.type
FROM inventory i
WHERE p.item_name = i.name
AND p.item_type IS NULL;

-- 3. Ensure we have qty and unit as separate columns (already added in previous steps but for safety)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases' AND column_name='unit') THEN
        ALTER TABLE purchases ADD COLUMN unit TEXT DEFAULT 'kg';
    END IF;
END $$;

-- 4. Notify about success
COMMENT ON COLUMN purchases.item_type IS 'Added for better tracking of raw materials vs packaging in reports';
