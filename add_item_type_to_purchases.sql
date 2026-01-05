-- Add item_type column to purchases table
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS item_type TEXT;

-- Populate item_type from inventory for existing records
UPDATE purchases p
SET item_type = i.type
FROM inventory i
WHERE p.item_name = i.name
AND p.item_type IS NULL;

-- Notify pgrst to reload schema
NOTIFY pgrst, 'reload schema';
