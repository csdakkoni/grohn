-- ==========================================
-- FINAL DATABASE SCHEMA FIX
-- Run this in your Supabase SQL Editor
-- ==========================================

-- 1. FIX INVENTORY TABLE
-- Add item_type to inventory if missing
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS item_type TEXT;

-- If item_type was just added, populate it from the existing 'type' column
UPDATE inventory SET item_type = type WHERE item_type IS NULL;

-- 2. FIX PURCHASES TABLE
-- Add item_type to purchases if missing
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS item_type TEXT;

-- 3. REFRESH SCHEMA CACHE
-- This comment helps remind that the schema cache might need time to refresh.
COMMENT ON TABLE inventory IS 'Updated on 2025-12-31 to include item_type logic';
