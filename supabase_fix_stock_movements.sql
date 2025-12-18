-- Add missing inventory_id column to stock_movements table
-- This fixes the error: column "inventory_id" of relation "stock_movements" does not exist

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS inventory_id BIGINT REFERENCES inventory(id);
