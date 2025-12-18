-- Fix missing columns in stock_movements table
-- This table might have been created with a different schema initially.
-- We ensure all required columns exist.

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS change_amount NUMERIC DEFAULT 0;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS current_stock NUMERIC DEFAULT 0;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS related_id BIGINT;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS notes TEXT;
