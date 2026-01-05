-- Add Shelf Life column to inventory
-- Default to 24 months (2 years) as a standard fallback
ALTER TABLE inventory 
ADD COLUMN IF NOT EXISTS shelf_life_months INTEGER DEFAULT 24;
