-- Add product_code column
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS product_code TEXT;

-- Backfill Hammadde
UPDATE inventory 
SET product_code = 'HM-' || LPAD(id::text, 3, '0') 
WHERE type = 'Hammadde' AND product_code IS NULL;

-- Backfill Ambalaj
UPDATE inventory 
SET product_code = 'AMB-' || LPAD(id::text, 3, '0') 
WHERE type = 'Ambalaj' AND product_code IS NULL;

-- Backfill Mamul / Yarı Mamul
UPDATE inventory 
SET product_code = 'PRD-' || LPAD(id::text, 3, '0') 
WHERE (type = 'Mamul' OR type = 'Yarı Mamul') AND product_code IS NULL;

-- Backfill Any others (Safety)
UPDATE inventory 
SET product_code = 'ITEM-' || LPAD(id::text, 3, '0') 
WHERE product_code IS NULL;
